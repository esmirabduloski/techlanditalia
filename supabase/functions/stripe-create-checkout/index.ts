import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    const { priceId, successUrl, cancelUrl } = await req.json();

    if (!priceId) {
      throw new Error('priceId is required');
    }

    // Create Stripe Checkout Session
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', successUrl || 'https://techlanditalia.lovable.app/area-riservata/acquisti?success=true');
    params.append('cancel_url', cancelUrl || 'https://techlanditalia.lovable.app/area-riservata/acquisti?canceled=true');

    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await sessionRes.json();

    if (session.error) {
      throw new Error(session.error.message);
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
