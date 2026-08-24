Deno.serve(async () => {
  const k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const url = Deno.env.get("SUPABASE_URL");
  const out: Record<string, unknown> = {};
  const r1 = await fetch(`${url}/rest/v1/trial_bookings?select=id&limit=1`, { headers: { apikey: k, Authorization: `Bearer ${k}` } });
  out.both = { status: r1.status, body: (await r1.text()).slice(0, 200) };
  const r2 = await fetch(`${url}/rest/v1/trial_bookings?select=id&limit=1`, { headers: { apikey: k } });
  out.apikeyOnly = { status: r2.status, body: (await r2.text()).slice(0, 200) };
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
});
