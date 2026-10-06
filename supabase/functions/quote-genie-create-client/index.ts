import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeadersFor } from "../_shared/cors.ts";

/** Rata CRM da trasformare in preventivo (opzionale: { lead_id, payment_id }). */
type PaymentRow = {
  id: string;
  lead_id: string;
  amount_cents: number;
  list_amount_cents: number | null;
  discount_label: string | null;
  description: string | null;
  due_date: string | null;
  installment_number: number | null;
  installment_total: number | null;
};

function paymentTitle(p: PaymentRow): string {
  const parts: string[] = [];
  if (p.installment_number && p.installment_total) parts.push(`Rata ${p.installment_number}/${p.installment_total}`);
  if (p.description) parts.push(p.description);
  return parts.join(" - ") || "Pagamento";
}


/** Parametri del preventivo nel link di Quote Genie (prefill della bozza). */
function quoteQuery(quote: { external_id: string; title: string; items: { unit_price: number }[]; due_date: string | null; discount: { label: string | null; amount: number } | null } | null): string {
  if (!quote) return "";
  // quote_amount è il prezzo pieno della riga: Quote Genie applica lo sconto a parte
  const params = new URLSearchParams({
    quote_external_id: quote.external_id,
    quote_description: quote.title,
    quote_amount: quote.items[0].unit_price.toFixed(2),
  });
  if (quote.due_date) params.set("quote_due_date", quote.due_date);
  if (quote.discount) {
    params.set("quote_discount", quote.discount.amount.toFixed(2));
    if (quote.discount.label) params.set("quote_discount_label", quote.discount.label);
  }
  return `&${params.toString()}`;
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
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

    // Preventivo di una singola rata: la rata deve appartenere al lead
    const paymentId = typeof body?.payment_id === "string" ? body.payment_id : null;
    let payment: PaymentRow | null = null;
    if (paymentId) {
      const { data } = await admin
        .from("crm_payments")
        .select("id, lead_id, amount_cents, list_amount_cents, discount_label, description, due_date, installment_number, installment_total")
        .eq("id", paymentId)
        .maybeSingle();
      if (!data || data.lead_id !== leadId) {
        return new Response(JSON.stringify({ error: "Payment not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      payment = data as PaymentRow;
    }

    // Dati strutturati del preventivo, letti da Quote Genie per precompilare la bozza
    const quote = payment
      ? {
        external_id: payment.id,
        title: paymentTitle(payment),
        currency: "EUR",
        due_date: payment.due_date,
        installment_number: payment.installment_number,
        installment_total: payment.installment_total,
        items: [{
          description: paymentTitle(payment),
          quantity: 1,
          unit_price: (payment.list_amount_cents ?? payment.amount_cents) / 100,
          unit_price_cents: payment.list_amount_cents ?? payment.amount_cents,
        }],
        discount: payment.list_amount_cents != null
          ? {
            label: payment.discount_label,
            amount: (payment.list_amount_cents - payment.amount_cents) / 100,
            amount_cents: payment.list_amount_cents - payment.amount_cents,
          }
          : null,
        total: payment.amount_cents / 100,
        total_cents: payment.amount_cents,
      }
      : null;

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

    console.log("[QG] Calling crm-import-client", { qgUrl, lead_id: lead.id });

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
          ...(quote ? { quote } : {}),
        }),
      });

      const responseText = await qgRes.text();
      console.log("[QG] Response status:", qgRes.status, "body:", responseText.slice(0, 500));

      if (qgRes.ok) {
        try {
          const qgData = JSON.parse(responseText);
          qgClientId = qgData.client_id ?? null;
          redirectUrl = qgData.redirect_url ?? null;
          // Bozza già creata da Quote Genie con la rata: apri direttamente quella
          // (evita un secondo preventivo vuoto aperto dal deeplink)
          if (qgData.quote?.success && typeof qgData.quote.redirect_url === "string") {
            redirectUrl = qgData.quote.redirect_url;
          } else if (redirectUrl) {
            if (qgData.quote && !qgData.quote.success) {
              console.warn("[QG] Quote draft not created:", qgData.quote.error);
            }
            // Append action=new_quote so Quote Genie auto-opens the new-quote dialog
            const sep = redirectUrl.includes("?") ? "&" : "?";
            redirectUrl = `${redirectUrl}${sep}action=new_quote${quoteQuery(quote)}`;
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
      redirectUrl = `${qgBase.replace(/\/$/, "")}/app/clients?${params.toString()}${quoteQuery(quote)}`;
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
      subject: quote
        ? `Preventivo rata in Quote Genie: ${quote.title} (${quote.total.toFixed(2).replace(".", ",")} €)`
        : "Preventivo inviato a Quote Genie",
      content: qgError
        ? `Apertura manuale (fallback). ${qgError}`
        : "Cliente creato/aggiornato in Quote Genie",
      metadata: { quote_genie_client_id: qgClientId, redirect_url: redirectUrl, error: qgError, payment_id: payment?.id ?? null },
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
