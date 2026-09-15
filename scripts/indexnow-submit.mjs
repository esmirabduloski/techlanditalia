#!/usr/bin/env node
/**
 * Invia URL a IndexNow (Bing, Yandex, Seznam, Naver, Yep — Google NON lo usa).
 * https://www.indexnow.org/documentation
 *
 * La chiave è pubblicata in public/<key>.txt e servita alla root del sito:
 * IndexNow la verifica scaricando keyLocation, quindi il file deve essere
 * già online (deploy fatto) prima di lanciare il submit.
 *
 * Uso:
 *   npm run indexnow                       # tutte le URL della sitemap live
 *   npm run indexnow -- /blog/nuovo-post   # una o più URL (path o assolute)
 *   npm run indexnow -- --dry-run          # mostra il payload senza inviarlo
 *
 * Risposte IndexNow: 200 OK, 202 Accepted (chiave in verifica), 400 payload
 * errato, 403 chiave non valida, 422 URL non del dominio, 429 troppi invii.
 */

const BASE_URL = 'https://techlanditalia.it';
const HOST = 'techlanditalia.it';
// Stessa chiave di public/<key>.txt e supabase/functions/_shared/indexnow.ts
const KEY = '60adb54c647f4574b244f0d030f70d2b';
const KEY_LOCATION = `${BASE_URL}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_PER_REQUEST = 10_000;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const inputUrls = args.filter((a) => !a.startsWith('--'));

function normalize(u) {
  const abs = u.startsWith('http') ? u : `${BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`;
  const url = new URL(abs);
  if (url.hostname !== HOST) throw new Error(`URL non del dominio ${HOST}: ${u}`);
  return url.toString();
}

async function urlsFromSitemap() {
  const res = await fetch(`${BASE_URL}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap.xml: HTTP ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

async function verifyKeyFile() {
  const res = await fetch(KEY_LOCATION);
  const body = res.ok ? (await res.text()).trim() : '';
  if (!res.ok || body !== KEY) {
    throw new Error(
      `Key file non raggiungibile o contenuto errato (${KEY_LOCATION} → HTTP ${res.status}). ` +
        'Pubblica prima il sito, poi rilancia.',
    );
  }
}

const urlList = [...new Set((inputUrls.length ? inputUrls : await urlsFromSitemap()).map(normalize))];
if (!urlList.length) throw new Error('Nessuna URL da inviare');

console.log(`IndexNow: ${urlList.length} URL${dryRun ? ' (dry-run)' : ''}`);

if (dryRun) {
  console.log(JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }, null, 2));
  process.exit(0);
}

await verifyKeyFile();

for (let i = 0; i < urlList.length; i += MAX_PER_REQUEST) {
  const chunk = urlList.slice(i, i + MAX_PER_REQUEST);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: chunk }),
  });
  const text = (await res.text()).trim();
  console.log(`  batch ${i / MAX_PER_REQUEST + 1}: ${chunk.length} URL → HTTP ${res.status}${text ? ` ${text}` : ''}`);
  if (!res.ok && res.status !== 202) process.exitCode = 1;
}
