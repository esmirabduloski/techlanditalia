#!/usr/bin/env node
/**
 * Crea o aggiorna le regole di avviso Sentry per cron e funzioni server.
 *
 * Idempotente: le regole sono riconosciute per nome, rilanciarlo aggiorna
 * quelle esistenti invece di duplicarle.
 *
 * Uso:  SENTRY_AUTH_TOKEN=... npm run sentry:alerts
 *
 * Il token (Sentry → Settings → Auth Tokens, scope project:read + alerts:write)
 * non va salvato nel repo. Organizzazione e progetto si ricavano dal DSN
 * (VITE_SENTRY_DSN in .env); si possono forzare con SENTRY_ORG / SENTRY_PROJECT.
 * SENTRY_URL serve solo se l'organizzazione non è nella regione EU.
 *
 * Le issue arrivano da:
 *   - Sentry Crons (tag monitor.slug): check-in falliti o mancati dei job;
 *   - cron-health-check (tag area=cron): job spariti, fermi, chiamate fallite;
 *   - captureServerError nelle edge function (tag runtime=edge).
 */
import { readFileSync } from "node:fs";

const token = process.env.SENTRY_AUTH_TOKEN;
if (!token) {
  console.error("Manca SENTRY_AUTH_TOKEN");
  process.exit(1);
}

function dsnFromEnvFile() {
  try {
    const line = readFileSync(new URL("../.env", import.meta.url), "utf8")
      .split("\n").find((l) => l.startsWith("VITE_SENTRY_DSN="));
    return line?.slice("VITE_SENTRY_DSN=".length).replace(/^"|"$/g, "").trim();
  } catch {
    return undefined;
  }
}

const dsn = new URL(process.env.VITE_SENTRY_DSN || dsnFromEnvFile() || "https://x@o0.ingest.sentry.io/0");
const BASE = (process.env.SENTRY_URL || (dsn.host.includes(".de.") ? "https://de.sentry.io" : "https://sentry.io")).replace(/\/$/, "");
const org = process.env.SENTRY_ORG || dsn.host.match(/^o(\d+)\./)?.[1];
const projectId = dsn.pathname.split("/").filter(Boolean).pop();

async function api(path, init = {}) {
  const res = await fetch(`${BASE}/api/0${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function resolveProject() {
  if (process.env.SENTRY_PROJECT) return process.env.SENTRY_PROJECT;
  const projects = await api(`/organizations/${org}/projects/`);
  const match = projects.find((p) => p.id === projectId);
  if (!match) throw new Error(`Progetto ${projectId} non trovato nell'organizzazione ${org}: imposta SENTRY_PROJECT`);
  return match.slug;
}

const tag = (key, match, value) => ({
  id: "sentry.rules.filters.tagged_event.TaggedEventFilter",
  key,
  match,
  ...(value !== undefined ? { value } : {}),
});
const FIRST_SEEN = { id: "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition" };
const REGRESSION = { id: "sentry.rules.conditions.regression_event.RegressionEventCondition" };
const REAPPEARED = { id: "sentry.rules.conditions.reappeared_event.ReappearedEventCondition" };
const EMAIL = {
  id: "sentry.mail.actions.NotifyEmailAction",
  targetType: "IssueOwners",
  fallthroughType: "ActiveMembers",
};

const RULES = [
  {
    name: "Cron: job fallito o mancato",
    actionMatch: "any",
    filterMatch: "all",
    frequency: 60,
    conditions: [FIRST_SEEN, REGRESSION, REAPPEARED],
    filters: [tag("monitor.slug", "is")],
    actions: [EMAIL],
  },
  {
    name: "Cron: controllo salute",
    actionMatch: "any",
    filterMatch: "all",
    frequency: 60,
    conditions: [FIRST_SEEN, REGRESSION, REAPPEARED],
    filters: [tag("area", "eq", "cron")],
    actions: [EMAIL],
  },
  {
    name: "Funzioni server: errori",
    actionMatch: "any",
    filterMatch: "all",
    frequency: 60,
    conditions: [
      FIRST_SEEN,
      REGRESSION,
      { id: "sentry.rules.conditions.event_frequency.EventFrequencyCondition", value: 3, interval: "1h" },
    ],
    filters: [tag("runtime", "eq", "edge")],
    actions: [EMAIL],
  },
];

const project = await resolveProject();
const existing = await api(`/projects/${org}/${project}/rules/`);

for (const rule of RULES) {
  const current = existing.find((r) => r.name === rule.name);
  if (current) {
    await api(`/projects/${org}/${project}/rules/${current.id}/`, { method: "PUT", body: JSON.stringify(rule) });
    console.log(`✓ aggiornata: ${rule.name}`);
  } else {
    await api(`/projects/${org}/${project}/rules/`, { method: "POST", body: JSON.stringify(rule) });
    console.log(`✓ creata: ${rule.name}`);
  }
}
console.log(`Regole sul progetto ${project} (${BASE})`);
