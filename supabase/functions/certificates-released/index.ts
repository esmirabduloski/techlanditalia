/**
 * Avviso alla famiglia quando gli attestati di fine corso sono disponibili
 * (drizzle/migrations/0050_course_certificates.sql).
 *
 * La chiama l'insegnante del gruppo (o un admin), con verifica in due
 * passaggi, subito dopo release_group_certificates(). Per ogni attestato non
 * ancora notificato:
 *   - email + push al genitore (o all'alunno senza genitore collegato);
 *   - push all'alunno con genitore collegato;
 *   - una nota nella timeline del lead della famiglia.
 * Ripeterla non manda doppioni: notified_at segna gli attestati già avvisati.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { decodeClaims, mfaRequiredResponse } from "../_shared/mfa.ts";
import { captureServerError } from "../_shared/sentry.ts";
import { certificateEmail, certificateMessage, CERTIFICATES_PATH, studentPush } from "../_shared/certificates.ts";
import { REPLY_TO, sendEmail } from "../_shared/email.ts";

const FN = "certificates-released";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://techlanditalia.it").replace(/\/$/, "");

type CertificateRow = {
  id: string;
  student_id: string;
  student_name: string;
  course_title: string;
  teacher_name: string;
  lessons_attended: number;
  student: { parent_id: string | null; email: string | null } | null;
};

async function sendPush(supabase: SupabaseClient, userId: string, title: string, body: string): Promise<number> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const CONNECTION_KEY = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
  if (!LOVABLE_API_KEY || !CONNECTION_KEY) return 0;

  const { data: devices } = await supabase.from("push_devices").select("id, token").eq("user_id", userId);
  let ok = 0;
  for (const device of devices ?? []) {
    const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": CONNECTION_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: { token: device.token, notification: { title, body }, data: { path: CERTIFICATES_PATH } },
      }),
    });
    if (res.ok) {
      ok++;
    } else {
      const text = await res.text();
      console.error(`[${FN}] FCM ${res.status}: ${text}`);
      if (res.status === 404 || res.status === 400) {
        await supabase.from("push_devices").delete().eq("id", device.id as string);
      }
    }
  }
  return ok;
}

/** Lead della famiglia: prima quello collegato al genitore, poi all'alunno. */
async function familyLeadId(supabase: SupabaseClient, studentId: string, parentId: string | null): Promise<string | null> {
  for (const pid of [parentId, studentId]) {
    if (!pid) continue;
    const { data } = await supabase
      .from("crm_leads").select("id").eq("linked_profile_id", pid).is("deleted_at", null)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (data) return data.id as string;
  }
  return null;
}

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

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Non autorizzato" }, 401);
  const token = auth.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return json({ error: "Non autorizzato" }, 401);

  let body: { group_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Richiesta non valida" }, 400);
  }
  if (!body.group_id) return json({ error: "group_id mancante" }, 400);

  try {
    const [{ data: isTeacher }, { data: adminRole }] = await Promise.all([
      supabase.rpc("is_teacher_of_group", { _teacher_id: user.id, _group_id: body.group_id }),
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle(),
    ]);
    if (isTeacher !== true && !adminRole) return json({ error: "Non autorizzato" }, 403);
    // Insegnanti e admin hanno sempre la verifica in due passaggi (public.mfa_required)
    if (decodeClaims(token).aal !== "aal2") return mfaRequiredResponse(corsHeaders);

    // Prende in carico gli attestati da avvisare: due chiamate ravvicinate non mandano doppioni
    const { data: claimed, error } = await supabase
      .from("course_certificates")
      .update({ notified_at: new Date().toISOString() })
      .eq("group_id", body.group_id)
      .is("notified_at", null)
      .select(
        "id, student_id, student_name, course_title, teacher_name, lessons_attended, " +
          "student:profiles!course_certificates_student_id_fkey(parent_id, email)",
      );
    if (error) throw new Error(`course_certificates: ${error.message}`);
    const rows = (claimed ?? []) as unknown as CertificateRow[];

    let emails = 0;
    let pushes = 0;
    for (const c of rows) {
      const parentId = c.student?.parent_id ?? null;
      const { data: parent } = parentId
        ? await supabase.from("profiles").select("id, full_name, email").eq("id", parentId).maybeSingle()
        : { data: null };
      const recipientId = (parent?.id as string | undefined) ?? c.student_id;
      const email = ((parent?.email as string | null | undefined) ?? c.student?.email)?.trim();

      const msg = certificateMessage({
        parentName: (parent?.full_name as string | undefined) ?? null,
        studentName: c.student_name,
        courseTitle: c.course_title,
        teacherName: c.teacher_name,
      });
      const pushed = await sendPush(supabase, recipientId, msg.pushTitle, msg.pushBody);
      let studentPushed = 0;
      if (parent) {
        const sp = studentPush({ studentName: c.student_name, courseTitle: c.course_title });
        studentPushed = await sendPush(supabase, c.student_id, sp.title, sp.body);
      }
      const leadId = await familyLeadId(supabase, c.student_id, parentId);
      const mailed = email
        ? (await sendEmail({
          kind: "certificate_released",
          source: FN,
          to: email,
          replyTo: REPLY_TO,
          recipientId,
          leadId,
          ...certificateEmail(msg, SITE_URL),
        })).ok
        : false;
      if (mailed) emails++;
      pushes += pushed + studentPushed;

      if (leadId) {
        await supabase.from("crm_interactions").insert({
          lead_id: leadId,
          admin_id: adminRole ? user.id : null,
          type: mailed ? "email" : "note",
          subject: `Attestato disponibile: ${c.student_name} – ${c.course_title}`,
          content: `Presenze nel registro: ${c.lessons_attended}. ` +
            (mailed ? "Email inviata" : "Email NON inviata (manca l'indirizzo o errore)") +
            (pushed + studentPushed ? `, push su ${pushed + studentPushed} dispositivi.` : ", nessuna push."),
          metadata: { course_certificate_id: c.id, step: "released" },
        });
      }
    }
    return json({ ok: true, certificates: rows.length, emails, pushes });
  } catch (e) {
    await captureServerError(e, { fn: FN, extra: { groupId: body.group_id } });
    return json({ error: "Errore durante l'invio degli avvisi" }, 500);
  }
});
