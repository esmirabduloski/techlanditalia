import { existsSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * Il file .env è nel repository: lo committa Lovable e serve alla build. Contiene
 * solo chiavi pubbliche, che finiscono comunque nel bundle del sito. Questo test
 * fallisce se qualcuno ci aggiunge un segreto (service role, chiavi Stripe, ...),
 * che va invece nei secret delle edge function.
 *
 * Nei messaggi d'errore compaiono solo i NOMI delle variabili, mai i valori.
 */
const ENV_FILE = path.resolve(__dirname, "../.env");

/** Variabili non VITE_ ammesse (lette da script di build, sempre pubbliche). */
const ALLOWED_NON_VITE = new Set(["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]);
const SECRET_NAME = /SERVICE_ROLE|SECRET|PRIVATE|PASSWORD|_TOKEN\b/i;
const SECRET_VALUE = /^(sk|rk)_(live|test)_|^sb_secret_|^re_[A-Za-z0-9]{8,}|-----BEGIN/;

function readEnv(): [string, string][] {
  return readFileSync(ENV_FILE, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    });
}

/** Ruolo dichiarato in una chiave JWT di Supabase (anon / service_role). */
function jwtRole(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

describe.runIf(existsSync(ENV_FILE))(".env contiene solo valori pubblici", () => {
  const vars = readEnv();

  it("solo variabili VITE_ o pubbliche note", () => {
    const unknown = vars.map(([k]) => k).filter((k) => !k.startsWith("VITE_") && !ALLOWED_NON_VITE.has(k));
    expect(unknown, "variabili non previste nel .env").toEqual([]);
  });

  it("nessun nome da segreto", () => {
    expect(vars.map(([k]) => k).filter((k) => SECRET_NAME.test(k)), "nomi sospetti").toEqual([]);
  });

  it("nessun valore da segreto (Stripe, Resend, chiavi private, service role)", () => {
    const leaked = vars
      .filter(([, v]) => SECRET_VALUE.test(v) || jwtRole(v) === "service_role")
      .map(([k]) => k);
    expect(leaked, "variabili con un valore segreto").toEqual([]);
  });
});
