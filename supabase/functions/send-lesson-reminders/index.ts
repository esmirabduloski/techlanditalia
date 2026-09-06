import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

/** Converte data (YYYY-MM-DD) + ora locale Roma in un istante UTC. */
function romeToUtc(dateStr: string, timeStr: string | null): Date {
  const time = (timeStr ?? "17:00:00").slice(0, 8);
  const naive = new Date(`${dateStr}T${time}Z`);
  const tzName = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    timeZoneName: "shortOffset",
  })
    .formatToParts(naive)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const match = tzName.match(/GMT([+-]\d+)/);
  const offsetHours = match ? parseInt(match[1], 10) : 1;
  return new Date(naive.getTime() - offsetHours * 3600_000);
}

type Reminder = {
  type: string;
  fromMs: number;
  toMs: number;
  label: (course: string, time?: string) => string;
};

const REMINDERS: Reminder[] = [
  {
    type: "lesson_reminder_24h",
    fromMs: 23.5 * 3600_000,
    toMs: 24.5 * 3600_000,
    label: (course, time) =>
      time ? `Domani alle ${time} c'è la lezione di ${course}.` : `Domani c'è la lezione di ${course}.`,
  },
  {
    type: "lesson_reminder_1h",
    fromMs: 0.75 * 3600_000,
    toMs: 1.25 * 3600_000,
    label: (course, time) =>
      time ? `Tra un'ora (${time}) inizia la lezione di ${course}.` : `Tra un'ora inizia la lezione di ${course}.`,
  },
];

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const CONNECTION_KEY = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
  if (!LOVABLE_API_KEY || !CONNECTION_KEY) {
    return json({ error: "Firebase Cloud Messaging non collegato al progetto" }, 503);
  }

  const sendToUser = async (
    userId: string,
    payload: { title: string; body: string; path: string },
  ): Promise<{ ok: number; ko: number; errors: string[] }> => {
    const { data: devices } = await supabase
      .from("push_devices")
      .select("id, token")
      .eq("user_id", userId);

    let ok = 0;
    let ko = 0;
    const errors: string[] = [];

    for (const device of devices ?? []) {
      const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": CONNECTION_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: device.token,
            notification: { title: payload.title, body: payload.body },
            data: { path: payload.path },
          },
        }),
      });

      if (res.ok) {
        ok++;
      } else {
        ko++;
        const text = await res.text();
        console.error(`[send-lesson-reminders] FCM ${res.status}: ${text}`);
        if (res.status === 404 || res.status === 400) {
          await supabase.from("push_devices").delete().eq("id", device.id as string);
        } else {
          errors.push(`${res.status}: ${text.slice(0, 200)}`);
        }
      }
    }
    return { ok, ko, errors };
  };

  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const inThreeDays = new Date(now.getTime() + 3 * 86400_000).toISOString().slice(0, 10);

    const { data: schedules, error: schedErr } = await supabase
      .from("group_lesson_schedule")
      .select("id, group_id, lesson_number, lesson_date, lesson_time, lesson_title")
      .gte("lesson_date", today)
      .lte("lesson_date", inThreeDays);

    if (schedErr) return json({ error: schedErr.message }, 500);

    let sent = 0;
    let skipped = 0;
    let lessons = 0;
    const errors: string[] = [];

    for (const reminder of REMINDERS) {
      const windowStart = now.getTime() + reminder.fromMs;
      const windowEnd = now.getTime() + reminder.toMs;

      const due = (schedules ?? []).filter((s) => {
        const startsAt = romeToUtc(s.lesson_date as string, s.lesson_time as string | null).getTime();
        return startsAt >= windowStart && startsAt < windowEnd;
      });
      lessons += due.length;

      for (const lesson of due) {
        const { data: group } = await supabase
          .from("student_groups")
          .select("id, title, status, teacher_id, course:courses(title)")
          .eq("id", lesson.group_id as string)
          .maybeSingle();

        if (!group || group.status !== "active") { skipped++; continue; }

        const { data: members } = await supabase
          .from("group_students")
          .select("student_id")
          .eq("group_id", lesson.group_id as string);

        const studentIds = (members ?? []).map((m) => m.student_id as string);

        let parentIds: string[] = [];
        if (studentIds.length > 0) {
          const { data: students } = await supabase
            .from("profiles")
            .select("id, parent_id")
            .in("id", studentIds);
          parentIds = Array.from(
            new Set((students ?? []).map((s) => s.parent_id as string | null).filter(Boolean)),
          ) as string[];
        }

        const courseTitle = (group as { course?: { title?: string } | null }).course?.title
          ?? group.title ?? "coding";
        const timeLabel = (lesson.lesson_time as string | null)?.slice(0, 5);
        const title = "Promemoria lezione TECHLAND";
        const body = reminder.label(courseTitle, timeLabel);

        const recipients: { userId: string; path: string }[] = [
          ...parentIds.map((id) => ({ userId: id, path: "/area-riservata" })),
        ];
        const teacherId = group.teacher_id as string | null;
        if (teacherId) recipients.push({ userId: teacherId, path: "/insegnante" });

        for (const recipient of recipients) {
          const { error: logErr } = await supabase.from("push_notification_log").insert({
            user_id: recipient.userId,
            schedule_id: lesson.id as string,
            notification_type: reminder.type,
            title,
            body,
          });
          if (logErr) { skipped++; continue; } // già inviata

          const result = await sendToUser(recipient.userId, { title, body, path: recipient.path });
          sent += result.ok;
          errors.push(...result.errors);

          await supabase
            .from("push_notification_log")
            .update({ success_count: result.ok, failure_count: result.ko })
            .eq("user_id", recipient.userId)
            .eq("schedule_id", lesson.id as string)
            .eq("notification_type", reminder.type);
        }
      }
    }

    return json({ success: true, lessons, sent, skipped, errors: errors.slice(0, 10) });
  } catch (error) {
    console.error("[send-lesson-reminders]", error);
    return json({ error: error instanceof Error ? error.message : "Errore interno" }, 500);
  }
});
