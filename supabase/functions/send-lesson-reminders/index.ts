import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

/** Converte data (YYYY-MM-DD) + ora locale Roma in un istante UTC. */
function romeToUtc(dateStr: string, timeStr: string | null): Date {
  const time = (timeStr ?? "17:00:00").slice(0, 8);
  const naive = new Date(`${dateStr}T${time}Z`);
  // offset di Roma in quel momento (CET/CEST)
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

  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const inThreeDays = new Date(now.getTime() + 3 * 86400_000).toISOString().slice(0, 10);

    // Lezioni dei gruppi nei prossimi giorni (filtro fine sull'orario dopo)
    const { data: schedules, error: schedErr } = await supabase
      .from("group_lesson_schedule")
      .select("id, group_id, lesson_number, lesson_date, lesson_time, lesson_title")
      .gte("lesson_date", today)
      .lte("lesson_date", inThreeDays);

    if (schedErr) return json({ error: schedErr.message }, 500);

    const windowStart = now.getTime() + 23 * 3600_000;
    const windowEnd = now.getTime() + 25 * 3600_000;

    const due = (schedules ?? []).filter((s) => {
      const startsAt = romeToUtc(s.lesson_date as string, s.lesson_time as string | null).getTime();
      return startsAt >= windowStart && startsAt < windowEnd;
    });

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const lesson of due) {
      // Gruppo + corso
      const { data: group } = await supabase
        .from("student_groups")
        .select("id, title, status, course:courses(title)")
        .eq("id", lesson.group_id as string)
        .maybeSingle();

      if (!group || group.status !== "active") { skipped++; continue; }

      // Alunni del gruppo → genitori
      const { data: members } = await supabase
        .from("group_students")
        .select("student_id")
        .eq("group_id", lesson.group_id as string);

      const studentIds = (members ?? []).map((m) => m.student_id as string);
      if (studentIds.length === 0) { skipped++; continue; }

      const { data: students } = await supabase
        .from("profiles")
        .select("id, full_name, parent_id")
        .in("id", studentIds);

      const parentIds = Array.from(
        new Set((students ?? []).map((s) => s.parent_id as string | null).filter(Boolean)),
      ) as string[];
      if (parentIds.length === 0) { skipped++; continue; }

      const courseTitle = (group as { course?: { title?: string } | null }).course?.title
        ?? group.title ?? "coding";
      const timeLabel = (lesson.lesson_time as string | null)?.slice(0, 5);
      const title = "Promemoria lezione TECHLAND";
      const body = timeLabel
        ? `Domani alle ${timeLabel} c'è la lezione di ${courseTitle}.`
        : `Domani c'è la lezione di ${courseTitle}.`;

      for (const parentId of parentIds) {
        // Anti-duplicato: registro prima dell'invio
        const { error: logErr } = await supabase.from("push_notification_log").insert({
          user_id: parentId,
          schedule_id: lesson.id as string,
          notification_type: "lesson_reminder_24h",
          title,
          body,
        });
        if (logErr) { skipped++; continue; } // già inviata

        const { data: devices } = await supabase
          .from("push_devices")
          .select("id, token")
          .eq("user_id", parentId);

        let ok = 0;
        let ko = 0;

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
                notification: { title, body },
                data: { path: "/area-riservata" },
              },
            }),
          });

          if (res.ok) {
            ok++;
            sent++;
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

        await supabase
          .from("push_notification_log")
          .update({ success_count: ok, failure_count: ko })
          .eq("user_id", parentId)
          .eq("schedule_id", lesson.id as string)
          .eq("notification_type", "lesson_reminder_24h");
      }
    }

    return json({ success: true, lessons: due.length, sent, skipped, errors });
  } catch (error) {
    console.error("[send-lesson-reminders]", error);
    return json({ error: error instanceof Error ? error.message : "Errore interno" }, 500);
  }
});
