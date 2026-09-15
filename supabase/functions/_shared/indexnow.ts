/**
 * Ping IndexNow (Bing, Yandex, Seznam, Naver, Yep) per URL nuove o aggiornate.
 * https://www.indexnow.org/documentation
 *
 * Best effort: non lancia mai, non deve bloccare chi la chiama (la pubblicazione
 * di un articolo non può fallire perché IndexNow è giù). La chiave è pubblica per
 * design ed è la stessa di public/<key>.txt e scripts/indexnow-submit.mjs.
 */

export const SITE_URL = 'https://techlanditalia.it';
const HOST = 'techlanditalia.it';
const KEY = '60adb54c647f4574b244f0d030f70d2b';
const KEY_LOCATION = `${SITE_URL}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

/** Accetta path ("/blog/slug") o URL assolute; scarta tutto ciò che non è del dominio. */
export function toSiteUrls(urls: string[]): string[] {
  const out = new Set<string>();
  for (const u of urls) {
    try {
      const url = new URL(u.startsWith('http') ? u : `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`);
      if (url.hostname === HOST) out.add(url.toString());
    } catch {
      /* URL malformata: ignorata */
    }
  }
  return [...out];
}

export async function submitToIndexNow(
  urls: string[],
): Promise<{ ok: boolean; status: number; submitted: number }> {
  const urlList = toSiteUrls(urls);
  if (!urlList.length) return { ok: true, status: 0, submitted: 0 };
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
    });
    // 200 = ricevuto, 202 = ricevuto ma chiave ancora in verifica
    const ok = res.status === 200 || res.status === 202;
    if (!ok) console.error(`indexnow: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    else console.log(`indexnow: ${urlList.length} URL inviate (HTTP ${res.status})`);
    return { ok, status: res.status, submitted: urlList.length };
  } catch (e) {
    console.error('indexnow: richiesta fallita', e);
    return { ok: false, status: 0, submitted: 0 };
  }
}
