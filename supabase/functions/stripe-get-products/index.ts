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

    // Fetch active products
    const productsRes = await fetch('https://api.stripe.com/v1/products?active=true&limit=100', {
      headers: { 'Authorization': `Bearer ${stripeKey}` },
    });
    const productsData = await productsRes.json();

    if (productsData.error) {
      throw new Error(productsData.error.message);
    }

    // Fetch active prices
    const pricesRes = await fetch('https://api.stripe.com/v1/prices?active=true&limit=100&expand[]=data.product', {
      headers: { 'Authorization': `Bearer ${stripeKey}` },
    });
    const pricesData = await pricesRes.json();

    if (pricesData.error) {
      throw new Error(pricesData.error.message);
    }

    // Combine products with their prices
    const products = productsData.data.map((product: any) => {
      const prices = pricesData.data
        .filter((price: any) => {
          const priceProductId = typeof price.product === 'string' ? price.product : price.product?.id;
          return priceProductId === product.id;
        })
        .map((price: any) => ({
          id: price.id,
          unit_amount: price.unit_amount,
          currency: price.currency,
          recurring: price.recurring,
          type: price.type,
        }));

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        images: product.images,
        metadata: product.metadata,
        prices,
      };
    }).filter((p: any) => p.prices.length > 0);

    return new Response(JSON.stringify({ products }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('stripe-get-products error:', error);
    return new Response(JSON.stringify({ error: 'Errore interno del server' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
