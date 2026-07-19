# PRERENDER_PLAN — Prerendering statico con vite-react-ssg

**Data:** 19 luglio 2026 · **Stato:** piano in attesa di approvazione ("vai") — nessuna modifica al codice effettuata
**Obiettivo:** HTML statico completo (contenuto + meta + schema) per le pagine marketing pubbliche; SPA invariata per aree autenticate e `/lp/`.

---

## 0. Risposte alle domande preliminari

**È sicuro?** Sì, con i caveat della §6. Il prerendering avviene **solo a build-time**: il runtime in produzione resta identico (stesso bundle JS, stessa auth, stesso Supabase). Il rischio non è in produzione ma nella build (codice non SSR-safe che rompe `npm run build`) e nell'idratazione (mismatch HTML statico ↔ primo render client). Rollback banale: revert del commit → si torna alla SPA attuale.

**Rallenta il sito?** No — lo **velocizza**. Oggi l'utente scarica una pagina vuota e aspetta JS+dati; col prerender il browser riceve subito l'HTML completo → FCP/LCP migliori, contenuto visibile prima. Il JS scaricato è lo stesso di oggi (l'idratazione sostituisce il render iniziale, non si aggiunge). Unico costo: build più lunga (secondi→minuti) e file HTML più grandi di qualche KB. Nessun costo runtime.

**Migliora l'accessibilità per AI e motori?** Sì, ed è il punto: oggi `curl https://techlanditalia.it/` restituisce `<div id="root"></div>` vuoto. GPTBot, ClaudeBot, PerplexityBot, Bingbot **non eseguono JavaScript**: per loro il sito è oggi una pagina bianca con i soli meta statici della home (audit SEO-001). Dopo il prerender vedranno contenuto completo, meta per-pagina e schema JSON-LD (inclusa la disambiguazione TechLand) su ogni route prerenderata. Anche Google beneficia: indicizzazione immediata senza coda di rendering.

---

## 1. Correzioni al brief (stato reale del repo — verificato)

Il prompt originale contiene assunzioni da correggere:

| Assunzione del brief | Realtà verificata |
|---|---|
| Route `/app`, `/dashboard`, `/account`, `/pricing`, "pagine fasce d'età" | **Non esistono.** Le aree protette reali sono `/area-riservata/*`, `/admin/*`, `/insegnante/*`, `/auth` ([src/App.tsx:128-185](src/App.tsx)) |
| Corsi "Scratch, Roblox Studio, Minecraft Education, Python, Unity" | Le pagine corso hardcoded servite sono 5: `roblox`, `roblox-avanzato`, `web-development`, `python-base`, `python-ai` (CorsoDettaglio.tsx). Scratch/Minecraft esistono solo nel DB con altri slug (`programmazione-visiva-con-scratch`…) — vedi SEO-010: **serve decidere quali slug prerenderare** |
| "Canonical hardcoded che punta a `/`" | **Già risolto**: canonical dinamico per-route via SEOHead (audit SEO-003). Il task residuo è la **deduplicazione dei meta statici** di index.html (SEO-002), che col prerender diventa finalmente sicura |
| "Blog index + 210 articoli" | **89 pubblicati** oggi, coda automatica ~3/giorno fino a ~210 → servono build-time data fetch **e rebuild automatico a ogni pubblicazione** (webhook), altrimenti gli articoli nuovi nascono senza HTML statico |
| Router "adattabile" | `App.tsx` usa `<BrowserRouter>` + JSX `<Routes>` con ~75 route: vite-react-ssg richiede il refactor in **array `RouteRecord`** (data router) — è la modifica più invasiva del piano |
| Hosting "stile Netlify" | Hosting Lovable/Cloudflare: **ignora `_redirects`/`_headers`** (audit SEO-008). Da verificare che serva i file `dist/corsi/index.html` ecc. prima del fallback SPA (comportamento standard degli host statici, ma va testato subito con una pagina pilota) |

---

## 2. Compatibilità stack (verificata)

- `react-router-dom` **7.18** ✅ (vite-react-ssg ≥0.8 supporta RR v7), React 18.3 ✅, Vite 5.4 ✅
- `react-helmet-async` 2.0.5 → **sostituito** dal `<Head>` di vite-react-ssg (stessa API dichiarativa; SEOHead è l'unico punto di contatto → modifica localizzata)
- `next-themes` è SSR-safe by design ✅; grep su sections/layout/seo: nessun accesso a `window`/`document` a render-time ✅ (solo in event handler/useEffect)
- Attenzione a: `AnalyticsProvider`, `ScrollToTop`, `lazyRetry` (window.location.reload nel catch — ok, non a render-time), `useAuth` (supabase-js gestisce l'assenza di localStorage in Node)

---

## 3. Perimetro route

### Prerenderate (statiche, contenuto hardcoded — Fase A)
`/`, `/corsi`*, `/chi-siamo`, `/faq`, `/prenota`, `/contatti`, `/glossario`*, `/lavora-con-noi`, `/accessibilita`, `/privacy`, `/termini`, `/cookie`
(*fetchano dati dal DB per la lista: al primo rilascio l'HTML avrà head completo + hero statico + skeleton; contenuto pieno in Fase C)

### Prerenderate (dinamiche — Fase B/C)
- `/corsi/:slug` — i 5 slug hardcoded subito (contenuto completo già nel bundle); gli slug DB dopo la decisione SEO-010
- `/blog` + `/blog/:slug` — 89+ articoli: richiede fetch da Supabase a build-time (§5.3)

### ESCLUSE dal prerender (restano SPA pura)
- `/area-riservata/*`, `/admin/*`, `/insegnante/*`, `/auth`, `/.lovable/*` (protette/private)
- `/lp/:slug` (noindex, gestione separata cannibalization — audit SEO-006)
- `*` (NotFound)

L'esclusione è **strutturale**: nell'array di route SSG si passa solo la whitelist sopra; le route private restano definite ma non generano file HTML (servite dal fallback SPA `index.html`). Lo script `verify:prerender` controlla anche che `dist/` NON contenga `area-riservata/`, `admin/`, `insegnante/`, `auth/`, `lp/`.

---

## 4. Dipendenze

```bash
npm i -D vite-react-ssg   # unica nuova dipendenza (dev)
# rimozione: react-helmet-async (dopo migrazione SEOHead)
```

---

## 5. Modifiche per file

### 5.1 Refactor router (la modifica grossa)
- **`src/routes.tsx` (nuovo):** array `RouteRecord` con tutte le route attuali di App.tsx, lazy import invariati (vite-react-ssg supporta `lazy`), organizzate: gruppo pubblico (con flag prerender) + gruppo privato.
- **`src/App.tsx`:** diventa il layout root (providers: QueryClient, Theme, Auth, Impersonation, Tooltip, Analytics, ScrollToTop, RouteAnnouncer, Suspense) attorno a `<Outlet/>`; niente più `<BrowserRouter>`/`<Routes>`.
- **`src/main.tsx`:** da `createRoot(...).render(...)` a:
  ```tsx
  import { ViteReactSSG } from 'vite-react-ssg'
  import { routes } from './routes'
  export const createRoot = ViteReactSSG({ routes }, ({ isClient }) => { /* init client-only */ })
  ```
- **`package.json`:** `"build": "vite-react-ssg build"`, `"dev": "vite-react-ssg dev"` (o mantenere `vite` per il dev e usare ssg solo in build — da testare col plugin Lovable, vedi rischi).

### 5.2 Migrazione head management
- **`src/components/seo/SEOHead.tsx`:** `import { Head } from 'vite-react-ssg'` al posto di `Helmet`; API pressoché identica → diff minimo. Rimozione `HelmetProvider` da main.tsx.
- **`index.html` (SEO-002, ora sicuro):** rimuovere i meta duplicati statici (description, `meta name="title"`, robots, googlebot, og:\*, twitter:\*, geo, hreflang riga 34-35) perché ogni pagina prerenderata li emette già corretti. **Restano**: charset, viewport, favicon, preload LCP, google-site-verification, i 2 schema Organization/WebSite, link sitemap/llms.
- Le pagine escluse dal prerender (area riservata ecc.) sono servite dal fallback `index.html` alleggerito: hanno solo `<title>` base finché il JS non monta — accettabile (sono noindex/private).

### 5.3 Dati a build-time per il blog (Fase C)
- Route `/blog/:slug` con `loader` react-router che legge da Supabase (vite-react-ssg esegue i loader in build); slugs enumerate via `getStaticPaths`/`includedRoutes` con query `blog_posts?published=eq.true`.
- `BlogArticle.tsx`: da `useEffect`+`useState` a `useLoaderData` (fallback client-side per gli articoli pubblicati dopo l'ultima build: se il loader non ha dati statici, fetch client come oggi → nessun 404 per articoli nuovi).
- **Rebuild automatico:** webhook/trigger alla pubblicazione (la coda `blog-auto-publish` pubblica ~3/giorno) → build quotidiana schedulata come minimo. **Da definire con te: dove gira la build?** (vedi domande aperte)

### 5.4 Script di verifica
- **`scripts/verify-prerender.mjs` + `npm run verify:prerender`:** per ogni route target controlla in `dist/<route>/index.html`: `<title>` non-default, `<link rel="canonical">` = URL attesa, `meta description`, ≥1 blocco `application/ld+json` valido (parse JSON) con i tipi attesi per pagina (Course su /corsi/:slug, FAQPage su /faq, BreadcrumbList dove previsto, BlogPosting su articoli); verifica assenza directory escluse. Exit code ≠0 se fallisce → agganciabile a CI.

### 5.5 README
- Sezione "Build & Prerender": comandi, come aggiungere una route al prerender, troubleshooting SSR (regole: niente `window` a render-time, usare `<ClientOnly>` di vite-react-ssg per widget browser-only tipo Trustpilot).

---

## 6. Rischi e mitigazioni

| Rischio | Probabilità | Mitigazione |
|---|---|---|
| Build rotta da codice non-SSR-safe in componenti condivisi (75 route importate) | Media | Le route private sono lazy → non importate durante il prerender delle pubbliche; grep preventivo già fatto sulle marketing (pulito); fix puntuali con guard `typeof window` |
| Hydration mismatch (flash/warning console, in casi gravi re-render completo) | Media | next-themes gestisce il tema con script inline; date/random da evitare a render-time; test visivo sulle 5 pagine campione |
| Hosting Lovable non serve gli HTML statici per path (fallback SPA sempre) | Bassa ma **bloccante** | **Test pilota al primo deploy**: `curl https://techlanditalia.it/faq \| grep canonical` — se fallisce, il piano si ferma prima del rollout completo |
| Plugin Lovable (`lovable-tagger`, `@lovable.dev/mcp-js`) incompatibili col processo SSG, o Lovable che rigenera `main.tsx` sovrascrivendo il setup | Media | Tagger è già dev-only; testare `build:dev`; concordare che le modifiche a router/main non vengano rieditate da Lovable |
| Articoli pubblicati dopo l'ultima build senza HTML statico | Certa (coda ~3/giorno) | Fallback client-side (§5.3) + build schedulata; gli articoli restano fruibili, solo senza beneficio SSG fino alla build successiva |
| Contenuto DB che cambia (corsi) → HTML statico stale | Media | Rebuild al cambio contenuti; nel frattempo l'idratazione aggiorna il DOM coi dati freschi (comportamento corretto, solo mismatch temporaneo) |
| QueryClient/AuthProvider durante SSG | Bassa | Provider montati anche in SSG ma le query girano in useEffect (non a render) → nessun fetch in build salvo i loader espliciti |

**Rollback:** ogni fase è un commit atomico; revert → SPA identica a oggi. Il fallback SPA resta comunque attivo per qualsiasi route non prerenderata, quindi anche un prerender parziale non rompe nulla.

---

## 7. Sequenza di lavoro (commit atomici)

1. `chore: add vite-react-ssg` + refactor router in `routes.tsx` (nessun SSG attivo, solo data router) → verifica SPA invariata
2. `feat: enable SSG build` per la whitelist Fase A (pagine statiche) + migrazione SEOHead a `Head`
3. `feat: prerender course pages` (5 slug hardcoded; DB slugs dopo decisione SEO-010)
4. `chore: slim index.html` (dedup meta statici — SEO-002)
5. `feat: prerender blog` (loader + getStaticPaths + fallback client)
6. `test: add verify:prerender script` + `docs: README build/prerender`
7. Deploy pilota + verifica live con curl sulle 5 pagine campione (home, /corsi/roblox, un articolo, /faq, /chi-siamo)

Ogni step lascia il sito funzionante; mi fermo e ti mostro l'esito dopo gli step 2 e 7.

---

## 8. Domande aperte (prima del "vai")

1. **Dove gira la build di produzione?** Se il deploy è "Lovable publish" interno, devo verificare che esegua `npm run build` custom (`vite-react-ssg build`) e che si possa schedulare una rebuild quotidiana per il blog. Se c'è (o si può creare) una pipeline GitHub Actions → tutto più semplice. Dimmi come pubblichi oggi.
2. **Slug corsi** (dipendenza SEO-010): prerendero i 5 hardcoded subito; per gli 8 slug DB aspetto la decisione sul catalogo canonico o li includo entrambi (sconsigliato: consolida la duplicazione)?
3. **Fase C blog subito o dopo?** Consiglio: rilasciare A+B (pagine statiche + corsi) appena pronte — beneficio immediato a rischio minimo — e fare il blog come secondo rilascio.
4. Confermi che il **dev quotidiano con Lovable** continuerà? (devo sapere se proteggere `main.tsx`/`routes.tsx` da rigenerazioni.)
