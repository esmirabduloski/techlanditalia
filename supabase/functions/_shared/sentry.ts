/**
 * Sentry per le edge function, senza SDK: un `fetch` all'endpoint envelope.
 *
 * - captureServerError: errore di una funzione server (issue in Sentry).
 * - withCronMonitor: check-in Sentry Crons per i job pianificati. Il monitor si
 *   crea da solo al primo check-in (monitor_config) e Sentry apre una issue sia
 *   quando il job fallisce sia quando non arriva entro l'orario previsto.
 *
 * Best effort come _shared/adminpush.ts: non lancia mai e senza SENTRY_DSN è
 * un no-op. Il DSN è lo stesso (pubblico) di VITE_SENTRY_DSN del frontend.
 */

export interface Dsn {
  publicKey: string;
  envelopeUrl: string;
}

export interface CronMonitor {
  slug: string;
  /** Crontab UTC, uguale a quello del job pg_cron. */
  schedule: string;
  /** Minuti di tolleranza prima di considerare il check-in mancato. */
  marginMinutes?: number;
  /** Minuti oltre i quali un'esecuzione "in_progress" è considerata bloccata. */
  maxRuntimeMinutes?: number;
}

type CheckInStatus = "in_progress" | "ok" | "error";

const ENVIRONMENT = "production";

function env(name: string): string | undefined {
  // Letto da globalThis così i test Vitest (Node) possono simulare Deno.env
  const deno = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno;
  return deno?.env.get(name);
}

export function parseDsn(dsn: string | undefined | null): Dsn | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const parts = url.pathname.split("/").filter(Boolean);
    const projectId = parts.pop();
    if (!url.username || !projectId) return null;
    const prefix = parts.length ? `/${parts.join("/")}` : "";
    return {
      publicKey: url.username,
      envelopeUrl: `${url.protocol}//${url.host}${prefix}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
}

function uuid32(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function envelope(items: { type: string; payload: unknown }[]): string {
  const header = JSON.stringify({ sent_at: new Date().toISOString() });
  return [header, ...items.flatMap((i) => [JSON.stringify({ type: i.type }), JSON.stringify(i.payload)])].join("\n") + "\n";
}

export function buildCheckInEnvelope(
  monitor: CronMonitor,
  status: CheckInStatus,
  checkInId: string,
  durationSeconds?: number,
): string {
  return envelope([{
    type: "check_in",
    payload: {
      check_in_id: checkInId,
      monitor_slug: monitor.slug,
      status,
      environment: ENVIRONMENT,
      ...(durationSeconds !== undefined ? { duration: durationSeconds } : {}),
      monitor_config: {
        schedule: { type: "crontab", value: monitor.schedule },
        timezone: "UTC",
        checkin_margin: monitor.marginMinutes ?? 10,
        max_runtime: monitor.maxRuntimeMinutes ?? 10,
        failure_issue_threshold: 1,
        recovery_threshold: 1,
      },
    },
  }]);
}

export interface ErrorContext {
  /** Nome della edge function. */
  fn: string;
  level?: "error" | "warning";
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  /** Raggruppamento esplicito della issue (altrimenti decide Sentry). */
  fingerprint?: string[];
}

export function buildErrorEnvelope(error: unknown, ctx: ErrorContext): string {
  const err = error instanceof Error ? error : null;
  const message = err ? err.message : typeof error === "string" ? error : JSON.stringify(error);
  return envelope([{
    type: "event",
    payload: {
      event_id: uuid32(),
      timestamp: Date.now() / 1000,
      platform: "javascript",
      level: ctx.level ?? "error",
      environment: ENVIRONMENT,
      server_name: ctx.fn,
      transaction: ctx.fn,
      tags: { runtime: "edge", function: ctx.fn, ...ctx.tags },
      extra: { ...ctx.extra, ...(err?.stack ? { stack: err.stack } : {}) },
      ...(ctx.fingerprint ? { fingerprint: ctx.fingerprint } : {}),
      exception: { values: [{ type: err?.name ?? "Error", value: message }] },
    },
  }]);
}

async function send(body: string): Promise<void> {
  const dsn = parseDsn(env("SENTRY_DSN"));
  if (!dsn) {
    console.warn("[sentry] SENTRY_DSN non configurato, invio saltato");
    return;
  }
  try {
    const res = await fetch(`${dsn.envelopeUrl}?sentry_key=${dsn.publicKey}&sentry_version=7`, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.error(`[sentry] invio fallito ${res.status}: ${(await res.text()).slice(0, 200)}`);
  } catch (e) {
    console.error("[sentry] invio fallito:", e);
  }
}

export function captureServerError(error: unknown, ctx: ErrorContext): Promise<void> {
  console.error(`[${ctx.fn}]`, error);
  return send(buildErrorEnvelope(error, ctx));
}

/**
 * Esegue il job con i check-in Sentry Crons. `monitor` null (chiamata manuale di
 * un admin) = nessun check-in, ma le eccezioni vengono comunque riportate.
 * Il job è "error" se lancia o se risponde con uno status >= 400.
 */
export async function withCronMonitor(
  monitor: CronMonitor | null,
  fn: string,
  run: () => Promise<Response>,
): Promise<Response> {
  const checkInId = uuid32();
  const started = Date.now();
  if (monitor) await send(buildCheckInEnvelope(monitor, "in_progress", checkInId));

  const finish = (status: CheckInStatus) =>
    monitor ? send(buildCheckInEnvelope(monitor, status, checkInId, (Date.now() - started) / 1000)) : Promise.resolve();

  try {
    const res = await run();
    await finish(res.status >= 400 ? "error" : "ok");
    return res;
  } catch (error) {
    await Promise.all([finish("error"), captureServerError(error, { fn, tags: monitor ? { area: "cron" } : {} })]);
    throw error;
  }
}
