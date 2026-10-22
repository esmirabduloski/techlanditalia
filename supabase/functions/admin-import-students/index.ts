import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { decodeClaims, mfaRequiredResponse } from "../_shared/mfa.ts";
import { randomUnknownPassword } from "../_shared/studentpassword.ts";
import { addParentRole, createAdultAccount, createChildAccount, sendWelcomeEmail } from "../_shared/familyaccounts.ts";
import { checkImportRow, STUDENT_IMPORT_BATCH_MAX } from "../_shared/studentimport.ts";

/**
 * Import CSV degli studenti da Admin → Utenti (src/lib/studentsCsv.ts): crea
 * i nuovi studenti, e il genitore se la sua email non ha ancora un account.
 * Gli aggiornamenti di studenti esistenti li fa il client con le policy admin.
 * Ogni riga ha il suo esito; le righe si elaborano in ordine, così i fratelli
 * della stessa chiamata finiscono sotto lo stesso genitore appena creato.
 */

interface RowResult {
  line: number;
  ok: boolean;
  error?: string;
  studentId?: string;
  parentCreated?: boolean;
}

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const limited = await rateLimit(req, { endpoint: "admin-import-students", maxRequests: 60, windowSeconds: 3600, corsHeaders });
  if (limited) return limited;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Non autorizzato" }, 401);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");

    const { data: { user: adminUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !adminUser) return json({ error: "Non autorizzato" }, 401);

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", adminUser.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return json({ error: "Solo gli admin possono importare studenti" }, 403);

    // Gli admin operano solo con la verifica in due passaggi completata (sessione aal2)
    if (decodeClaims(token).aal !== "aal2") return mfaRequiredResponse(corsHeaders);

    const body = await req.json().catch(() => null) as { rows?: unknown; sendWelcome?: unknown } | null;
    const rawRows = Array.isArray(body?.rows) ? body!.rows : null;
    if (!rawRows || rawRows.length === 0 || rawRows.length > STUDENT_IMPORT_BATCH_MAX) {
      return json({ error: `Da 1 a ${STUDENT_IMPORT_BATCH_MAX} righe per volta` }, 400);
    }
    const sendWelcome = body?.sendWelcome === true;

    const clients = {
      admin: supabaseAdmin,
      asAdmin: createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    };

    const checks = rawRows.map(checkImportRow);
    const courseIds = [...new Set(checks.flatMap((c) => (c.ok ? c.row.courseIds : [])))];
    const { data: courses } = courseIds.length
      ? await supabaseAdmin.from("courses").select("id").in("id", courseIds)
      : { data: [] as { id: string }[] };
    const knownCourses = new Set((courses ?? []).map((c) => c.id));

    console.log(`Admin ${adminUser.id} importing ${checks.length} students`);

    const results: RowResult[] = [];
    // Genitori creati in questa chiamata, per i fratelli e per l'email di benvenuto
    const newParents = new Map<string, { id: string; fullName: string; childName: string; childUsername: string }>();

    for (const check of checks) {
      if (!check.ok) {
        results.push({ line: check.line, ok: false, error: check.error });
        continue;
      }
      const row = check.row;
      const fail = (error: string) => results.push({ line: row.line, ok: false, error });

      if (row.courseIds.some((id) => !knownCourses.has(id))) {
        fail("Corso non trovato");
        continue;
      }

      const { data: taken } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", row.username)
        .maybeSingle();
      if (taken) {
        fail(`Username "${row.username}" già in uso`);
        continue;
      }

      let parentId: string;
      let parentCreated = false;
      const sibling = newParents.get(row.parentEmail);
      if (sibling) {
        parentId = sibling.id;
      } else {
        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("id, role")
          .eq("email", row.parentEmail)
          .maybeSingle();
        if (existing && existing.role !== "parent") {
          fail("L'email appartiene a un account che non è un genitore");
          continue;
        }
        if (existing) {
          parentId = existing.id;
        } else {
          // Password casuale: il genitore la sceglie dal link nell'email di benvenuto
          const account = await createAdultAccount(clients, {
            email: row.parentEmail,
            password: randomUnknownPassword(),
            fullName: row.parentName,
            role: "parent",
          });
          if (!account.ok) {
            fail(account.error);
            continue;
          }
          await addParentRole(supabaseAdmin, account.userId);
          parentId = account.userId;
          parentCreated = true;
        }
      }

      const child = await createChildAccount(supabaseAdmin, {
        parentId,
        childName: row.studentName,
        childUsername: row.username,
        courseIds: row.courseIds,
      });
      if (!child.ok) {
        // Un genitore appena creato senza figli non serve: si annulla
        if (parentCreated) await supabaseAdmin.auth.admin.deleteUser(parentId);
        fail(`Studente non creato${parentCreated ? " (annullato anche il genitore)" : ""}: ${child.error}`);
        continue;
      }

      if (parentCreated) {
        newParents.set(row.parentEmail, { id: parentId, fullName: row.parentName, childName: row.studentName, childUsername: row.username });
      }
      results.push({ line: row.line, ok: true, studentId: child.childId, parentCreated });
    }

    if (sendWelcome) {
      for (const [email, p] of newParents) {
        await sendWelcomeEmail(req, clients, {
          userId: p.id,
          email,
          fullName: p.fullName,
          role: "parent",
          childName: p.childName,
          childUsername: p.childUsername,
        });
      }
    }

    console.log(`Import done: ${results.filter((r) => r.ok).length}/${results.length} students created`);
    return json({ results });
  } catch (error) {
    console.error("Error:", error);
    return json({ error: "Errore interno del server" }, 500);
  }
});
