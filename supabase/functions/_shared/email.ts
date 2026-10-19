/**
 * Invio delle email con Resend e registro in public.email_log
 * (drizzle/migrations/0057_email_log.sql), letto dal centro di controllo
 * /admin/email.
 *
 * Il registro è best effort: se l'insert fallisce (es. migrazione non ancora
 * applicata) l'email parte lo stesso. Il corpo si salva solo per i tipi con
 * `storeBody` in emailkinds.ts. Non lancia mai: l'esito è nel valore restituito.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureServerError } from "./sentry.ts";
import { EMAIL_KINDS, type EmailKind } from "./emailkinds.ts";

export const DEFAULT_FROM = "TECHLAND <info@techlanditalia.it>";
export const REPLY_TO = "info@techlanditalia.it";

export type SendEmailOptions = {
  kind: EmailKind;
  /** Edge function che invia: nei log, su Sentry e in email_log.source. */
  source: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  /** Profilo del destinatario, se ha un account: la riga sparisce con l'account. */
  recipientId?: string | null;
  leadId?: string | null;
  /** Dati in più per Sentry se Resend rifiuta l'invio. */
  extra?: Record<string, unknown>;
};

export type SendEmailResult = { ok: true; id: string | null } | { ok: false; error: string };

let logClient: SupabaseClient | null = null;

function db(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  logClient ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return logClient;
}

async function logEmail(opts: SendEmailOptions, to: string[], result: SendEmailResult): Promise<void> {
  try {
    const client = db();
    if (!client) return;
    const { error } = await client.from("email_log").insert({
      kind: opts.kind,
      to_email: to.join(", ").slice(0, 1000),
      recipient_id: opts.recipientId ?? null,
      lead_id: opts.leadId ?? null,
      subject: opts.subject.slice(0, 500),
      html: EMAIL_KINDS[opts.kind].storeBody ? opts.html : null,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error.slice(0, 500),
      provider_id: result.ok ? result.id : null,
      source: opts.source,
    });
    if (error) console.error(`[${opts.source}] registro email non scritto:`, error.message);
  } catch (e) {
    console.error(`[${opts.source}] registro email non scritto:`, e);
  }
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const to = (Array.isArray(opts.to) ? opts.to : [opts.to]).map((t) => t.trim()).filter(Boolean);
  let result: SendEmailResult;
  const key = Deno.env.get("RESEND_API_KEY");
  if (to.length === 0) {
    return { ok: false, error: "nessun destinatario" };
  } else if (!key) {
    console.warn(`[${opts.source}] RESEND_API_KEY mancante, email non inviata`);
    result = { ok: false, error: "RESEND_API_KEY mancante" };
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: opts.from ?? DEFAULT_FROM,
          to,
          subject: opts.subject,
          html: opts.html,
          ...(opts.text ? { text: opts.text } : {}),
          ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
          ...(opts.headers ? { headers: opts.headers } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null) as { id?: string } | null;
        result = { ok: true, id: data?.id ?? null };
      } else {
        result = { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
      }
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (!result.ok) {
      await captureServerError(new Error(result.error), {
        fn: opts.source,
        extra: { kind: opts.kind, ...opts.extra },
        fingerprint: [opts.source, "resend"],
      });
    }
  }
  await logEmail(opts, to, result);
  return result;
}
