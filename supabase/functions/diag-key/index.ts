Deno.serve(async () => {
  const k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  let info: unknown = "unparsable";
  const parts = k.split(".");
  if (parts.length === 3) {
    try { info = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/'))); } catch { info = "decode-fail"; }
  }
  return new Response(JSON.stringify({ len: k.length, prefix: k.slice(0, 3), claims: info, url: Deno.env.get("SUPABASE_URL") }), { headers: { "Content-Type": "application/json" } });
});
