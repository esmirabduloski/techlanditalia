import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-source",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Retention:
 * - Keep everything in the last 90 days.
 * - Older than 90 days but within last 12 months: keep only the first
 *   snapshot day of each month (all files with that day's date prefix).
 * - Older than 12 months: delete everything.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Authz: admin JWT or cron header + rate limit
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
      const { data: rate } = await admin.rpc("check_rate_limit", {
        _identifier: "cron:backup-cleanup",
        _endpoint: "backup-json-cleanup",
        _max_requests: 2,
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
    const cutoff90 = new Date(now); cutoff90.setUTCDate(cutoff90.getUTCDate() - 90);
    const cutoff12mo = new Date(now); cutoff12mo.setUTCFullYear(cutoff12mo.getUTCFullYear() - 1);

    // List year folders (recursive walk)
    const toDelete: string[] = [];

    // List root: gives year folders
    const { data: years } = await admin.storage.from("backups-json").list("", { limit: 1000 });
    for (const y of years ?? []) {
      if (!y.name.match(/^\d{4}$/)) continue;
      const { data: months } = await admin.storage.from("backups-json").list(y.name, { limit: 1000 });
      for (const m of months ?? []) {
        if (!m.name.match(/^\d{2}$/)) continue;
        const monthPath = `${y.name}/${m.name}`;
        const { data: files } = await admin.storage.from("backups-json").list(monthPath, { limit: 10000 });
        if (!files) continue;

        // Group files by date prefix (YYYY-MM-DD)
        const byDay = new Map<string, string[]>();
        for (const f of files) {
          const match = f.name.match(/^(\d{4}-\d{2}-\d{2})_/);
          if (!match) continue;
          const day = match[1];
          if (!byDay.has(day)) byDay.set(day, []);
          byDay.get(day)!.push(`${monthPath}/${f.name}`);
        }

        const sortedDays = [...byDay.keys()].sort();
        const firstDay = sortedDays[0];

        for (const day of sortedDays) {
          const dayDate = new Date(`${day}T00:00:00Z`);
          const isRecent = dayDate >= cutoff90;
          const isWithinYear = dayDate >= cutoff12mo;
          const isFirstOfMonth = day === firstDay;

          if (isRecent) continue; // keep
          if (isWithinYear && isFirstOfMonth) continue; // keep monthly archive
          // else: delete
          toDelete.push(...byDay.get(day)!);
        }
      }
    }

    let deleted = 0;
    // Delete in chunks of 100
    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100);
      const { error } = await admin.storage.from("backups-json").remove(chunk);
      if (!error) deleted += chunk.length;
    }

    return new Response(JSON.stringify({
      success: true, considered: toDelete.length, deleted,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("backup-json-cleanup error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
