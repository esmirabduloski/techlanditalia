/**
 * Push agli admin quando il saldo lezioni di uno studente scende a 3.
 *
 * Chiamata solo dal trigger lesson_balance_low_alert su profiles
 * (drizzle/migrations/0029_lesson_balance_alert.sql) via pg_net, con header
 * x-cron-token. Il trigger scatta solo all'attraversamento della soglia, quindi
 * qui non serve evitare doppioni.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { notifyAdmins } from "../_shared/adminpush.ts";
import { captureServerError } from "../_shared/sentry.ts";
import { lowBalanceMessage } from "../_shared/lessonbalance.ts";

const FN = "lesson-balance-alert";

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const cronToken = req.headers.get("x-cron-token") ?? "";
  const { data: ok } = cronToken
    ? await supabase.rpc("verify_cron_token", { _name: FN, _token: cronToken })
    : { data: false };
  if (ok !== true) return json({ error: "Non autorizzato" }, 401);

  const body = await req.json().catch(() => ({}));
  const studentId = typeof body?.student_id === "string" ? body.student_id : null;
  const balance = Number(body?.balance);
  if (!studentId || !Number.isFinite(balance)) return json({ error: "student_id e balance obbligatori" }, 400);

  try {
    const { data: student, error } = await supabase
      .from("profiles").select("id, full_name, role, parent_id").eq("id", studentId).maybeSingle();
    if (error) throw error;
    if (!student || student.role !== "student") return json({ ok: true, skipped: "non è uno studente" });

    const [{ data: parent }, { data: groups }] = await Promise.all([
      student.parent_id
        ? supabase.from("profiles").select("full_name").eq("id", student.parent_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("group_students")
        .select("student_groups!inner(title, status, archived_at)")
        .eq("student_id", studentId)
        .eq("student_groups.status", "active")
        .is("student_groups.archived_at", null),
    ]);
    // Relazione many-to-one: PostgREST restituisce un oggetto, i tipi generici dicono array
    const groupTitles = ((groups ?? []) as unknown as { student_groups: { title: string } | null }[])
      .map((g) => g.student_groups?.title).filter(Boolean);

    const { title, body: text } = lowBalanceMessage({
      studentName: student.full_name || "Uno studente",
      balance,
      parentName: parent?.full_name ?? null,
      groupTitle: groupTitles.join(", ") || null,
    });
    await notifyAdmins({ title, body: text, path: "/admin/utenti", type: "lesson_balance_low", tag: `lesson-balance-${studentId}` });
    return json({ ok: true });
  } catch (err) {
    await captureServerError(err, { fn: FN, tags: { area: "push" }, extra: { student_id: studentId, balance } });
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
