import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/notion/v1";

interface SyncRequest {
  lead_id: string;
  operation: "create" | "update" | "delete" | "backfill";
  notion_page_id?: string | null;
}

interface PropertyMapping {
  title: string;
  email: string;
  phone: string;
  pipeline_stage: string;
  source: string;
  lead_score: string;
  lifetime_value_cents: string;
  tags: string;
  next_followup_at: string;
  last_contacted_at: string;
  child_age: string;
  interest: string;
  notes: string;
  original_message: string;
  created_at: string;
}

function rt(text: string | null | undefined) {
  if (!text) return [];
  // Notion rich_text fields cap at 2000 chars per chunk
  return [{ type: "text", text: { content: String(text).slice(0, 1990) } }];
}

function buildProperties(lead: any, map: PropertyMapping) {
  const props: Record<string, any> = {};

  // Title (Name)
  props[map.title] = {
    title: rt(lead.full_name || lead.email || "Lead senza nome"),
  };

  if (lead.email) props[map.email] = { email: lead.email };
  if (lead.phone) props[map.phone] = { phone_number: lead.phone };

  if (lead.pipeline_stage) {
    props[map.pipeline_stage] = { select: { name: String(lead.pipeline_stage) } };
  }
  if (lead.source) {
    props[map.source] = { select: { name: String(lead.source) } };
  }

  if (typeof lead.lead_score === "number") {
    props[map.lead_score] = { number: lead.lead_score };
  }
  if (typeof lead.lifetime_value_cents === "number") {
    props[map.lifetime_value_cents] = { number: lead.lifetime_value_cents / 100 };
  }

  if (Array.isArray(lead.tags) && lead.tags.length > 0) {
    props[map.tags] = {
      multi_select: lead.tags.map((t: string) => ({ name: String(t).slice(0, 100) })),
    };
  }

  if (lead.next_followup_at) {
    props[map.next_followup_at] = { date: { start: lead.next_followup_at } };
  }
  if (lead.last_contacted_at) {
    props[map.last_contacted_at] = { date: { start: lead.last_contacted_at } };
  }
  if (lead.created_at) {
    props[map.created_at] = { date: { start: lead.created_at } };
  }

  if (typeof lead.child_age === "number") {
    props[map.child_age] = { number: lead.child_age };
  }

  if (lead.interest) props[map.interest] = { rich_text: rt(lead.interest) };
  if (lead.notes) props[map.notes] = { rich_text: rt(lead.notes) };
  if (lead.original_message) {
    props[map.original_message] = { rich_text: rt(lead.original_message) };
  }

  return props;
}

async function notionFetch(path: string, init: RequestInit, lovableKey: string, notionKey: string) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": notionKey,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, body: json };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!LOVABLE_API_KEY || !NOTION_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing environment variables" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let payload: SyncRequest;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!payload.lead_id || !payload.operation) {
    return new Response(JSON.stringify({ error: "lead_id and operation required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Load settings
  const { data: settings, error: settingsErr } = await supabase
    .from("crm_notion_settings")
    .select("enabled, database_id, property_mapping")
    .eq("singleton", true)
    .maybeSingle();

  if (settingsErr || !settings) {
    return new Response(JSON.stringify({ error: "Settings not found", details: settingsErr }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!settings.enabled || !settings.database_id) {
    return new Response(JSON.stringify({ skipped: true, reason: "Sync disabled or DB id missing" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const map = settings.property_mapping as PropertyMapping;
  const databaseId = settings.database_id;

  async function log(status: string, opts: {
    notion_page_id?: string | null;
    error_message?: string | null;
    request_payload?: any;
    response_payload?: any;
  }) {
    await supabase.from("crm_notion_sync_log").insert({
      lead_id: payload.lead_id,
      operation: payload.operation,
      status,
      notion_page_id: opts.notion_page_id ?? null,
      error_message: opts.error_message ?? null,
      request_payload: opts.request_payload ?? null,
      response_payload: opts.response_payload ?? null,
    });
  }

  try {
    // DELETE: archive Notion page
    if (payload.operation === "delete") {
      if (!payload.notion_page_id) {
        await log("success", { error_message: "No notion_page_id, nothing to archive" });
        return new Response(JSON.stringify({ ok: true, skipped: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await notionFetch(
        `/pages/${payload.notion_page_id}`,
        { method: "PATCH", body: JSON.stringify({ archived: true }) },
        LOVABLE_API_KEY,
        NOTION_API_KEY,
      );
      if (!res.ok) {
        await log("error", {
          notion_page_id: payload.notion_page_id,
          error_message: `HTTP ${res.status}`,
          response_payload: res.body,
        });
        return new Response(JSON.stringify({ ok: false, error: res.body }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await log("success", { notion_page_id: payload.notion_page_id });
      return new Response(JSON.stringify({ ok: true, archived: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load lead from DB
    const { data: lead, error: leadErr } = await supabase
      .from("crm_leads")
      .select("*")
      .eq("id", payload.lead_id)
      .maybeSingle();

    if (leadErr || !lead) {
      await log("error", { error_message: `Lead not found: ${leadErr?.message || "missing"}` });
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const properties = buildProperties(lead, map);
    const existingPageId = payload.notion_page_id || lead.notion_page_id;

    let res;
    if (existingPageId) {
      // UPDATE
      res = await notionFetch(
        `/pages/${existingPageId}`,
        { method: "PATCH", body: JSON.stringify({ properties, archived: false }) },
        LOVABLE_API_KEY,
        NOTION_API_KEY,
      );
    } else {
      // CREATE
      res = await notionFetch(
        `/pages`,
        {
          method: "POST",
          body: JSON.stringify({
            parent: { database_id: databaseId },
            properties,
          }),
        },
        LOVABLE_API_KEY,
        NOTION_API_KEY,
      );
    }

    if (!res.ok) {
      const msg = res.body?.message || `HTTP ${res.status}`;
      await supabase
        .from("crm_leads")
        .update({ notion_sync_error: msg })
        .eq("id", payload.lead_id);
      await log("error", {
        notion_page_id: existingPageId,
        error_message: msg,
        request_payload: { properties },
        response_payload: res.body,
      });
      return new Response(JSON.stringify({ ok: false, error: res.body }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newPageId = res.body?.id || existingPageId;

    // Update lead with sync metadata
    await supabase
      .from("crm_leads")
      .update({
        notion_page_id: newPageId,
        notion_last_sync_at: new Date().toISOString(),
        notion_sync_error: null,
      })
      .eq("id", payload.lead_id);

    await log("success", { notion_page_id: newPageId, response_payload: { id: newPageId } });

    return new Response(JSON.stringify({ ok: true, notion_page_id: newPageId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await log("error", { error_message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
