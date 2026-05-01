import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zod schema with built-in honeypot + time-trap validation
const BookingSchema = z.object({
  parentName: z.string().trim().min(2).max(100)
    .refine((v) => !/<script|javascript:|data:/i.test(v), "Caratteri non validi"),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().min(1).max(20)
    .regex(/^[\d\s+\-()]*$/, "Numero non valido"),
  childAge: z.number().int().min(5).max(20).nullable().optional(),
  interest: z.string().max(100).nullable().optional(),
  availability: z.enum(["mattina","pomeriggio","sera","weekend","qualsiasi"]).optional(),
  message: z.string().max(1000).optional(),
  adminEmail: z.string().email().optional(),
  // Honeypot: deve restare vuoto
  website: z.string().max(0).optional().or(z.literal("")),
  // Time-trap: timestamp apertura form (ms da epoch)
  formOpenedAt: z.number().optional(),
});

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const raw = await req.json();
    const parsed = BookingSchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Dati non validi", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const data = parsed.data;

    // Honeypot triggered → silent reject (200 to mislead bots)
    if (data.website && data.website.length > 0) {
      console.warn("[submit-booking] honeypot triggered for", data.email);
      return new Response(JSON.stringify({ success: true, message: "Prenotazione ricevuta" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Time-trap: form compilato in meno di 2s = bot
    if (data.formOpenedAt && (Date.now() - data.formOpenedAt) < 2000) {
      console.warn("[submit-booking] time-trap triggered for", data.email);
      return new Response(JSON.stringify({ success: true, message: "Prenotazione ricevuta" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Blocked email check
    const { data: blocked } = await supabase.rpc("is_email_blocked", { _email: data.email });
    if (blocked === true) {
      console.warn("[submit-booking] blocked email", data.email);
      return new Response(JSON.stringify({ success: true, message: "Prenotazione ricevuta" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Duplicate check (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("trial_bookings")
      .select("id")
      .eq("email", data.email)
      .gte("created_at", oneHourAgo);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ error: "Hai già inviato una richiesta di recente. Ti contatteremo presto!" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: dbError } = await supabase.from("trial_bookings").insert({
      parent_name: data.parentName.trim(),
      email: data.email,
      phone: data.phone.trim(),
      child_age: data.childAge ?? 0,
      interest: data.interest || "non-so",
      availability: data.availability || null,
      message: data.message?.trim() || null,
    });

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(JSON.stringify({ error: "Errore nel salvataggio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Prenotazione ricevuta con successo",
        sendEmailNotification: {
          parentName: data.parentName.trim(),
          email: data.email,
          phone: data.phone.trim(),
          childAge: data.childAge,
          interest: data.interest,
          availability: data.availability,
          message: data.message?.trim(),
          adminEmail: data.adminEmail,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in submit-booking:", error);
    return new Response(JSON.stringify({ error: "Errore interno del server" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
