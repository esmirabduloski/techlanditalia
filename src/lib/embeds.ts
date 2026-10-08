/**
 * Iframe ammessi nei contenuti scritti da admin e docenti (lezioni, compiti).
 *
 * DOMPurify lascia passare gli iframe con qualsiasi `src`: un contenuto
 * sbagliato o compromesso poteva incorporare una pagina qualunque (es. un
 * finto login) dentro l'area riservata degli studenti. Qui restano incorporati
 * solo gli strumenti didattici noti; gli altri diventano un link, così nessun
 * contenuto esistente sparisce.
 *
 * Per aggiungere uno strumento basta inserire il suo dominio qui sotto.
 */
export const ALLOWED_EMBED_HOSTS = [
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "vimeo.com",
  "scratch.mit.edu",
  "replit.com",
  "repl.co",
  "docs.google.com",
  "drive.google.com",
  "trinket.io",
  "codepen.io",
  "codesandbox.io",
  "stackblitz.com",
  "editor.p5js.org",
  "wokwi.com",
  "tinkercad.com",
  "makecode.microbit.org",
  "makecode.com",
  "wordwall.net",
  "padlet.com",
  "canva.com",
  "genial.ly",
  "loom.com",
  "techlanditalia.it",
] as const;

export function isAllowedEmbed(src: string | null | undefined): boolean {
  if (!src) return false;
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return ALLOWED_EMBED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

/**
 * Da applicare all'HTML già passato da DOMPurify: gli iframe di domini non
 * ammessi vengono sostituiti da un link al contenuto (o rimossi se l'indirizzo
 * non è http/https). Senza DOM (prerender in Node) restituisce l'HTML invariato:
 * lezioni e compiti stanno nell'area riservata, che non viene prerenderata.
 */
export function restrictEmbeds(html: string): string {
  if (typeof document === "undefined" || !html.includes("<iframe")) return html;
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("iframe").forEach((iframe) => {
    const src = iframe.getAttribute("src");
    if (isAllowedEmbed(src)) return;
    let href: URL | null = null;
    try {
      href = src ? new URL(src) : null;
    } catch {
      href = null;
    }
    if (!href || (href.protocol !== "https:" && href.protocol !== "http:")) {
      iframe.remove();
      return;
    }
    const link = document.createElement("a");
    link.href = href.toString();
    link.target = "_blank";
    link.rel = "noopener noreferrer nofollow";
    link.textContent = `Apri il contenuto esterno (${href.hostname})`;
    const p = document.createElement("p");
    p.appendChild(link);
    iframe.replaceWith(p);
  });
  return template.innerHTML;
}
