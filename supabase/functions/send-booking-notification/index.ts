import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeadersFor } from "../_shared/cors.ts";
import { captureServerError } from "../_shared/sentry.ts";
import { sendEmail } from "../_shared/email.ts";
import { bookingEmails, type BookingData } from "../_shared/emailtemplates.ts";

// Mittente storico delle email di prenotazione
const FROM = "TechLand Italia <info@techlanditalia.it>";
const FN = "send-booking-notification";

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Internal-only: require shared secret (service role key) so only server-to-server calls work
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!internalSecret || !expectedSecret || internalSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const data: BookingData = await req.json();
    console.log("Received booking notification request for:", data.email);

    // Force admin recipient server-side; ignore any client-supplied address
    const ADMIN_EMAIL = Deno.env.get("ADMIN_NOTIFICATION_EMAIL") || "info@techlanditalia.it";
    const mails = bookingEmails(data);

    const adminEmailResult = await sendEmail({
      kind: "staff_booking",
      source: FN,
      from: FROM,
      to: ADMIN_EMAIL,
      ...mails.staff,
    });
    if (!adminEmailResult.ok) throw new Error(`Email allo staff non inviata: ${adminEmailResult.error}`);
    console.log("Admin email sent:", adminEmailResult.id);

    // Confirmation email to parent
    const parentEmailResult = await sendEmail({
      kind: "booking_confirmation",
      source: FN,
      from: FROM,
      to: data.email,
      ...mails.parent,
    });
    if (!parentEmailResult.ok) throw new Error(`Conferma al genitore non inviata: ${parentEmailResult.error}`);
    console.log("Parent confirmation email sent:", parentEmailResult.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        adminEmail: adminEmailResult, 
        parentEmail: parentEmailResult 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    await captureServerError(error, { fn: "send-booking-notification" });
    return new Response(
      JSON.stringify({ error: "Errore interno" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
