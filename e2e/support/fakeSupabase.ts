/**
 * Supabase finto per i test end-to-end.
 *
 * L'app gira con VITE_SUPABASE_URL = FAKE_SUPABASE_URL (vedi playwright.config.ts):
 * ogni richiesta verso quell'host viene intercettata nel browser e servita da qui,
 * con un database in memoria per test. Nessuna chiamata arriva al progetto vero.
 *
 * Copre solo quello che serve ai flussi testati:
 * - PostgREST: select con filtri eq/neq/in/is/gt/gte/lt/lte, order, limit,
 *   single/maybeSingle, insert, upsert (on_conflict), update, delete, rpc;
 * - Auth: utente da token, refresh, logout (sessioni = JWT non firmati);
 * - Edge function: handler per nome, con registro delle chiamate;
 * - Realtime: websocket accettato e lasciato muto.
 *
 * Le select non proiettano le colonne: tornano le righe intere. Le risorse
 * annidate (es. `lessons(courses(...))`) vanno messe già dentro la riga nel seed.
 */
import type { Page, Route } from "@playwright/test";
import { randomUUID } from "node:crypto";

export const FAKE_SUPABASE_URL = "https://supabase.e2e.test";
/** Chiave in localStorage dove supabase-js tiene la sessione (sb-<ref>-auth-token). */
export const AUTH_STORAGE_KEY = `sb-${new URL(FAKE_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

type Row = Record<string, unknown>;
type Json = unknown;

export interface FakeUser {
  id: string;
  email: string;
  password: string;
  /** Nome utente per il login degli alunni (oltre all'email). */
  username?: string;
  fullName?: string;
}

export interface FunctionCall {
  name: string;
  body: Json;
  authorization: string | null;
}

type FunctionHandler = (body: Json, ctx: { fake: FakeSupabase; userId: string | null }) =>
  | { status?: number; body: Json }
  | Promise<{ status?: number; body: Json }>;

type RpcHandler = (args: Json, ctx: { fake: FakeSupabase; userId: string | null }) => Json;

// ---------------------------------------------------------------------------
// Sessioni

const b64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");

function makeJwt(user: FakeUser) {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64url({ alg: "HS256", typ: "JWT" }),
    b64url({
      sub: user.id,
      email: user.email,
      role: "authenticated",
      aud: "authenticated",
      aal: "aal1",
      amr: [{ method: "password", timestamp: now }],
      session_id: randomUUID(),
      iat: now,
      exp: now + 3600,
    }),
    "firma-finta",
  ].join(".");
}

function userJson(user: FakeUser) {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: user.fullName ?? "" },
    identities: [],
    factors: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// Filtri PostgREST

const RESERVED_PARAMS = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function getPath(row: Row, path: string): unknown {
  return path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Row)[k] : undefined), row);
}

function parseList(raw: string): string[] {
  // in.(a,b,"c d")
  return raw
    .replace(/^\(|\)$/g, "")
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""));
}

function matches(value: unknown, expr: string): boolean {
  let negate = false;
  if (expr.startsWith("not.")) {
    negate = true;
    expr = expr.slice(4);
  }
  const dot = expr.indexOf(".");
  const op = expr.slice(0, dot);
  const arg = decodeURIComponent(expr.slice(dot + 1));
  const str = value === null || value === undefined ? null : String(value);
  let ok: boolean;
  switch (op) {
    case "eq": ok = str === arg; break;
    case "neq": ok = str !== arg; break;
    case "in": ok = str !== null && parseList(arg).includes(str); break;
    case "is":
      ok = arg === "null" ? value === null || value === undefined : str === arg;
      break;
    case "gt": ok = str !== null && compare(value, arg) > 0; break;
    case "gte": ok = str !== null && compare(value, arg) >= 0; break;
    case "lt": ok = str !== null && compare(value, arg) < 0; break;
    case "lte": ok = str !== null && compare(value, arg) <= 0; break;
    case "like":
    case "ilike": {
      const re = new RegExp(`^${arg.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[*%]/g, ".*")}$`, op === "ilike" ? "i" : "");
      ok = str !== null && re.test(str);
      break;
    }
    default:
      // Operatori non gestiti (or, cs, fts...): non filtrano.
      ok = true;
  }
  return negate ? !ok : ok;
}

function compare(value: unknown, arg: string) {
  if (typeof value === "number") return value - Number(arg);
  return String(value).localeCompare(arg);
}

function applyQuery(rows: Row[], params: URLSearchParams): Row[] {
  let out = rows.filter((row) => {
    for (const [key, expr] of params) {
      if (RESERVED_PARAMS.has(key) || key === "or" || key === "and") continue;
      if (!matches(getPath(row, key), expr)) return false;
    }
    return true;
  });
  const order = params.get("order");
  if (order) {
    const specs = order.split(",").map((s) => {
      const [col, dir] = s.split(".");
      return { col, desc: dir === "desc" };
    });
    out = [...out].sort((a, b) => {
      for (const { col, desc } of specs) {
        const av = a[col] as never;
        const bv = b[col] as never;
        if (av === bv) continue;
        const c = av < bv ? -1 : 1;
        return desc ? -c : c;
      }
      return 0;
    });
  }
  const offset = Number(params.get("offset") ?? 0);
  const limit = params.get("limit");
  return out.slice(offset, limit ? offset + Number(limit) : undefined);
}

// Immagine 1x1 servita per i file firmati, così il browser la carica davvero
const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

// ---------------------------------------------------------------------------

export class FakeSupabase {
  readonly tables = new Map<string, Row[]>();
  readonly users: FakeUser[] = [];
  readonly functionCalls: FunctionCall[] = [];
  /** File nello storage finto, come "<bucket>/<percorso>": caricati dall'app o messi dai test. */
  readonly storageObjects = new Set<string>();
  readonly storageCalls: { method: string; path: string }[] = [];
  private readonly functions = new Map<string, FunctionHandler>();
  private readonly rpcs = new Map<string, RpcHandler>();
  private readonly tokens = new Map<string, FakeUser>();

  constructor() {
    // Default dell'area riservata: niente 2FA richiesta, nessun consenso in sospeso.
    this.rpc("my_mfa_required", () => false);
    this.rpc("pending_legal_consents", () => []);
    this.rpc("get_my_crm_payments", () => []);
  }

  // --- Setup dai test ------------------------------------------------------

  table(name: string): Row[] {
    if (!this.tables.has(name)) this.tables.set(name, []);
    return this.tables.get(name)!;
  }

  seed(name: string, rows: Row[]) {
    this.table(name).push(...rows.map((r) => ({ id: randomUUID(), created_at: new Date().toISOString(), ...r })));
    return this;
  }

  addUser(user: FakeUser) {
    this.users.push(user);
    return this;
  }

  fn(name: string, handler: FunctionHandler) {
    this.functions.set(name, handler);
    return this;
  }

  rpc(name: string, handler: RpcHandler) {
    this.rpcs.set(name, handler);
    return this;
  }

  callsTo(name: string) {
    return this.functionCalls.filter((c) => c.name === name);
  }

  /** Sessione valida per `user`, nel formato restituito da Supabase Auth. */
  createSession(user: FakeUser) {
    const access_token = makeJwt(user);
    const refresh_token = randomUUID();
    this.tokens.set(access_token, user);
    this.tokens.set(`refresh:${refresh_token}`, user);
    return {
      access_token,
      refresh_token,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: userJson(user),
    };
  }

  /** Mette l'utente già loggato prima che la pagina parta. */
  async signInBeforeLoad(page: Page, user: FakeUser) {
    const session = this.createSession(user);
    await page.addInitScript(
      ([key, value]) => {
        // Solo al primo caricamento: dopo un logout la sessione non deve tornare.
        if (!sessionStorage.getItem("e2e-session-seeded")) {
          localStorage.setItem(key, value);
          sessionStorage.setItem("e2e-session-seeded", "1");
        }
      },
      [AUTH_STORAGE_KEY, JSON.stringify(session)] as const,
    );
  }

  // --- Intercettazione ------------------------------------------------------

  async install(page: Page) {
    await page.routeWebSocket(/supabase\.e2e\.test/, () => {
      // Connessione accettata e muta: il realtime non serve ai flussi testati.
    });
    await page.route(`${FAKE_SUPABASE_URL}/**`, (route) => this.handle(route));
  }

  private userFromAuth(header: string | null): FakeUser | null {
    const token = header?.replace(/^Bearer\s+/i, "");
    return (token && this.tokens.get(token)) || null;
  }

  private async handle(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD",
      "access-control-allow-headers": (await req.headerValue("access-control-request-headers")) ?? "*",
      "access-control-expose-headers": "content-range, x-supabase-api-version",
    };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });

    const reply = (status: number, body?: Json, extra: Record<string, string> = {}) =>
      route.fulfill({
        status,
        headers: { ...cors, "content-type": "application/json", ...extra },
        body: body === undefined ? "" : JSON.stringify(body),
      });

    const auth = await req.headerValue("authorization");
    const user = this.userFromAuth(auth);
    const path = url.pathname;
    let body: Json = null;
    try {
      body = req.postData() ? req.postDataJSON() : null;
    } catch {
      body = req.postData();
    }

    // --- Auth
    if (path.startsWith("/auth/v1/")) {
      const endpoint = path.slice("/auth/v1/".length);
      if (endpoint === "user") {
        return user ? reply(200, userJson(user)) : reply(401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
      }
      if (endpoint === "token" && url.searchParams.get("grant_type") === "refresh_token") {
        const u = this.tokens.get(`refresh:${(body as { refresh_token?: string })?.refresh_token}`);
        return u ? reply(200, this.createSession(u)) : reply(400, { error: "invalid_grant" });
      }
      if (endpoint === "token" && url.searchParams.get("grant_type") === "password") {
        const { email, password } = (body ?? {}) as { email?: string; password?: string };
        const u = this.users.find((x) => x.email === email && x.password === password);
        return u ? reply(200, this.createSession(u)) : reply(400, { error: "invalid_grant", error_description: "Invalid login credentials" });
      }
      if (endpoint === "logout") return route.fulfill({ status: 204, headers: cors });
      if (endpoint === "factors" || endpoint.startsWith("factors")) return reply(200, []);
      return reply(200, {});
    }

    // --- Edge function
    if (path.startsWith("/functions/v1/")) {
      const name = path.slice("/functions/v1/".length);
      this.functionCalls.push({ name, body, authorization: auth });
      const handler = this.functions.get(name);
      if (!handler) return reply(200, {});
      const res = await handler(body, { fake: this, userId: user?.id ?? null });
      return reply(res.status ?? 200, res.body);
    }

    // --- Storage: caricamenti e link firmati; il resto risponde vuoto
    if (path.startsWith("/storage/v1/")) {
      const rest = decodeURIComponent(path.slice("/storage/v1/".length));
      const method = req.method();
      this.storageCalls.push({ method, path: rest });
      const signMany = rest.match(/^object\/sign\/([^/]+)$/);
      if (signMany && method === "POST") {
        const bucket = signMany[1];
        const paths = (body as { paths?: string[] } | null)?.paths ?? [];
        return reply(200, paths.map((p) => this.storageObjects.has(`${bucket}/${p}`)
          ? { path: p, signedURL: `/object/sign/${bucket}/${p}?token=finto`, error: null }
          : { path: p, signedURL: null, error: "Object not found" }));
      }
      const signOne = rest.match(/^object\/sign\/([^/]+)\/(.+)$/);
      if (signOne && method === "POST") return reply(200, { signedURL: `/object/sign/${signOne[1]}/${signOne[2]}?token=finto` });
      if (signOne && method === "GET") {
        return this.storageObjects.has(`${signOne[1]}/${signOne[2]}`)
          ? route.fulfill({ status: 200, headers: { ...cors, "content-type": "image/png" }, body: PNG_1X1 })
          : reply(400, { error: "Object not found" });
      }
      const list = rest.match(/^object\/list\/([^/]+)$/);
      if (list && method === "POST") {
        const { prefix = "", limit = 100, offset = 0 } = (body ?? {}) as { prefix?: string; limit?: number; offset?: number };
        const base = `${list[1]}/${prefix ? `${prefix.replace(/\/$/, "")}/` : ""}`;
        const entries = new Map<string, { name: string; id: string | null }>();
        for (const key of [...this.storageObjects].sort()) {
          if (!key.startsWith(base)) continue;
          const [first, ...more] = key.slice(base.length).split("/");
          entries.set(first, more.length ? { name: first, id: null } : { name: first, id: `id-${key}` });
        }
        return reply(200, [...entries.values()].slice(offset, offset + limit));
      }
      if (rest === "object/move" && method === "POST") {
        const { bucketId, sourceKey, destinationKey, destinationBucket } = body as Record<string, string>;
        if (!this.storageObjects.delete(`${bucketId}/${sourceKey}`)) return reply(400, { error: "Object not found" });
        this.storageObjects.add(`${destinationBucket ?? bucketId}/${destinationKey}`);
        return reply(200, { message: "Successfully moved" });
      }
      const publicFile = rest.match(/^object\/public\/([^/]+)\/(.+)$/);
      if (publicFile && method === "GET") {
        return this.storageObjects.has(`${publicFile[1]}/${publicFile[2]}`)
          ? route.fulfill({ status: 200, headers: { ...cors, "content-type": "image/png" }, body: PNG_1X1 })
          : reply(400, { error: "Object not found" });
      }
      const object = rest.match(/^object\/([^/]+)\/(.+)$/);
      if (object && (method === "POST" || method === "PUT")) {
        this.storageObjects.add(`${object[1]}/${object[2]}`);
        return reply(200, { Key: `${object[1]}/${object[2]}`, Id: randomUUID() });
      }
      const bucketOnly = rest.match(/^object\/([^/]+)$/);
      if (bucketOnly && method === "DELETE") {
        const prefixes = (body as { prefixes?: string[] } | null)?.prefixes ?? [];
        const removed = prefixes.filter((p) => this.storageObjects.delete(`${bucketOnly[1]}/${p}`));
        return reply(200, removed.map((name) => ({ name, bucket_id: bucketOnly[1] })));
      }
      return reply(200, []);
    }

    // --- PostgREST
    if (path.startsWith("/rest/v1/rpc/")) {
      const name = path.slice("/rest/v1/rpc/".length);
      const handler = this.rpcs.get(name);
      return reply(200, handler ? handler(body, { fake: this, userId: user?.id ?? null }) : null);
    }
    if (path.startsWith("/rest/v1/")) {
      return this.handleRest(route, path.slice("/rest/v1/".length), url.searchParams, body, reply);
    }

    return reply(404, { message: `Fake Supabase: percorso non gestito ${path}` });
  }

  private async handleRest(
    route: Route,
    tableName: string,
    params: URLSearchParams,
    body: Json,
    reply: (status: number, body?: Json, extra?: Record<string, string>) => Promise<void>,
  ) {
    const req = route.request();
    const method = req.method();
    const prefer = (await req.headerValue("prefer")) ?? "";
    const accept = (await req.headerValue("accept")) ?? "";
    const wantsObject = accept.includes("vnd.pgrst.object");
    const rows = this.table(tableName);

    const respond = (result: Row[], status = 200) => {
      const extra: Record<string, string> = {
        "content-range": `0-${Math.max(result.length - 1, 0)}/${result.length}`,
      };
      if (method === "HEAD") return reply(status, undefined, extra);
      if (wantsObject) {
        if (result.length !== 1) {
          return reply(406, {
            code: "PGRST116",
            details: `The result contains ${result.length} rows`,
            hint: null,
            message: "JSON object requested, multiple (or no) rows returned",
          });
        }
        return reply(status, result[0], extra);
      }
      return reply(status, result, extra);
    };

    if (method === "GET" || method === "HEAD") {
      return respond(applyQuery(rows, params));
    }

    const returning = prefer.includes("return=representation");

    if (method === "POST") {
      const incoming = (Array.isArray(body) ? body : [body]) as Row[];
      const conflict = params.get("on_conflict")?.split(",");
      const upsert = prefer.includes("resolution=merge-duplicates") || prefer.includes("resolution=ignore-duplicates");
      const written: Row[] = [];
      for (const data of incoming) {
        const existing =
          upsert && conflict
            ? rows.find((r) => conflict.every((c) => (r[c] ?? null) === (data[c] ?? null)))
            : undefined;
        if (existing) {
          if (!prefer.includes("ignore-duplicates")) Object.assign(existing, data, { updated_at: new Date().toISOString() });
          written.push(existing);
        } else {
          const now = new Date().toISOString();
          const row = { id: randomUUID(), created_at: now, updated_at: now, ...data };
          rows.push(row);
          written.push(row);
        }
      }
      return returning ? respond(written, 201) : reply(201);
    }

    const target = applyQuery(rows, params);

    if (method === "PATCH") {
      for (const r of target) Object.assign(r, body as Row, { updated_at: new Date().toISOString() });
      return returning ? respond(target) : reply(204);
    }

    if (method === "DELETE") {
      for (const r of target) rows.splice(rows.indexOf(r), 1);
      return returning ? respond(target) : reply(204);
    }

    return reply(405, { message: `Metodo ${method} non gestito` });
  }
}
