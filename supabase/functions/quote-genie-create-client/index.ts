import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceRole);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden: admins only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const leadId = body?.lead_id;
    if (!leadId || typeof leadId !== "string") {
      return new Response(JSON.stringify({ error: "lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lead, error: leadErr } = await admin
      .from("crm_leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qgKey = Deno.env.get("QUOTE_GENIE_API_KEY");
    const qgBase = Deno.env.get("QUOTE_GENIE_BASE_URL"); // public domain for redirect, e.g. https://preventivi.techlanditalia.it

    if (!qgKey || !qgBase) {
      return new Response(
        JSON.stringify({ error: "Quote Genie not configured (missing secrets)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Quote Genie Supabase project ref (edge functions are hosted here, NOT on the public domain)
    const QG_SUPABASE_REF = "liskieqtlrphhykbjdfh";
    const qgUrl = `https://${QG_SUPABASE_REF}.supabase.co/functions/v1/crm-import-client`;
    let redirectUrl: string | null = null;
    let qgClientId: string | null = null;
    let qgError: string | null = null;

    console.log("[QG] Calling crm-import-client", { qgUrl, lead_id: lead.id, email: lead.email });

    try {
      const qgRes = await fetch(qgUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CRM-Key": qgKey,
        },
        body: JSON.stringify({
          external_id: lead.id,
          full_name: lead.full_name,
          email: lead.email,
          phone: lead.phone,
          source: "techland_crm",
          metadata: {
            interest: lead.interest,
            child_age: lead.child_age,
            notes: lead.notes,
          },
        }),
      });

      const responseText = await qgRes.text();
      console.log("[QG] Response status:", qgRes.status, "body:", responseText.slice(0, 500));

      if (qgRes.ok) {
        try {
          const qgData = JSON.parse(responseText);
          qgClientId = qgData.client_id ?? null;
          redirectUrl = qgData.redirect_url ?? null;
          // Append action=new_quote so Quote Genie auto-opens the new-quote dialog
          if (redirectUrl) {
            const sep = redirectUrl.includes("?") ? "&" : "?";
            redirectUrl = `${redirectUrl}${sep}action=new_quote`;
          }
        } catch (parseErr) {
          qgError = `Invalid JSON from Quote Genie: ${(parseErr as Error).message}`;
        }
      } else {
        qgError = `Quote Genie returned ${qgRes.status}: ${responseText.slice(0, 200)}`;
      }
    } catch (e) {
      qgError = `Network error contacting Quote Genie: ${(e as Error).message}`;
      console.error("[QG] Network error:", e);
    }

    // Fallback: open Quote Genie clients page with prefill query params
    if (!redirectUrl) {
      console.warn("[QG] Using fallback redirect. Reason:", qgError);
      const params = new URLSearchParams({
        nome: lead.full_name || "",
        email: lead.email || "",
        telefono: lead.phone || "",
        external_id: lead.id,
        action: "new_quote",
      });
      redirectUrl = `${qgBase.replace(/\/$/, "")}/app/clients?${params.toString()}`;
    }

    // Update lead and log interaction
    if (qgClientId) {
      await admin
        .from("crm_leads")
        .update({ quote_genie_client_id: qgClientId })
        .eq("id", lead.id);
    }

    await admin.from("crm_interactions").insert({
      lead_id: lead.id,
      admin_id: userId,
      type: "quote_sent",
      subject: "Preventivo inviato a Quote Genie",
      content: qgError
        ? `Apertura manuale (fallback). ${qgError}`
        : "Cliente creato/aggiornato in Quote Genie",
      metadata: { quote_genie_client_id: qgClientId, redirect_url: redirectUrl, error: qgError },
    });

    return new Response(
      JSON.stringify({ success: true, redirect_url: redirectUrl, quote_genie_client_id: qgClientId, fallback: !!qgError, error: qgError }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error('quote-genie-create-client error:', e);
    return new Response(JSON.stringify({ error: "Errore interno del server" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
