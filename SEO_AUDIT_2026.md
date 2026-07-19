# SEO Technical Audit — techlanditalia.it

**Data:** 19 luglio 2026
**Scope:** repo `techlanditalia` (Vite/React SPA + Supabase, hosting Lovable/Cloudflare) + verifiche live su https://techlanditalia.it
**Metodo:** analisi statica del sorgente, verifiche HTTP live (`curl`), query read-only sull'API pubblica Supabase (chiave publishable), validazione JSON-LD via parser.
**Nota:** nessuna modifica al codice è stata effettuata. Ogni finding riporta evidence riproducibile (file:linea o comando).

---

## Executive Summary

Il sito ha buone fondamenta on-page (canonical per-route, meta robots gestiti, font self-hosted, JSON-LD sintatticamente valido) ma **tre criticità strutturali annullano gran parte del lavoro SEO fatto**:

1. **L'hosting ignora `public/_redirects` e `public/_headers` (formato Netlify)** → la sitemap "dinamica" non è mai servita: online c'è il file statico di aprile 2026 con 68 articoli su 86 pubblicati e slug corso non più esistenti (SEO-008/009).
2. **Tre cataloghi corsi divergenti convivono** (5 hardcoded nel codice, 8 nel DB con slug diversi, 9 in llms.txt) → pagine duplicate live in cannibalizzazione (es. `/corsi/roblox` e `/corsi/sviluppo-giochi-con-roblox` entrambe 200) ed età-target incoerenti su 4 livelli (SEO-010/005).
3. **robots.txt inefficace per Googlebot**: i gruppi per-bot specifici fanno sì che i `Disallow` (gruppo `*`) non si applichino ai motori principali → `/admin`, `/area-riservata`, `/auth` crawlabili (SEO-011).

Impatto previsto della remediation: sitemap corretta + consolidamento catalogo + robots fix possono recuperare l'indicizzazione di ~18 articoli assenti e concentrare il ranking sulle pagine corso giuste — leva primaria per un business early-stage dove la SEO è il canale di crescita principale.

---

## Findings dettagliati

> Severità: Critical / High / Medium / Low · Effort: S (<0,5 gg) / M (0,5–2 gg) / L (>2 gg)

---

### SEO-001 — Prerendering assente (SPA client-side pura)

- **Severità:** Critical · **Effort:** L · **Stato:** CONFERMATO (già in risoluzione su track separato)
- **Impact SEO:** l'HTML iniziale è vuoto: title/description/canonical/robots/schema per-route esistono solo dopo l'esecuzione JS. Google renderizza, ma con ritardo e budget limitato; Bing e molti crawler AI (fonte primaria per GEO/AEO, dichiarata prioritaria nel robots.txt) non renderizzano affatto → per loro ogni pagina è identica a `index.html`. Tutti i fix meta/schema di questo audit hanno effetto pieno solo con prerendering.
- **Evidence:**
  - `curl -s https://techlanditalia.it/ | grep '<div id="root">'` → `<div id="root"></div>` (vuoto)
  - `vite.config.ts` — nessun plugin prerender/SSG
  - `curl -s https://techlanditalia.it/ | grep -c "og:title"` → `1` (solo il tag statico)
- **Fix proposto:** già in corso separatamente. Raccomandazione: prerender build-time delle route pubbliche (home, /corsi, /corsi/:slug, /chi-siamo, /faq, /prenota, /contatti, /glossario, /blog + articoli) — es. `vite-plugin-prerender` o build SSG dedicata; in alternativa prerendering edge (Prerender.io / Cloudflare Worker con rendering per bot).
- **Rischi del fix:** idratazione incoerente (mismatch React), contenuti dinamici da Supabase da "congelare" al build (serve rebuild/webhook alla pubblicazione articoli), rotte private da escludere.

---

### SEO-002 — Fonti duplicate di meta tag (index.html statico + Helmet)

- **Severità:** High · **Effort:** S · **Stato:** CONFERMATO
- **Impact SEO:** `react-helmet-async` **appende** i propri tag senza rimuovere quelli statici di `index.html`. Il DOM renderizzato contiene su ogni route: doppia `meta description`, doppio blocco `og:*` e `twitter:*`, **doppio `meta robots`**. Sulle `/lp/` i due robots sono in conflitto (`index, follow` statico vs `noindex, nofollow` Helmet): Google applica il più restrittivo, ma è fragile e i crawler non-JS vedono solo `index, follow`. I social scraper (che non eseguono JS) leggono sempre l'og:url/og:title della homepage.
- **Evidence:**
  - `index.html:17-61` — title, `meta name="title"`, description, robots, og:*, twitter:* statici
  - `src/components/seo/SEOHead.tsx:49-77` — stessi tag emessi via Helmet su ogni pagina
  - `index.html:25` `robots: index, follow` vs `SEOHead.tsx:54` `noindex` per `/lp/`
- **Fix proposto:** ridurre `index.html` a fallback minimo: tenere solo `<title>`, charset, viewport, favicon, preload e i due schema Organization/WebSite; **rimuovere** description, `meta name="title"`, robots, googlebot, og:*, twitter:*, geo tags dal file statico (diventeranno responsabilità esclusiva di `SEOHead`, prerenderizzati con SEO-001). In alternativa (senza prerender) invertire: lasciare i tag statici e far gestire a Helmet solo i delta — ma è la strategia peggiore per le pagine interne.
- **Rischi del fix:** finché il prerendering non è attivo, rimuovere i tag statici lascia i crawler non-JS senza description/og → sequenzialità: applicare questo fix **insieme** o **dopo** SEO-001. Se applicato prima, i social share di tutte le pagine perdono l'anteprima.

---

### SEO-003 — hreflang e og:url statici hardcoded su `/`

- **Severità:** Medium · **Effort:** S · **Stato:** PARZIALE (canonical risolto, residui presenti)
- **Impact SEO:** il canonical hardcoded su `/` (problema noto #3) **è stato risolto**: nessun canonical statico ( commento a `index.html:75`) e ogni pagina pubblica passa il proprio (verificato su Index, Corsi, ChiSiamo, Blog, BlogArticle, FAQ, Prenota, Glossario, Contatti). Restano però hardcoded su `/` per tutte le route: `hreflang it`/`x-default` (`index.html:34-35`) e `og:url` (`index.html:39`). Ogni pagina dichiara quindi come "alternate" la homepage → segnale di consolidamento errato, che contraddice il canonical corretto. Inoltre `SEOHead.tsx:60-61` emette un secondo set di hreflang per-route → duplicazione.
- **Evidence:**
  - `index.html:34-35` — `<link rel="alternate" hreflang="it|x-default" href="https://techlanditalia.it/" />`
  - `index.html:39` — `og:url` = `/`
  - `src/components/seo/SEOHead.tsx:60-61` — hreflang duplicati via Helmet
- **Fix proposto:** **rimuovere completamente gli hreflang** (statici e in SEOHead): sito monolingua italiano con un solo dominio — hreflang non serve e self-referencing `it`+`x-default` non porta benefici, solo rischio di errori. Rimuovere anche `og:url` statico (coperto da SEOHead).
- **Rischi del fix:** nessuno significativo. Se in roadmap c'è una versione EN, reintrodurre hreflang solo allora, per-route e reciproci.

---

### SEO-004 — Inaccuratezze fattuali e problemi di validità negli schema JSON-LD

- **Severità:** High · **Effort:** M · **Stato:** CONFERMATO
- **Impact SEO:** gli schema sono sintatticamente validi (verificato con parser: entrambi i blocchi di `index.html` parsano OK) ma contengono errori fattuali e pattern deprecati che minano rich results ed entity building — critico per la disambiguazione dal brand "Techland" (studio polacco):
  1. **Immagine inesistente nello schema BlogPosting**: `src/pages/BlogArticle.tsx:115` usa `og-image.jpg` come fallback — il file live è `og-image.png` (`public/og-image.png`; `curl -o /dev/null -w "%{http_code}" https://techlanditalia.it/og-image.jpg` → verifica). Articoli senza featured image dichiarano un'immagine 404.
  2. **Publisher logo = favicon**: `BlogArticle.tsx:127` usa `favicon.ico` come logo publisher — Google richiede un logo reale (esiste `generateBlogPostSchema` in `SEOHead.tsx:192-227` con logo corretto, **ma non è usato**: BlogArticle ridefinisce lo schema inline).
  3. **`dateModified` sempre = `created_at`** (`BlogArticle.tsx:117`): il campo `updated_at` esiste in DB (usato da `generate-sitemap`) ma non viene passato → si perde il segnale di freshness.
  4. **`knowsAbout` cita Scratch, Minecraft Education, Unity** (`index.html:126-136`) e la description homepage promette "Scratch, Roblox, Minecraft, Python" (`Index.tsx:43`), ma nel set hardcoded non esistono corsi Scratch/Minecraft/Unity e nel DB gli slug sono diversi (vedi SEO-010). Unity non esiste in nessun catalogo.
  5. **HowTo schema** (`Index.tsx:25-36`): Google ha rimosso i rich result HowTo da agosto 2023 — markup morto che aggiunge rumore.
  6. **FAQPage duplicata**: homepage (`Index.tsx:23,46`) e `/faq` (`FAQ.tsx:165,174`) emettono entrambe FAQPage con domande sovrapposte; inoltre da aprile 2023 Google mostra FAQ rich results quasi solo per siti governativi/sanitari.
  7. **Due EducationalOrganization non allineate**: `index.html:84-150` (con `@id`, founder, Veneto) e `SEOHead.tsx:104-133` (`organizationSchema`, senza `@id`, senza founder) — se usata entrambe generano entità duplicate. Positivo: `alternateName` con varianti brand e `LocalBusiness/AggregateRating` rimossi correttamente (commento a `index.html:172`).
- **Evidence:** righe citate sopra; validazione sintassi: `python3` + `json.loads` sui blocchi ld+json di index.html → `schema 0: OK — EducationalOrganization`, `schema 1: OK — WebSite`.
- **Fix proposto:**
  - BlogArticle: eliminare lo schema inline e usare `generateBlogPostSchema` correggendone il fallback (`og-image.png`) e passando `dateModified: post.updated_at`;
  - allineare `knowsAbout`/description ai corsi realmente offerti (dipende dalla decisione su SEO-010);
  - rimuovere HowTo; tenere FAQPage solo su `/faq`;
  - unificare l'org schema: un'unica fonte con `@id` (`#organization`) referenziata ovunque (Course provider già usa `@id`, `SEOHead.tsx:162`).
- **Rischi del fix:** nessuna regressione tecnica; l'allineamento di `knowsAbout` va coordinato con la decisione di prodotto sul catalogo (SEO-010) per non doverlo riscrivere due volte.

---

### SEO-005 — Messaggistica età-target incoerente (4 fonti divergenti)

- **Severità:** High · **Effort:** M · **Stato:** CONFERMATO, più esteso del previsto
- **Impact SEO:** le età dichiarate divergono **dentro la stessa pagina** (meta title vs contenuto), tra pagine, nel DB e nei file per LLM. Per un target genitori l'età è il criterio di scelta n.1: incoerenza = perdita di fiducia, snippet SERP che contraddicono la pagina, e risposte sbagliate dai motori AI (che leggono llms.txt).
- **Evidence (stesso corso, quattro età):**
  | Corso | Meta title (`CorsoDettaglio.tsx:766-770`) | Dato on-page (`CorsoDettaglio.tsx:51-469`) | DB (`courses.age_range`, via REST) | `llms.txt` |
  |---|---|---|---|---|
  | Roblox | 10-14 | **8+** | 9+ (`sviluppo-giochi-con-roblox`) | 10-14 |
  | Roblox Avanzato | 10-14 | 10-14 | **10+** | **12-16** |
  | Python Base | 12-16 | **13+** | **11+** | 12-16 |
  | Python AI/avanzato | 14-18 | **13+** | 14+ (`python-avanzato`) | 14-18 |
  | Web Development | 12-16 | **13+** | (assente in DB) | 12-16 |
  - `public/llms.txt:9` — "Età alunni: **5–20 anni**" vs claim "6-18" in tutto il sito (`index.html:18`, `Index.tsx:42`)
  - `src/components/corsi/LearningRoadmap.tsx:20-59` — fasce 5-7 / 7-9 / 9-12 / 12+ (parte da 5, non da 6)
  - `Index.tsx:13` — FAQ homepage: "partono dai 6 anni… strumenti visivi come Scratch" ma nessun corso Scratch nel set hardcoded
- **Fix proposto:** definire una **matrice età unica** (una riga per corso, campo `age_range` nel DB come single source of truth) e propagarla: meta title/description generati dai dati del corso (non da mappe hardcoded separate), LearningRoadmap, llms.txt (rigenerato da `generate-llms-content`), FAQ homepage, schema `audienceType`. Decidere la fascia ufficiale (6-18? 5-18?) e usarla ovunque.
- **Rischi del fix:** cambiare i meta title delle pagine corso già indicizzate causa una fluttuazione temporanea di CTR/ranking; le nuove età devono essere validate dal team didattico prima della propagazione.

---

### SEO-006 — Landing `/lp/`: noindex presente ma segnali contraddittori

- **Severità:** Medium · **Effort:** S · **Stato:** PARZIALMENTE RISOLTO
- **Impact SEO:** il rischio cannibalization è stato mitigato in codice: `LandingPage.tsx:104` imposta `noIndex={true}` e `LandingPage.tsx:61-68` mappa il canonical delle `/lp/` duplicate verso la pagina corso ("Strategy B"). Restano tre incoerenze: (a) le 6 URL `/lp/` sono **nella sitemap servita live** — dire a Google "indicizza" (sitemap) e "non indicizzare" (meta) spreca crawl budget e genera warning in Search Console; (b) `noindex + canonical` sono segnali contraddittori (Google ignora il canonical su pagine noindex); (c) il noindex arriva solo via JS: il primo HTML dichiara `index, follow` (`index.html:25`) — i crawler non-JS le considerano indicizzabili.
- **Evidence:**
  - `curl -s https://techlanditalia.it/sitemap.xml | grep "lp/"` → 6 URL (`/lp/scratch`, `/lp/abc-informatica`, `/lp/roblox`, `/lp/minecraft`, `/lp/python`, `/lp/python-ai`)
  - `src/pages/LandingPage.tsx:100-104` — `noIndex={true}` + `canonical={canonicalUrl}`
  - `public/robots.txt` — nessuna regola per `/lp/`
- **Fix proposto:** scegliere UNA strategia e allineare tutti i segnali. Consigliata: `/lp/` = pagine ads pure → `noindex` (senza canonical verso il corso), **escluderle dalla sitemap** (verificare che `generate-sitemap/index.ts` non le includa; il file statico sì), e aggiungere `Disallow: /lp/` in robots.txt è **da evitare** finché il noindex deve essere visto (bloccare il crawl impedirebbe di leggere il noindex) — solo dopo la deindicizzazione completa si può valutare il Disallow.
- **Rischi del fix:** se le `/lp/` ricevono backlink o traffico organico oggi, il noindex li azzera (era la scelta già presa in codice — verificare in Search Console prima). Non aggiungere Disallow subito: bloccherebbe la lettura del noindex.

---

### SEO-007 — `.env` tracciato in git e assente da `.gitignore`

- **Severità:** High (security hygiene) · **Effort:** S · **Stato:** CONFERMATO, gravità ridotta
- **Impact SEO:** indiretto (security/trust). Il file `.env` è ancora versionato e `.gitignore` non lo esclude: ogni futuro secret aggiunto lì finirebbe in git (e il repo è già stato pubblico in passato).
- **Evidence:**
  - `git ls-files | grep env` → `.env` tracciato
  - `.gitignore` — nessuna riga `.env`
  - Audit storia completa (2 commit toccano `.env`): contiene **solo** chiavi publishable/anon Supabase e URL di progetto (nomi: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_*`). **Nessun service-role key o secret mai committato.** Le chiavi publishable sono per design pubbliche (già esposte nel bundle JS) → nessuna rotazione urgente richiesta, ma verificare che le RLS policy Supabase siano solide (l'anon key permette query dirette al DB, come dimostrato in questo stesso audit).
- **Fix proposto:**
  1. Aggiungere a `.gitignore`: `.env`, `.env.*`, `!.env.example`
  2. `git rm --cached .env` + commit; creare `.env.example` con soli nomi chiave
  3. (Opzionale, se si vuole ripulire la storia: `git filter-repo --path .env --invert-paths` — invasivo, vedi rischi)
  4. Review RLS: verificare con `get_advisors` Supabase che tabelle come `blog_posts`, `courses`, `bookings` espongano solo ciò che serve all'anon key.
- **Rischi del fix:** il rewrite della storia (punto 3) invalida i clone esistenti e i riferimenti Lovable — dato che non ci sono secret veri, **sconsigliato**; bastano i punti 1-2. Attenzione: il build Vite legge `.env` → assicurarsi che il file resti presente localmente/nel CI dopo il de-tracking.

---

### SEO-008 — L'hosting ignora `public/_redirects` e `public/_headers` (formato Netlify)

- **Severità:** Critical · **Effort:** M · **Stato:** NUOVO — root cause di SEO-009 e SEO-013
- **Impact SEO:** il repo assume un hosting Netlify-compatibile, ma il sito è servito da Lovable/Cloudflare che non processa quei file. Conseguenze: (1) il proxy `/sitemap.xml → generate-sitemap` edge function non è attivo → sitemap perennemente stale (SEO-009); (2) tutti gli header custom (CSP completa, HSTS con preload, cache-control per asset, `Content-Type: text/markdown` e `X-Robots-Tag` per i mirror .md) non sono applicati; (3) qualsiasi futura regola di redirect 301 scritta lì sarebbe silenziosamente ignorata.
- **Evidence:**
  - `public/_redirects:3` — `/sitemap.xml → https://<project>.supabase.co/functions/v1/generate-sitemap 200`
  - `curl -s https://techlanditalia.it/sitemap.xml` → 17.453 byte, **byte-identico** a `public/sitemap.xml` statico (stesso size, stessi 91 URL, lastmod 2026-04-19) → il proxy non scatta
  - `curl -sI https://techlanditalia.it/` → `content-security-policy: frame-ancestors 'self'` (host-level) ≠ CSP completa definita in `public/_headers:3`; `strict-transport-security: max-age=31536000` ≠ `max-age=63072000; preload` del file
  - `server: cloudflare`, `x-deployment-id: …` → hosting Lovable/Cloudflare, non Netlify
- **Fix proposto:** decisione infrastrutturale (vedi "Fix rischiosi"): (a) verificare se Lovable hosting espone un meccanismo per redirect/header custom; (b) altrimenti spostare il dominio dietro una zona Cloudflare propria con Redirect Rules + Response Header Transform Rules + un Worker per proxare `/sitemap.xml` alla edge function; (c) in alternativa minimale, rigenerare `public/sitemap.xml` statico ad ogni build/pubblicazione (script che chiama `generate-sitemap` e scrive il file). Rimuovere o correggere `_redirects`/`_headers` per non lasciare configurazione morta che dà falsa sicurezza.
- **Rischi del fix:** migrare DNS/hosting è l'operazione più delicata dell'audit (downtime, TLS, comportamento SPA fallback). La via (c) è a rischio zero ma copre solo la sitemap, non header né redirect.

---

### SEO-009 — Sitemap servita: stale, incompleta e con URL fantasma

- **Severità:** Critical · **Effort:** S (con la via minimale di SEO-008) · **Stato:** NUOVO
- **Impact SEO:** la sitemap live è la fotografia di aprile 2026:
  - **68 articoli blog su 86 pubblicati** → 18 articoli (il 21%) non segnalati a Google; con una SPA senza prerender e paginazione client-side (SEO-016), la sitemap è di fatto l'unico canale di discovery affidabile → quegli articoli rischiano di non essere mai indicizzati.
  - Include i 5 slug corso **hardcoded/vecchi** (`/corsi/roblox`, `/corsi/web-development`, `/corsi/python-ai`…) e nessuno degli 8 slug DB attuali → Google indicizza il catalogo sbagliato.
  - Include le 6 `/lp/` noindexate (contraddizione, SEO-06).
  - `lastmod` uniforme `2026-04-19` su quasi tutto → segnale di freshness inutilizzabile.
  - Manca `/glossario` (presente invece in `generate-sitemap/index.ts:23`).
- **Evidence:**
  - `curl -s https://techlanditalia.it/sitemap.xml | grep -c "<url>"` → 91
  - `grep -c "blog/" public/sitemap.xml` → 68 vs API REST `blog_posts?published=eq.true` → **86** (`content-range: 0-85/86`)
  - Corsi in sitemap: `roblox, roblox-avanzato, web-development, python-base, python-ai` vs DB visibile: `sviluppo-giochi-con-roblox, programmazione-visiva-con-scratch, programmazione-visiva-con-minecraft, informatica-di-base, design-creativo, python-avanzato, python-base, roblox-avanzato`
- **Fix proposto:** attivare la sitemap dinamica (SEO-008) **oppure** script di build che rigenera `public/sitemap.xml` dal DB ad ogni deploy + webhook di rebuild alla pubblicazione articoli. In ogni caso: escludere `/lp/`, allineare gli slug corso alla decisione SEO-010, usare `updated_at` reale come lastmod. Dopo il fix: risubmit in Search Console.
- **Rischi del fix:** se si attiva la sitemap dinamica **prima** di consolidare il catalogo (SEO-010), Google riceverà l'URL set nuovo mentre le pagine vecchie sono ancora live senza redirect → fare SEO-010 e SEO-009 nella stessa release, o quantomeno in quest'ordine.

---

### SEO-010 — Catalogo corsi triplicato: cannibalizzazione e contenuti duplicati live

- **Severità:** Critical · **Effort:** L · **Stato:** NUOVO — richiede decisione di prodotto
- **Impact SEO:** esistono tre cataloghi non allineati:
  1. **Hardcoded** in `CorsoDettaglio.tsx:45-505`: 5 slug (`roblox`, `roblox-avanzato`, `web-development`, `python-base`, `python-ai`) — serviti con priorità (il componente controlla prima `coursesData`, poi fa fallback DB a `CorsoDettaglio.tsx:622-664`);
  2. **DB Supabase** (fonte della pagina `/corsi`, `Corsi.tsx:52-53`): 8 slug diversi (`sviluppo-giochi-con-roblox`, `programmazione-visiva-con-scratch`, `programmazione-visiva-con-minecraft`, `informatica-di-base`, `design-creativo`, `python-avanzato`, `python-base`, `roblox-avanzato`);
  3. **llms.txt**: 9 corsi con un terzo set di slug (`scratch`, `minecraft-education`, `abc-informatica`, `abc-creativita-digitale`…) in gran parte inesistenti.
  Risultato verificato live: `/corsi/roblox` (hardcoded) e `/corsi/sviluppo-giochi-con-roblox` (DB) rispondono entrambe 200 con lo stesso corso Roblox → **cannibalizzazione interna reale**, non più solo `/lp/` vs corso. La sitemap punta al set vecchio, la navigazione interna al set nuovo → Google vede due alberi che non si linkano a vicenda.
- **Evidence:**
  - `grep -n '"[a-z-]*": {' src/pages/CorsoDettaglio.tsx` → 5 chiavi hardcoded (righe 45, 149, 253, 359, 463)
  - API REST `courses?is_visible=eq.true` → 8 slug (output nel §SEO-005)
  - `curl -o /dev/null -w "%{http_code}" https://techlanditalia.it/corsi/scratch` → 200 (soft-404: slug in llms.txt ma inesistente in codice e DB)
  - Un articolo blog campionato linka `/corsi/scratch` (ghost) — vedi SEO-015
- **Fix proposto (dopo decisione di prodotto su quali slug sono canonici):**
  1. Scegliere **un solo set di slug** (consiglio: slug corti hardcoded — `roblox`, `scratch`, `python-base` — sono migliori per keyword e già indicizzati; rinominare gli slug DB di conseguenza) e rendere il **DB l'unica fonte dati** (contenuti hardcoded migrati nel DB);
  2. redirect 301 dagli slug deprecati (richiede capacità redirect dell'hosting → SEO-008); in assenza, canonical + link interni coerenti come ripiego;
  3. rigenerare sitemap e llms.txt dal DB;
  4. `CorsoDettaglio` legge solo dal DB (meta title/description generati dai campi del corso → risolve anche SEO-005).
- **Rischi del fix:** rinominare slug indicizzati senza 301 reali (dipendenza SEO-008) perde equity; la migrazione dei contenuti hardcoded (moduli, 32 lezioni per corso) nel DB è lavoro editoriale con rischio typo/perdita contenuto; coordinare con le campagne ads che puntano alle `/lp/` o alle pagine corso.

---

### SEO-011 — robots.txt: i gruppi per-bot annullano i Disallow per Googlebot/Bingbot

- **Severità:** High · **Effort:** S · **Stato:** NUOVO
- **Impact SEO:** per lo standard robots, un crawler usa **solo** il gruppo più specifico che lo matcha. `Googlebot` matcha il proprio gruppo (`Allow: /` e null'altro) e **ignora completamente** il gruppo `*` dove stanno tutti i `Disallow` → per Googlebot, Bingbot e tutti i 20+ bot AI elencati, `/admin`, `/area-riservata`, `/insegnante`, `/auth` sono crawlabili. Solo i crawler NON elencati rispettano i Disallow. Spreco di crawl budget su ~60 route private e rischio indicizzazione di pagine login/dashboard.
- **Evidence:** `public/robots.txt` — gruppi `User-agent: Googlebot / Allow: /` (righe 6-8) … gruppo `User-agent: *` seguito dai `Disallow` (righe finali). Test con Search Console robots tester riproducibile: URL `/admin/login` risulta Allowed per Googlebot.
- **Fix proposto:** semplificare drasticamente:
  ```
  # robots.txt
  User-agent: *
  Allow: /
  Disallow: /admin
  Disallow: /area-riservata
  Disallow: /insegnante
  Disallow: /auth

  Sitemap: https://techlanditalia.it/sitemap.xml
  ```
  I gruppi per-bot con `Allow: /` non aggiungono nulla (Allow è il default); se si vogliono mantenere per esplicitare il benvenuto ai bot AI, **ogni gruppo deve ripetere i Disallow**. Rimuovere `Crawl-delay` (ignorato da Google, deprecato da Bing).
- **Rischi del fix:** nessuno. Nota: robots.txt non impedisce l'indicizzazione di URL linkati esternamente (solo il crawl) — le pagine private sono comunque dietro auth.

---

### SEO-012 — Soft-404: le route inesistenti rispondono HTTP 200

- **Severità:** High · **Effort:** M · **Stato:** NUOVO (confermato live)
- **Impact SEO:** ogni URL inventata restituisce 200 con la shell SPA → Google la classifica "soft 404" (nel migliore dei casi) o la indicizza (nel peggiore). Con i ghost-slug in circolazione (llms.txt, vecchi link, articoli blog che linkano `/corsi/scratch`) il sito genera un numero illimitato di URL 200 duplicate. La pagina NotFound aggrava: nessun `noindex`, testo **in inglese** su sito italiano, nessun layout/nav (`NotFound.tsx:11-21`).
- **Evidence:**
  - `curl -o /dev/null -w "%{http_code}" https://techlanditalia.it/pagina-inesistente-xyz` → `200`
  - `src/pages/NotFound.tsx` — nessun SEOHead/noindex; "Oops! Page not found"
  - `CorsoDettaglio.tsx:747` gestisce il 404 client-side ma sempre con status 200
- **Fix proposto:** un vero 404 server-side richiede prerendering o hosting con regole (SEO-008). Mitigazioni immediate lato SPA: aggiungere in NotFound `<SEOHead noIndex title="Pagina non trovata" …/>`, tradurre in italiano, usare `<Layout>` con link a corsi/blog/prenota. Con il prerendering (SEO-001): generare una pagina `/404.html` che l'hosting serva con status 404 per le route non prerenderizzate.
- **Rischi del fix:** la mitigazione client-side è a rischio zero; il 404 reale dipende dalle scelte di SEO-001/008 — attenzione a non servire 404 alle route dinamiche legittime (`/blog/:slug` nuovi articoli non ancora prerenderizzati).

---

### SEO-013 — Redirect www 302 (non 301); trailing-slash e maiuscole senza normalizzazione

- **Severità:** Medium · **Effort:** S (se l'hosting lo consente) · **Stato:** NUOVO
- **Impact SEO:** `www.techlanditalia.it` → 302 verso il dominio apex: il 302 non consolida stabilmente i segnali (Google di solito lo tratta come 301 col tempo, ma è un segnale debole evitabile). `/corsi/` e `/CORSI` rispondono 200 senza redirect → tre varianti della stessa URL tutte 200; il canonical via JS mitiga, ma solo per i crawler che renderizzano.
- **Evidence:**
  - `curl -sI https://www.techlanditalia.it/` → `302 → https://techlanditalia.it/`
  - `curl -o /dev/null -w "%{http_code} %{redirect_url}" https://techlanditalia.it/corsi/` → `200` (nessun redirect); idem `/CORSI` → `200`
- **Fix proposto:** dove l'infrastruttura lo consente (SEO-008): www→apex in **301**; redirect 301 di normalizzazione trailing-slash (`/corsi/` → `/corsi`); per il case, un redirect lowercase o almeno garantire che il router mostri NotFound noindex (già così: React Router è case-sensitive, ma con status 200 → torna SEO-012). Nel frattempo, assicurarsi che tutti i link interni e la sitemap usino la forma canonica senza slash finale (già verificato coerente).
- **Rischi del fix:** regole redirect troppo aggressive possono rompere asset o route con querystring — testare su staging; il 301 www è a rischio zero.

---

### SEO-014 — llms.txt/mirror .md: link rotti, corsi fantasma e dati incoerenti

- **Severità:** Medium (alta priorità per la strategia GEO/AEO dichiarata) · **Effort:** S · **Stato:** NUOVO
- **Impact SEO/GEO:** llms.txt è il canale scelto per i motori AI, ma oggi li disinforma: elenca 9 corsi con slug in gran parte inesistenti, link a mirror `.md` che rispondono 404, ed età contraddittorie (vedi SEO-005). Un LLM che consuma questi file consiglierà corsi e URL sbagliati — l'opposto dell'obiettivo di disambiguazione brand.
- **Evidence:**
  - `curl -o /dev/null -w "%{http_code}" https://techlanditalia.it/corsi/roblox.md` → **404**; idem `/blog.md` → **404** (entrambi linkati da `public/llms.txt:31,43`)
  - `public/llms.txt:9` — "Età alunni: 5–20 anni"
  - `public/llms.txt:27-35` — corsi `abc-creativita-digitale`, `abc-informatica`, `scratch`, `minecraft-education`: nessuno esiste come route servibile con contenuto (soft-404)
  - Esiste già `supabase/functions/generate-llms-content/index.ts` (generazione dinamica) — **da verificare** se e dove viene invocata: i file in `public/` sembrano snapshot manuali.
- **Fix proposto:** rigenerare `llms.txt`/`llms-full.txt` e i mirror `.md` dalla stessa fonte dati del sito (DB) dopo il consolidamento SEO-010; creare i mirror `.md` mancanti per i corsi o rimuovere i link; allineare l'età alla matrice unica (SEO-005). Inserire la rigenerazione nel processo di deploy come per la sitemap.
- **Rischi del fix:** nessuno tecnico; dipende dall'ordine (dopo SEO-010/005 per non pubblicare due volte dati diversi).

---

### SEO-015 — Internal linking debole: blog isolato e footer quasi vuoto

- **Severità:** High · **Effort:** M · **Stato:** NUOVO
- **Impact SEO:** con ~86 articoli, il blog è l'asset SEO principale, ma: (a) campione di 5 articoli via API → 3 su 5 hanno **zero link interni** nel corpo; (b) l'unico link trovato verso un corso punta a `/corsi/scratch` (ghost slug → soft-404); (c) `BlogArticle` non ha modulo "articoli correlati" — l'unica uscita è il CTA `/prenota`; (d) il footer ha **2 soli link interni** (`/` e `/accessibilita`, `Footer.tsx:61,172`) → nessuna distribuzione di link equity site-wide verso corsi/FAQ/blog. Il PageRank interno resta intrappolato nella home e gli articoli non spingono le pagine corso (che sono le pagine transazionali).
- **Evidence:**
  - Query REST su 5 articoli pubblicati: `internal links: 0` per 3 articoli; `coding-matematica-bambini` → 4 link di cui `/corsi/scratch` (inesistente)
  - `src/components/layout/Footer.tsx` — grep `to="/…"` → solo 2 route interne
  - `src/pages/BlogArticle.tsx:230-240` — dopo il contenuto solo CTA, nessun related-posts (Blog.tsx ha logica related solo nella lista, riga 623)
- **Fix proposto:**
  1. Footer: aggiungere colonne link (Corsi principali, Blog, FAQ, Chi siamo, Prenota, Glossario);
  2. `BlogArticle`: componente "Articoli correlati" (stessa categoria, 3 item) + box "Corso consigliato" mappato per categoria articolo;
  3. Passata editoriale sui contenuti in DB: aggiungere 2-4 link interni per articolo verso corsi/altri articoli (identificare i ghost link con uno script che estrae `](/…)` dai contenuti e li confronta con le route valide);
  4. Le pagine corso dovrebbero linkare gli articoli pertinenti (sezione "Approfondimenti dal blog").
- **Rischi del fix:** i link editoriali in DB vanno riscritti dopo il consolidamento slug (SEO-010), non prima, altrimenti si creano nuovi link rotti.

---

### SEO-016 — Discovery del blog dipendente da JS: paginazione client-side

- **Severità:** Medium · **Effort:** M · **Stato:** NUOVO
- **Impact SEO:** `/blog` carica tutti i post e li pagina client-side (`Blog.tsx:225`, `slice(start, end)`): i link agli articoli oltre pagina 1 non esistono nell'HTML iniziale e i "pulsanti" di paginazione sono `onClick` senza `href` (`Blog.tsx:697`) → nessun percorso di crawl verso ~70 articoli. Con la sitemap stale (SEO-009), gli articoli recenti sono invisibili.
- **Evidence:** `src/pages/Blog.tsx:225,678-697` — paginazione via `setCurrentPage`, nessun link `?page=N` o route `/blog/pagina/N`.
- **Fix proposto:** insieme al prerendering: paginazione con URL reali (`/blog?page=2` o `/blog/pagina/2`) e `<a href>` reali nei controlli (React Router `<Link>`), così ogni pagina lista è crawlabile; in alternativa/complemento, sitemap dinamica affidabile (SEO-009) + related-posts (SEO-015) creano percorsi alternativi.
- **Rischi del fix:** URL di paginazione = nuove pagine thin da gestire (canonical self, no noindex — pattern standard); scegliere il formato URL una volta sola.

---

### SEO-017 — Asset pesanti e CLS: logo 545KB, og-image 793KB, featured image senza dimensioni

- **Severità:** Medium · **Effort:** S · **Stato:** NUOVO
- **Impact SEO:** Core Web Vitals a rischio su mobile: `logo.png` 545KB (usato come logo negli schema; se caricato in pagina è enorme per un logo), `og-image.png` 793KB (scaricata da ogni scraper social), featured image articolo senza `width`/`height` né lazy (`BlogArticle.tsx:204-208`) → CLS. Punti a favore già presenti: preload LCP desktop (`index.html:66-73`), varianti webp per i loghi corso, `loading="lazy"` nel parser markdown (`BlogArticle.tsx:42`), font self-hosted 3 pesi.
- **Evidence:** `ls -la public/` → `logo.png` 545.603B, `og-image.png` 793.810B; `BlogArticle.tsx:204-208` — `<img>` senza width/height.
- **Fix proposto:** comprimere `logo.png` (512×512 PNG ottimizzato o WebP: target <40KB) e `og-image.png` (1200×630, target <200KB, JPEG/WebP qualità 80); aggiungere `width`/`height` (o `aspect-video` già presente — verificare che riservi lo spazio) e `loading="lazy"` alla featured image; audit `OptimizedImage` (`src/components/ui/optimized-image.tsx`) e usarlo uniformemente.
- **Rischi del fix:** ricomprimere og-image può degradare l'anteprima social — validare visivamente; cache social da invalidare (Facebook Sharing Debugger).

---

### SEO-018 — Heading hierarchy: H1 iniettabili nel body articolo

- **Severità:** Low · **Effort:** S · **Stato:** NUOVO
- **Impact SEO:** `parseMarkdown` converte `# Titolo` in `<h1>` dentro il corpo articolo (`BlogArticle.tsx:41`) mentre la pagina ha già l'H1 col titolo (`BlogArticle.tsx:186`) → H1 multipli se un redattore usa `#`. Le altre pagine pubbliche hanno H1 singolo corretto (verificato via grep su tutte le page). `Prenota.tsx` ha due H1 ma in stati mutuamente esclusivi (form/successo) → ok.
- **Evidence:** `src/pages/BlogArticle.tsx:41` — regex `^# → <h1>`; DOMPurify consente `h1` (`BlogArticle.tsx:222`).
- **Fix proposto:** mappare `# → <h2>` (shift di tutta la gerarchia: `## → h2` resta, o degradare `#` a h2 e basta) e rimuovere `h1` dagli ALLOWED_TAGS; passata di controllo sui contenuti esistenti (`grep` via API dei content che iniziano righe con `# `).
- **Rischi del fix:** articoli che usavano `#` come titolo-sezione cambieranno resa visiva (da h1 a h2) — impatto grafico minimo.

---

### SEO-019 — Claim non verificabili: "scuola #1 in Italia", "1.200+ studenti formati"

- **Severità:** Medium (E-E-A-T / compliance) · **Effort:** S · **Stato:** NUOVO — decisione di prodotto
- **Impact SEO:** per un business dichiaratamente lanciato a inizio 2026, "La scuola di coding #1 per bambini in Italia" e "1.200+ studenti formati" (`HeroSection.tsx:24,57`) sono claim difficilmente sostanziabili. Rischio: quality rater / segnali E-E-A-T, ma soprattutto AI answer engines che citano e confrontano fonti (la collisione col brand Techland polacco rende probabile il fact-checking incrociato), e profili di rischio pubblicitario (Google Ads richiede claim di superiorità verificabili).
- **Evidence:** `src/components/sections/HeroSection.tsx:24` — badge "#1"; righe 55-58 — stat "1.200+ Studenti formati".
- **Fix proposto:** sostituire con claim verificabili ("Lezioni live in gruppi di max 6", "Prima lezione gratuita", recensioni Trustpilot reali quando disponibili — il loader esiste già: `TrustpilotLoader.tsx`). Se 1.200+ deriva da attività pregressa (altro brand/scuola), esplicitarne la fonte in `/chi-siamo`.
- **Rischi del fix:** possibile calo di conversione del hero — A/B test consigliato; decisione di marketing, non tecnica.

---

### SEO-020 — Prop `keywords` morta e keyword ridondanti in BlogArticle

- **Severità:** Low · **Effort:** S · **Stato:** NUOVO
- **Impact SEO:** nessun impatto diretto (correttamente `SEOHead` NON emette meta keywords, `SEOHead.tsx:53`), ma la prop `keywords` viene ancora passata da più pagine (`Index.tsx:45` con 15 keyword, `BlogArticle.tsx:144` con concatenazioni auto-generate) → codice morto che suggerisce una strategia obsoleta e confonde i futuri sviluppi.
- **Evidence:** `SEOHead.tsx:7,53` — prop accettata, mai renderizzata; call-site citati.
- **Fix proposto:** rimuovere la prop `keywords` dall'interfaccia e da tutti i call-site.
- **Rischi del fix:** nessuno.

---

### SEO-021 — Discrepanza inventario blog: 86 articoli pubblicati vs 210 attesi — **Da verificare**

- **Severità:** Da verificare · **Effort:** — · **Stato:** APERTO
- **Impact SEO:** il brief indica "blog con 210 articoli SEO/GEO/AEO", ma il DB espone **86 articoli pubblicati (86 totali, zero bozze visibili all'anon key)**. Possibilità: (a) 124 articoli in bozza non ancora pubblicati (invisibili via RLS all'anon key — plausibile); (b) pipeline `blog-auto-publish` (esiste: `supabase/functions/blog-auto-publish/index.ts`) con backlog programmato; (c) il numero 210 include contenuti pianificati. Se esistono 124 articoli pronti ma non pubblicati, è la quick win di contenuto più grande disponibile.
- **Evidence:** API REST `blog_posts?published=eq.true` → `content-range: 0-85/86`; senza filtro → identico (RLS nasconde le bozze).
- **Fix proposto:** verificare in `/admin` il conteggio reale di bozze/programmati; se c'è backlog, definire il calendario di pubblicazione e assicurarsi che sitemap dinamica (SEO-009) e rebuild prerender (SEO-001) scattino a ogni pubblicazione.
- **Rischi del fix:** pubblicare in massa 124 articoli in un giorno è un pattern innaturale — scaglionare (es. 3-5/settimana) è più sano per crawl e freshness.

---

### SEO-022 — Disambiguazione brand "Techland": buona base, entity building incompleto

- **Severità:** Medium · **Effort:** M · **Stato:** PARZIALE
- **Impact SEO:** la collisione con Techland (studio polacco di videogiochi) è la sfida brand n.1. Cose già fatte bene: `alternateName` con varianti ("TECHLAND Italia", "Techland Corsi"…) in `index.html:90`, naming coerente "TECHLAND | Coding per Bambini", `sameAs` verso i social. Mancano i segnali che consolidano l'entità distinta: nessun profilo Wikidata/Crunchbase nel `sameAs`, il `sameAs` LinkedIn punta a un profilo personale (`/in/techlanditalia/` — i brand usano `/company/`), nessuna pagina "chi-siamo" ottimizzata sulla query di disambiguazione ("TechLand Italia scuola di coding, non correlata a Techland S.A."), e senza prerender l'org schema arricchito è visibile solo nel fallback statico (unica cosa che i bot non-JS vedono — per fortuna è in index.html).
- **Evidence:** `index.html:90,112-116`; ricerca "techland" dominata dallo studio polacco (SERP note).
- **Fix proposto:** creare pagina LinkedIn **company** e correggere il sameAs; valutare voce Wikidata (gratuita, forte segnale entità); nel copy di `/chi-siamo` un paragrafo esplicito di disambiguazione; consolidare tutte le proprietà (GBP se esiste sede, Trustpilot) nel `sameAs` dell'unico org schema (SEO-004.7). Il brand naming "TECHLAND Italia" andrebbe usato in modo più sistematico nei title al posto del solo "TECHLAND".
- **Rischi del fix:** cambiare il suffisso dei title da "| TECHLAND" a "| TECHLAND Italia" tocca tutti i title indicizzati → fluttuazione temporanea; farlo una sola volta, insieme ai fix title di SEO-005.

---

## Piano prioritizzato

Ordinamento per (Severità × Impact) / Effort, con vincoli di sequenza indicati.

| # | ID | Titolo | Severità | Effort | Note di sequenza |
|---|----|--------|----------|--------|------------------|
| 1 | SEO-011 | Fix robots.txt (Disallow bypassati) | High | S | Indipendente, subito |
| 2 | SEO-007 | .env in .gitignore + de-track | High | S | Indipendente, subito |
| 3 | SEO-010 | Consolidamento catalogo corsi (decisione slug) | Critical | L | **Decisione prodotto prima di 4, 5, 9** |
| 4 | SEO-009 | Sitemap dinamica/rigenerata al deploy | Critical | S–M | Dopo la decisione di SEO-010 |
| 5 | SEO-005 | Matrice età unica e propagazione | High | M | Insieme a SEO-010 |
| 6 | SEO-008 | Strategia hosting per redirect/header | Critical | M | Sblocca 301 di SEO-010/013 e 404 reali |
| 7 | SEO-001 | Prerendering (track separato) | Critical | L | Sblocca pieno valore di 8, 12 |
| 8 | SEO-002 | Dedup meta tag statici vs Helmet | High | S | **Dopo/insieme a SEO-001** |
| 9 | SEO-015 | Internal linking (footer, related, blog→corsi) | High | M | Link editoriali dopo SEO-010 |
| 10 | SEO-012 | Soft-404: mitigazione client + 404 reale | High | M | Mitigazione subito; 404 reale dopo 6/7 |
| 11 | SEO-004 | Fix schema JSON-LD (immagini, date, dedup org) | High | M | knowsAbout dopo SEO-010 |
| 12 | SEO-021 | Chiarire inventario 86 vs 210 articoli | Da verificare | — | Solo input utente |
| 13 | SEO-014 | Rigenerare llms.txt e mirror .md | Medium | S | Dopo SEO-010/005 |
| 14 | SEO-006 | /lp/: allineare noindex/sitemap | Medium | S | Insieme a SEO-009 |
| 15 | SEO-013 | 301 www, trailing slash, case | Medium | S | Dipende da SEO-008 |
| 16 | SEO-022 | Entity building anti-collisione brand | Medium | M | Indipendente |
| 17 | SEO-016 | Paginazione blog crawlabile | Medium | M | Insieme a SEO-001 |
| 18 | SEO-017 | Ottimizzazione asset (logo, og-image, CLS) | Medium | S | Indipendente |
| 19 | SEO-019 | Revisione claim "#1"/"1.200+" | Medium | S | Decisione marketing |
| 20 | SEO-003 | Rimozione hreflang/og:url statici | Medium | S | Con SEO-002 |
| 21 | SEO-018 | H1 nel parser markdown | Low | S | Indipendente |
| 22 | SEO-020 | Rimozione prop keywords morta | Low | S | Indipendente |

---

## Quick wins (< 2h ciascuno)

Approvabili in blocco — nessuna decisione di prodotto richiesta, rischio regressione ~zero:

1. **robots.txt riscritto** (SEO-011): gruppo `*` unico con i Disallow, o Disallow ripetuti per ogni bot; via `Crawl-delay`.
2. **`.env` in `.gitignore` + `git rm --cached .env` + `.env.example`** (SEO-007).
3. **Fix `og-image.jpg` → `og-image.png`** nello schema BlogPosting e passaggio a `generateBlogPostSchema` con `updated_at` (SEO-004.1-3).
4. **Rimozione hreflang statici (index.html:34-35) e da SEOHead** + og:url statico (SEO-003) — nota: og:* statici restanti solo dopo SEO-001.
5. **Rimozione HowTo schema** dalla homepage e **FAQPage solo su /faq** (SEO-004.5-6).
6. **NotFound: noindex + italiano + Layout con link utili** (SEO-012 mitigazione).
7. **Compressione `logo.png` e `og-image.png`** + width/height sulla featured image (SEO-017).
8. **Fix parseMarkdown: `# ` → h2, h1 fuori da ALLOWED_TAGS** (SEO-018).
9. **Rimozione prop `keywords`** da SEOHead e call-site (SEO-020).
10. **Fix sameAs LinkedIn** → pagina company quando creata (SEO-022, parte tecnica).
11. **Allineare i meta title di CorsoDettaglio (righe 766-781) alle età on-page** come fix-tampone in attesa della matrice unica (SEO-005).

---

## Fix rischiosi (da discutere)

Richiedono decisione di prodotto/infrastruttura o hanno rischio di regressione concreto:

1. **Quale catalogo corsi è canonico?** (SEO-010) — slug corti hardcoded vs slug lunghi DB vs set llms.txt. La scelta determina redirect, sitemap, llms.txt, link interni. Consiglio: slug corti, DB come fonte dati. Serve anche decidere il destino di `web-development` (solo hardcoded) e `design-creativo`/`informatica-di-base` (solo DB).
2. **Strategia hosting** (SEO-008/013) — Lovable non processa `_redirects`/`_headers`: verificare le capability della piattaforma, oppure Cloudflare zone propria (Worker per sitemap proxy + Redirect Rules + header), oppure migrazione a hosting Netlify-compatibile. Impatta DNS/TLS: da pianificare con finestra di manutenzione.
3. **Pubblicazione del backlog articoli** (SEO-021) — se esistono ~124 bozze: cadenza, priorità tematiche, e trigger automatico sitemap/prerender a ogni pubblicazione.
4. **Rimozione claim "#1 in Italia" / "1.200+ studenti"** (SEO-019) — impatto conversione hero: decidere copy sostitutivo, eventuale A/B test.
5. **Strategia `/lp/`** (SEO-006) — mantenere noindex puro (solo ads) o differenziare i contenuti e indicizzarle per keyword long-tail? Se noindex: togliere il canonical→corso e le voci sitemap. Verificare prima in Search Console se hanno impression/backlink.
6. **Sequenza SEO-002 vs SEO-001** — rimuovere i meta statici prima del prerender peggiorerebbe la situazione per crawler non-JS e social scraper: i due interventi vanno rilasciati insieme.
7. **Suffisso brand nei title** ("| TECHLAND" → "| TECHLAND Italia", SEO-022) — tocca tutti i title indicizzati: farlo una sola volta, in coordinamento con i fix title di SEO-005.

---

## Appendice — Comandi di verifica riproducibili

```bash
# Soft-404 e status code
curl -s -o /dev/null -w "%{http_code}\n" https://techlanditalia.it/pagina-inesistente-xyz   # → 200
curl -s -o /dev/null -w "%{http_code}\n" https://techlanditalia.it/corsi/scratch            # → 200 (ghost)
# Sitemap servita = statica (byte-identica al file nel repo)
curl -s https://techlanditalia.it/sitemap.xml | wc -c    # 17453 = size di public/sitemap.xml
curl -s https://techlanditalia.it/sitemap.xml | grep -c "<url>"   # 91
# Header live ≠ public/_headers
curl -sI https://techlanditalia.it/ | grep -i "content-security-policy\|strict-transport"
# www redirect
curl -sI https://www.techlanditalia.it/ -o /dev/null -w "%{http_code} -> %{redirect_url}\n"  # 302
# Mirror .md rotti
curl -s -o /dev/null -w "%{http_code}\n" https://techlanditalia.it/corsi/roblox.md  # 404
# Conteggio articoli pubblicati (chiave publishable, già pubblica nel bundle)
# curl "$VITE_SUPABASE_URL/rest/v1/blog_posts?select=slug&published=eq.true" -H "apikey: <publishable>" -H "Prefer: count=exact" -D - -o /dev/null | grep content-range   # → 0-85/86
# .env tracciato
git ls-files | grep "^\.env$"
```
