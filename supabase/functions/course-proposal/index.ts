/**
 * Proposta del corso successivo (drizzle/migrations/0036_course_proposals.sql).
 *
 * Tre azioni, tutte con il JWT dell'utente:
 *   - submitted (insegnante): dopo aver salvato le bozze di un gruppo avvisa
 *     gli admin con una push e annota la bozza nella timeline del lead;
 *   - send (admin con 2FA): invia la bozza alla famiglia, email + push, con lo
 *     sconto e la scadenza scelti dall'admin;
 *   - respond (genitore, o l'alunno senza genitore): "continuiamo" o "ne
 *     parliamo". Lo sconto vale solo se la risposta arriva entro la scadenza.
 *     Gli admin ricevono una push e la risposta finisce nella timeline.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { decodeClaims, mfaRequiredResponse } from "../_shared/mfa.ts";
import { captureServerError } from "../_shared/sentry.ts";
import { notifyAdmins } from "../_shared/adminpush.ts";
import { romeToday } from "../_shared/subscriptionpause.ts";
import { discountStillValid, formatDate, formatEuro, proposalMessage, type ProposalMessage } from "../_shared/courseproposal.ts";

const FN = "course-proposal";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://techlanditalia.it").replace(/\/$/, "");

type ProposalRow = {
  id: string;
  student_id: string;
  group_id: string;
  status: string;
  teacher_reason: string;
  discount_cents: number;
  offer_expires_on: string | null;
  created_by: string | null;
  student: { full_name: string; email: string | null; parent_id: string | null } | null;
  group: { title: string; teacher_id: string | null; course: { title: string } | null } | null;
  course: { title: string } | null;
};

const PROPOSAL_SELECT =
  "id, student_id, group_id, status, teacher_reason, discount_cents, offer_expires_on, created_by, " +
  "student:profiles!course_proposals_student_id_fkey(full_name, email, parent_id), " +
  "group:student_groups!course_proposals_group_id_fkey(title, teacher_id, course:courses(title)), " +
  "course:courses!course_proposals_proposed_course_id_fkey(title)";

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
        message: { token: device.token, notification: { title, body }, data: { path: "/area-riservata" } },
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

async function sendEmail(to: string, msg: ProposalMessage, discountCents: number, expiresOn: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    console.warn(`[${FN}] RESEND_API_KEY mancante, email non inviata`);
    return false;
  }
  const [hello, intro, offer, cta] = msg.paragraphs.map(escapeHtml);
  const badge = discountCents > 0
    ? `<tr><td style="padding:0 24px 8px;"><div style="background:#ecfdf5;border:2px dashed #10b981;border-radius:12px;padding:16px;text-align:center;">
       <div style="font-size:28px;font-weight:bold;color:#047857;">-${escapeHtml(formatEuro(discountCents))}</div>
       <div style="font-size:14px;color:#065f46;">per chi conferma entro il ${escapeHtml(formatDate(expiresOn))}</div></div></td></tr>`
    : "";
  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" style="width:560px;max-width:100%;border-collapse:collapse;background:#ffffff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);padding:28px 24px;text-align:center;">
  <h1 style="color:#ffffff;margin:0;font-size:22px;">${escapeHtml(msg.pushTitle)}</h1></td></tr>
  <tr><td style="padding:28px 24px 8px;color:#1f2937;font-size:16px;line-height:1.6;">
  <p style="margin:0 0 16px;">${hello}</p>
  <p style="margin:0 0 16px;">${intro}</p>
  <blockquote style="margin:0 0 16px;padding:12px 16px;border-left:4px solid #10b981;background:#f9fafb;font-style:italic;">
  ${escapeHtml(msg.quote).replace(/\n/g, "<br>")}<br><span style="font-style:normal;color:#6b7280;font-size:14px;">— ${escapeHtml(msg.quoteAuthor)}</span></blockquote>
  </td></tr>
  ${badge}
  <tr><td style="padding:8px 24px 28px;color:#1f2937;font-size:16px;line-height:1.6;">
  <p style="margin:0 0 16px;">${offer}</p>
  <p style="margin:0 0 20px;">${cta}</p>
  <p style="margin:0 0 20px;text-align:center;"><a href="${SITE_URL}/area-riservata" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">Rispondi alla proposta →</a></p>
  <p style="margin:0;color:#4b5563;font-size:14px;">Per qualsiasi dubbio rispondi pure a questa email.</p>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Il Team TECHLAND · techlanditalia.it</td></tr>
  </table></td></tr></table></body></html>`;

  const text = [...msg.paragraphs.slice(0, 2), `"${msg.quote}" — ${msg.quoteAuthor}`, ...msg.paragraphs.slice(2),
    `${SITE_URL}/area-riservata`, "Il Team TECHLAND"].join("\n\n");

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

async function loadProposal(supabase: SupabaseClient, id: string): Promise<ProposalRow | null> {
  const { data, error } = await supabase.from("course_proposals").select(PROPOSAL_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(`course_proposals: ${error.message}`);
  // Relazioni many-to-one: PostgREST restituisce oggetti, i tipi generici dicono array
  return data as unknown as ProposalRow | null;
}

async function teacherName(supabase: SupabaseClient, teacherId: string | null): Promise<string> {
  if (!teacherId) return "Il tuo insegnante";
  const { data } = await supabase.from("profiles").select("full_name").eq("id", teacherId).maybeSingle();
  return (data?.full_name as string | undefined)?.trim() || "Il tuo insegnante";
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

  let body: { action?: string; proposal_id?: string; group_id?: string; accept?: boolean; note?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Richiesta non valida" }, 400);
  }

  try {
    // ── Insegnante: bozze pronte, avvisa gli admin ──────────────────────────
    if (body.action === "submitted") {
      if (!body.group_id) return json({ error: "group_id mancante" }, 400);
      const { data: isTeacher } = await supabase.rpc("is_teacher_of_group", { _teacher_id: user.id, _group_id: body.group_id });
      if (isTeacher !== true) return json({ error: "Non autorizzato" }, 403);

      const { data: drafts } = await supabase
        .from("course_proposals")
        .select("id, student_id, student:profiles!course_proposals_student_id_fkey(full_name, parent_id), group:student_groups!course_proposals_group_id_fkey(title)")
        .eq("group_id", body.group_id).eq("status", "draft");
      const rows = (drafts ?? []) as unknown as {
        id: string; student_id: string;
        student: { full_name: string; parent_id: string | null } | null;
        group: { title: string } | null;
      }[];
      if (rows.length === 0) return json({ ok: true, drafts: 0 });

      const author = await teacherName(supabase, user.id);
      let firstLead: string | null = null;
      for (const r of rows) {
        const leadId = await familyLeadId(supabase, r.student_id, r.student?.parent_id ?? null);
        if (!leadId) continue;
        firstLead ??= leadId;
        // Una sola nota per bozza, anche se l'insegnante salva più volte
        const { data: already } = await supabase
          .from("crm_interactions").select("id").eq("lead_id", leadId)
          .contains("metadata", { course_proposal_id: r.id, step: "draft" }).limit(1);
        if (already && already.length > 0) continue;
        await supabase.from("crm_interactions").insert({
          lead_id: leadId,
          type: "note",
          subject: `Proposta prossimo corso da inviare: ${r.student?.full_name ?? "studente"}`,
          content: `${author} ha scritto la proposta a fine corso. Scegli sconto e scadenza e inviala dalla sezione "Prossimo corso".`,
          metadata: { course_proposal_id: r.id, step: "draft" },
        });
      }
      const groupTitle = rows[0].group?.title ?? "un gruppo";
      await notifyAdmins({
        title: rows.length === 1 ? "Proposta prossimo corso da inviare" : `${rows.length} proposte prossimo corso da inviare`,
        body: `${author} (${groupTitle}): scegli lo sconto e inviala alla famiglia.`,
        path: rows.length === 1 && firstLead ? `/admin/crm?lead=${firstLead}` : "/admin/crm",
        type: "course_proposal_draft",
        tag: `course-proposal-${body.group_id}`,
      });
      return json({ ok: true, drafts: rows.length });
    }

    // ── Admin: invio alla famiglia ──────────────────────────────────────────
    if (body.action === "send") {
      const { data: role } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!role) return json({ error: "Non autorizzato" }, 403);
      if (decodeClaims(token).aal !== "aal2") return mfaRequiredResponse(corsHeaders);
      if (!body.proposal_id) return json({ error: "proposal_id mancante" }, 400);

      const p = await loadProposal(supabase, body.proposal_id);
      if (!p) return json({ error: "Proposta non trovata" }, 404);
      if (p.status !== "draft") return json({ error: "La proposta è già stata inviata" }, 409);
      if (!p.offer_expires_on || p.offer_expires_on < romeToday()) {
        return json({ error: "Imposta una scadenza dell'offerta da oggi in poi" }, 400);
      }

      const parentId = p.student?.parent_id ?? null;
      const { data: parent } = parentId
        ? await supabase.from("profiles").select("id, full_name, email").eq("id", parentId).maybeSingle()
        : { data: null };
      const recipientId = (parent?.id as string | undefined) ?? p.student_id;
      const email = ((parent?.email as string | null | undefined) ?? p.student?.email)?.trim();

      // Segna prima di inviare: due clic ravvicinati mandano una sola email
      const { data: claimed } = await supabase
        .from("course_proposals")
        .update({ status: "sent", sent_at: new Date().toISOString(), sent_by: user.id })
        .eq("id", p.id).eq("status", "draft")
        .select("id");
      if (!claimed || claimed.length === 0) return json({ error: "La proposta è già stata inviata" }, 409);

      const studentName = p.student?.full_name || "lo studente";
      const msg = proposalMessage({
        parentName: (parent?.full_name as string | undefined) ?? null,
        studentName,
        teacherName: await teacherName(supabase, p.group?.teacher_id ?? p.created_by),
        fromCourse: p.group?.course?.title ?? p.group?.title ?? "in corso",
        proposedCourse: p.course?.title ?? "il prossimo corso",
        reason: p.teacher_reason,
        discountCents: p.discount_cents,
        expiresOn: p.offer_expires_on,
      });
      const pushed = await sendPush(supabase, recipientId, msg.pushTitle, msg.pushBody);
      const mailed = email ? await sendEmail(email, msg, p.discount_cents, p.offer_expires_on) : false;
      if (mailed) {
        await supabase.from("course_proposals").update({ email_sent_at: new Date().toISOString() }).eq("id", p.id);
      }

      const leadId = await familyLeadId(supabase, p.student_id, parentId);
      if (leadId) {
        const discount = p.discount_cents > 0 ? `sconto ${formatEuro(p.discount_cents)}` : "senza sconto";
        await supabase.from("crm_interactions").insert({
          lead_id: leadId,
          admin_id: user.id,
          type: mailed ? "email" : "note",
          subject: `Proposta inviata: ${studentName} → ${p.course?.title ?? "prossimo corso"}`,
          content: `${discount}, valida fino al ${formatDate(p.offer_expires_on)}. ` +
            (mailed ? "Email inviata" : "Email NON inviata (manca l'indirizzo o errore)") +
            (pushed ? `, push su ${pushed} dispositivi.` : ", nessuna push."),
          metadata: { course_proposal_id: p.id, step: "sent" },
        });
      }
      return json({ ok: true, email_sent: mailed, push_sent: pushed });
    }

    // ── Famiglia: risposta ──────────────────────────────────────────────────
    if (body.action === "respond") {
      if (!body.proposal_id || typeof body.accept !== "boolean") return json({ error: "Richiesta non valida" }, 400);
      const note = (body.note ?? "").trim().slice(0, 1000) || null;

      const p = await loadProposal(supabase, body.proposal_id);
      if (!p) return json({ error: "Proposta non trovata" }, 404);
      const isFamily = p.student_id === user.id || (!!p.student?.parent_id && p.student.parent_id === user.id);
      if (!isFamily) return json({ error: "Non autorizzato" }, 403);
      if (p.status !== "sent") return json({ error: "Hai già risposto a questa proposta" }, 409);

      const discountApplies = body.accept &&
        discountStillValid({ today: romeToday(), expiresOn: p.offer_expires_on, discountCents: p.discount_cents });
      const { data: updated } = await supabase
        .from("course_proposals")
        .update({
          status: body.accept ? "accepted" : "declined",
          responded_at: new Date().toISOString(),
          responded_by: user.id,
          discount_applies: discountApplies,
          parent_note: note,
        })
        .eq("id", p.id).eq("status", "sent")
        .select("id");
      if (!updated || updated.length === 0) return json({ error: "Hai già risposto a questa proposta" }, 409);

      const studentName = p.student?.full_name || "Lo studente";
      const courseTitle = p.course?.title ?? "il prossimo corso";
      const leadId = await familyLeadId(supabase, p.student_id, p.student?.parent_id ?? null);
      const subject = body.accept
        ? `La famiglia conferma: ${studentName} continua con ${courseTitle}`
        : `La famiglia vuole parlarne: ${studentName} (${courseTitle})`;
      const detail = body.accept
        ? (discountApplies ? `Sconto di ${formatEuro(p.discount_cents)} da applicare al prossimo pagamento.` : "Confermato dopo la scadenza: niente sconto.")
        : "Da richiamare per capire dubbi o alternative.";
      if (leadId) {
        await supabase.from("crm_interactions").insert({
          lead_id: leadId,
          type: "status_change",
          subject,
          content: note ? `${detail}\nNota della famiglia: ${note}` : detail,
          metadata: { course_proposal_id: p.id, step: body.accept ? "accepted" : "declined", discount_applies: discountApplies },
        });
      }
      await notifyAdmins({
        title: body.accept ? "Iscrizione al prossimo corso confermata" : "Proposta prossimo corso: da richiamare",
        body: `${studentName} → ${courseTitle}. ${detail}`,
        path: leadId ? `/admin/crm?lead=${leadId}` : "/admin/crm",
        type: "course_proposal_response",
        tag: `course-proposal-${p.id}`,
      });
      return json({ ok: true, status: body.accept ? "accepted" : "declined", discount_applies: discountApplies });
    }

    return json({ error: "Azione non valida" }, 400);
  } catch (err) {
    await captureServerError(err, { fn: FN });
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
