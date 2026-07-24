import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-source",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Whitelist of tables to snapshot. Each entry: [table, orderBy | null]
const TABLES: Array<[string, string | null]> = [
  ["blog_posts", "created_at"],
  ["courses", "created_at"],
  ["lessons", "created_at"],
  ["lesson_tasks", "created_at"],
  ["homework", "created_at"],
  ["glossary_terms", "created_at"],
  ["landing_pages", "created_at"],
  ["site_settings", null],
  ["badges", null],
  ["crm_leads", "created_at"],
  ["crm_interactions", "created_at"],
  ["newsletter_subscribers", "created_at"],
  ["trial_bookings", "created_at"],
  ["contact_submissions", "created_at"],
  ["referrals", "created_at"],
  ["blocked_emails", null],
  ["student_groups", "created_at"],
  ["group_lesson_schedule", null],
  ["teacher_links", null],
  ["homework_group_deadlines", null],
];

const PAGE_SIZE = 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Authz: allow if caller is admin, OR request came from pg_cron (header + rate limit)
    const authHeader = req.headers.get("Authorization");
    const cronSource = req.headers.get("x-cron-source");
    let allowed = false;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userRes } = await admin.auth.getUser(token);
      if (userRes?.user) {
        const { data: role } = await admin
          .from("user_roles").select("role")
          .eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle();
        if (role) allowed = true;
      }
    }

    if (!allowed && cronSource === "pg_cron") {
      // Rate-limit unauthenticated cron path: max 3 per 24h from this "identifier"
      const { data: rate } = await admin.rpc("check_rate_limit", {
        _identifier: "cron:backup-snapshot",
        _endpoint: "backup-json-snapshot",
        _max_requests: 3,
        _window_seconds: 86400,
      });
      if ((rate as any)?.allowed) allowed = true;
    }

    if (!allowed) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    const dayStamp = `${yyyy}-${mm}-${dd}`;
    const runStamp = now.toISOString().replace(/[:.]/g, "-");
    const basePath = `${yyyy}/${mm}`;

    const manifest: Record<string, { rows: number; path: string; bytes: number; error?: string }> = {};

    for (const [table, orderBy] of TABLES) {
      try {
        // Paginated fetch
        const rows: any[] = [];
        let from = 0;
        while (true) {
          let q = admin.from(table as any).select("*").range(from, from + PAGE_SIZE - 1);
          if (orderBy) q = q.order(orderBy, { ascending: true });
          const { data, error } = await q;
          if (error) throw error;
          if (!data || data.length === 0) break;
          rows.push(...data);
          if (data.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
          if (rows.length > 200_000) break; // safety cap
        }

        const json = JSON.stringify(rows, null, 2);
        const bytes = new TextEncoder().encode(json).length;
        const path = `${basePath}/${dayStamp}_${table}.json`;

        const { error: upErr } = await admin.storage
          .from("backups-json")
          .upload(path, new Blob([json], { type: "application/json" }), {
            upsert: true, contentType: "application/json",
          });
        if (upErr) throw upErr;

        manifest[table] = { rows: rows.length, path, bytes };
      } catch (e: any) {
        manifest[table] = { rows: 0, path: "", bytes: 0, error: e.message };
      }
    }

    // Manifest file
    const manifestPath = `${basePath}/${dayStamp}_manifest.json`;
    const manifestBody = JSON.stringify({
      generated_at: now.toISOString(),
      run_id: runStamp,
      tables: manifest,
    }, null, 2);
    await admin.storage.from("backups-json").upload(
      manifestPath,
      new Blob([manifestBody], { type: "application/json" }),
      { upsert: true, contentType: "application/json" },
    );

    return new Response(JSON.stringify({
      success: true, day: dayStamp, tables: Object.keys(manifest).length, manifest,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("backup-json-snapshot error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
