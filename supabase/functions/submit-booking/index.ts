import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_MAX = 3; // Max 3 bookings per window
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window

function checkRateLimit(identifier: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const limit = rateLimitMap.get(identifier);

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (limit.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterMs: limit.resetTime - now };
  }

  limit.count++;
  return { allowed: true };
}

// Input validation
function validateBookingData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Parent name validation
  if (!data.parentName || typeof data.parentName !== "string") {
    errors.push("Nome genitore richiesto");
  } else {
    const name = data.parentName.trim();
    if (name.length < 2 || name.length > 100) {
      errors.push("Nome deve essere tra 2 e 100 caratteri");
    }
    // Block suspicious patterns
    if (/<script|javascript:|data:/i.test(name)) {
      errors.push("Nome contiene caratteri non validi");
    }
  }

  // Email validation
  if (!data.email || typeof data.email !== "string") {
    errors.push("Email richiesta");
  } else {
    const email = data.email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 255) {
      errors.push("Email non valida");
    }
  }

  // Phone validation (optional)
  if (data.phone && typeof data.phone === "string") {
    const phone = data.phone.trim();
    if (phone.length > 20) {
      errors.push("Numero di telefono troppo lungo");
    }
    // Only allow numbers, spaces, +, -, ()
    if (!/^[\d\s+\-()]*$/.test(phone)) {
      errors.push("Numero di telefono contiene caratteri non validi");
    }
  }

  // Child age validation
  if (!data.childAge || typeof data.childAge !== "number") {
    errors.push("Età bambino richiesta");
  } else if (data.childAge < 6 || data.childAge > 18) {
    errors.push("Età deve essere tra 6 e 18 anni");
  }

  // Interest validation
  const validInterests = ["coding-base", "game-dev", "roblox", "web", "python-ai", "non-so"];
  if (!data.interest || !validInterests.includes(data.interest)) {
    errors.push("Seleziona un interesse valido");
  }

  // Availability validation (optional)
  if (data.availability) {
    const validAvailability = ["mattina", "pomeriggio", "sera", "weekend", "qualsiasi"];
    if (!validAvailability.includes(data.availability)) {
      errors.push("Disponibilità non valida");
    }
  }

  // Message validation (optional)
  if (data.message && typeof data.message === "string") {
    if (data.message.length > 1000) {
      errors.push("Messaggio troppo lungo (max 1000 caratteri)");
    }
  }

  return { valid: errors.length === 0, errors };
}

interface BookingRequest {
  parentName: string;
  email: string;
  phone?: string;
  childAge: number;
  interest: string;
  availability?: string;
  message?: string;
  adminEmail?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";

    // Check rate limit
    const rateLimitResult = checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
      const retryAfterSeconds = Math.ceil((rateLimitResult.retryAfterMs || 3600000) / 1000);
      return new Response(
        JSON.stringify({ 
          error: "Troppe richieste. Riprova più tardi.",
          retryAfterSeconds 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSeconds)
          } 
        }
      );
    }

    const data: BookingRequest = await req.json();

    // Validate input
    const validation = validateBookingData(data);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: "Dati non validi", details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for duplicate email submissions within last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: existingBookings, error: checkError } = await supabase
      .from("trial_bookings")
      .select("id")
      .eq("email", data.email.trim().toLowerCase())
      .gte("created_at", oneHourAgo);

    if (checkError) {
      console.error("Error checking existing bookings:", checkError);
    } else if (existingBookings && existingBookings.length > 0) {
      return new Response(
        JSON.stringify({ error: "Hai già inviato una richiesta di recente. Ti contatteremo presto!" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert booking
    const { error: dbError } = await supabase.from("trial_bookings").insert({
      parent_name: data.parentName.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim() || null,
      child_age: data.childAge,
      interest: data.interest,
      availability: data.availability || null,
      message: data.message?.trim() || null,
    });

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Errore nel salvataggio della richiesta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return success - email notification will be triggered separately if needed
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Prenotazione ricevuta con successo",
        sendEmailNotification: {
          parentName: data.parentName.trim(),
          email: data.email.trim().toLowerCase(),
          phone: data.phone?.trim(),
          childAge: data.childAge,
          interest: data.interest,
          availability: data.availability,
          message: data.message?.trim(),
          adminEmail: data.adminEmail
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in submit-booking:", error);
    return new Response(
      JSON.stringify({ error: "Errore interno del server" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
