/**
 * Avviso alla famiglia quando gli attestati di fine corso sono disponibili
 * (drizzle/migrations/0049_course_certificates.sql).
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
import { certificateMessage, studentPush, type CertificateMessage } from "../_shared/certificates.ts";

const FN = "certificates-released";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://techlanditalia.it").replace(/\/$/, "");
const SECTION_PATH = "/area-riservata#certificazioni";

type CertificateRow = {
  id: string;
  student_id: string;
  student_name: string;
  course_title: string;
  teacher_name: string;
  lessons_attended: number;
  hours_attended: number;
  student: { parent_id: string | null; email: string | null } | null;
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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
        message: { token: device.token, notification: { title, body }, data: { path: SECTION_PATH } },
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

async function sendEmail(to: string, msg: CertificateMessage): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    console.warn(`[${FN}] RESEND_API_KEY mancante, email non inviata`);
    return false;
  }
  const [hello, ...rest] = msg.paragraphs.map(escapeHtml);
  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" style="width:560px;max-width:100%;border-collapse:collapse;background:#ffffff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);padding:28px 24px;text-align:center;">
  <div style="font-size:40px;line-height:1;">🎓</div>
  <h1 style="color:#ffffff;margin:8px 0 0;font-size:22px;">${escapeHtml(msg.pushTitle.replace(/^🎓\s*/, ""))}</h1></td></tr>
  <tr><td style="padding:28px 24px;color:#1f2937;font-size:16px;line-height:1.6;">
  <p style="margin:0 0 16px;">${hello}</p>
  ${rest.map((p) => `<p style="margin:0 0 16px;">${p}</p>`).join("\n  ")}
  <p style="margin:8px 0 20px;text-align:center;"><a href="${SITE_URL}${SECTION_PATH}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">Scarica l'attestato →</a></p>
  <p style="margin:0;color:#4b5563;font-size:14px;">Per qualsiasi dubbio rispondi pure a questa email.</p>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Il Team TECHLAND · techlanditalia.it</td></tr>
  </table></td></tr></table></body></html>`;
  const text = [...msg.paragraphs, `${SITE_URL}${SECTION_PATH}`, "Il Team TECHLAND"].join("\n\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "TECHLAND <info@techlanditalia.it>",
      to: [to],
      reply_to: "info@techlanditalia.it",
      subject: msg.subject,
      html,
      text,
    }),
  });
  if (!res.ok) {
    await captureServerError(new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`), {
      fn: FN,
      fingerprint: [FN, "resend"],
    });
    return false;
  }
  return true;
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
        "id, student_id, student_name, course_title, teacher_name, lessons_attended, hours_attended, " +
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
        lessonsAttended: c.lessons_attended,
        hoursAttended: Number(c.hours_attended),
      });
      const pushed = await sendPush(supabase, recipientId, msg.pushTitle, msg.pushBody);
      let studentPushed = 0;
      if (parent) {
        const sp = studentPush({ studentName: c.student_name, courseTitle: c.course_title });
        studentPushed = await sendPush(supabase, c.student_id, sp.title, sp.body);
      }
      const mailed = email ? await sendEmail(email, msg) : false;
      if (mailed) emails++;
      pushes += pushed + studentPushed;

      const leadId = await familyLeadId(supabase, c.student_id, parentId);
      if (leadId) {
        await supabase.from("crm_interactions").insert({
          lead_id: leadId,
          admin_id: adminRole ? user.id : null,
          type: mailed ? "email" : "note",
          subject: `Attestato disponibile: ${c.student_name} – ${c.course_title}`,
          content: `${c.lessons_attended} lezioni, ${c.hours_attended} ore. ` +
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
