/**
 * IP reale del visitatore, per rate limiting e log di sicurezza.
 *
 * Il primo valore di `x-forwarded-for` lo sceglie il client: chi manda un
 * header inventato a ogni richiesta aggira qualsiasi limite per IP. Cloudflare
 * (davanti alle edge function Supabase) sovrascrive invece `cf-connecting-ip`
 * con l'IP da cui arriva davvero la connessione, quindi è l'unico affidabile.
 */

let warned = false;

export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  if (!warned) {
    // Se compare nei log, il limite per IP è aggirabile: va rivisto questo fallback.
    console.warn("[clientIp] cf-connecting-ip assente, uso x-real-ip / x-forwarded-for");
    warned = true;
  }
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}
