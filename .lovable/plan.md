# Piano applicazione SEO Audit (techlanditalia.it)

L'audit contiene 22 finding. Li raggruppo in **3 fasi** in base a rischio/dipendenze. Ti chiedo conferma prima di partire, perché alcuni fix richiedono decisioni tue (catalogo corsi, hosting, claim marketing).

---

## FASE 1 — Quick wins (rischio ~zero, nessuna decisione richiesta)

Eseguibili tutti in un'unica release. Nessun impatto su prodotto/marketing.

1. **robots.txt** (SEO-011): gruppo `*` unico con Disallow su `/admin /area-riservata /insegnante /auth`; rimozione `Crawl-delay`. Fix critico: oggi Googlebot ignora i Disallow.
2. **`.gitignore`** (SEO-007): aggiungo `.env`, `.env.*`, `!.env.example`; `git rm --cached .env`; creo `.env.example`. Non riscrivo la storia (nessun secret vero committato).
3. **NotFound** (SEO-012 mitigazione): aggiungo `SEOHead noIndex`, traduzione IT, Layout con link a corsi/blog/prenota.
4. **Schema JSON-LD** (SEO-004): fix `og-image.jpg → .png`, uso `generateBlogPostSchema` con `dateModified: updated_at`, rimuovo HowTo dalla home, FAQPage solo su `/faq`, dedup org schema con `@id`.
5. **Meta duplicati parziali** (SEO-003): rimuovo hreflang statici e `og:url` statico da `index.html`; **non** tocco gli altri og:* statici finché non c'è prerender (servono ai social crawler).
6. **Asset pesanti** (SEO-017): ricomprimo `logo.png` (545KB → <40KB) e `og-image.png` (793KB → <200KB); aggiungo `width/height` alla featured image blog.
7. **Markdown parser** (SEO-018): `# → h2`, rimuovo `h1` da ALLOWED_TAGS DOMPurify.
8. **Prop keywords morta** (SEO-020): rimuovo da `SEOHead` e call-site.
9. **Meta title corsi tampone** (SEO-005 partial): allineo age nei title `CorsoDettaglio` a quello on-page (fix provvisorio, la matrice unica arriva in Fase 2).
10. **LinkedIn sameAs** (SEO-022 tech): correggo il link se mi confermi l'URL company (o rimuovo se non esiste ancora).

**Tempo stimato:** ~2-3h. Un solo deploy.

---

## FASE 2 — Strutturali (richiedono TUE decisioni)

Non parto finché non rispondi a queste 4 domande:

### D1 — Catalogo corsi canonico (SEO-010)
Oggi coesistono 3 set di slug divergenti (5 hardcoded, 8 in DB, 9 in llms.txt). `/corsi/roblox` e `/corsi/sviluppo-giochi-con-roblox` rispondono entrambi 200 → cannibalizzazione.
- **Opzione A (consigliata):** slug corti hardcoded diventano canonici (`roblox`, `python-base`…), rinomino gli slug DB, DB = unica fonte dati.
- **Opzione B:** slug lunghi DB diventano canonici, aggiorno sitemap/link/llms.txt.
- Cosa faccio di `web-development` (solo hardcoded) e `design-creativo`/`informatica-di-base` (solo DB)?

### D2 — Matrice età unica (SEO-005)
Oggi lo stesso corso ha 4 età diverse (title vs on-page vs DB vs llms.txt). Fascia brand ufficiale: **6-18** o **5-18**? Ti preparo una tabella corso-per-corso da validare col team didattico.

### D3 — Hosting redirect/header (SEO-008)
Lovable/Cloudflare **non processa** `public/_redirects` e `public/_headers` (formato Netlify). Conseguenza: la sitemap "dinamica" non è servita, gli header custom (CSP/HSTS estesi) non applicati, i 301 non funzionerebbero. Tre opzioni:
- **A) Sitemap rigenerata al build** (script che chiama `generate-sitemap` e scrive `public/sitemap.xml`): risolve solo la sitemap, ma è a rischio zero.
- **B) Cloudflare zone propria** con Worker/Redirect Rules: sblocca tutto, ma richiede migrazione DNS.
- **C) Aspettare** capability Lovable per redirect custom.
Consigliata **A ora + B dopo** se vuoi 301 reali.

### D4 — Landing `/lp/` (SEO-006)
Oggi hanno `noIndex` client-side ma sono nella sitemap live. Le tolgo dalla sitemap e mantengo pure ads (noindex), oppure vuoi indicizzarle come long-tail?

**Una volta ricevute le risposte**, eseguo in questo ordine:
- SEO-010 (consolidamento catalogo + redirect/canonical) →
- SEO-009 (sitemap allineata al nuovo catalogo) →
- SEO-005 (matrice età propagata: DB, title generati, LearningRoadmap, llms.txt) →
- SEO-014 (rigenerazione llms.txt e mirror .md dai dati DB) →
- SEO-006 (allineamento /lp/ secondo decisione D4) →
- SEO-013 (301 www + trailing slash, se D3=B) →
- SEO-015 (footer con colonne link + related posts in BlogArticle + audit link editoriali).

---

## FASE 3 — Prerendering (traccia già in corso separatamente)

- **SEO-001** (prerender build-time): già pianificato nel `PRERENDER_PLAN.md` v2.1 che avevi approvato. Quando lo eseguiamo, sblocca:
- **SEO-002** (dedup completo meta statici vs Helmet) → rilasciato insieme al prerender, non prima.
- **SEO-012** (404 reali server-side).
- **SEO-016** (paginazione blog crawlabile con URL reali `/blog?page=N`).

---

## Non applico (o richiedono conferma esplicita)

- **SEO-019** (rimozione claim "#1 in Italia" / "1.200+ studenti"): è una decisione marketing, non tecnica. Se me lo confermi, sostituisco con claim verificabili ("gruppi max 6", "prima lezione gratuita", Trustpilot).
- **SEO-021** (backlog articoli 86 vs 210): serve che tu verifichi in `/admin` quante bozze reali ci sono. Se ce ne sono, definiamo cadenza publish.
- **SEO-022 entity building non-tecnico** (Wikidata, pagina LinkedIn company, paragrafo disambiguazione in `/chi-siamo`): richiedono azioni fuori dal codice.

---

## Cosa mi serve da te per partire

1. **Vado con la Fase 1 subito?** (nessun rischio)
2. **Risposte a D1, D2, D3, D4** per la Fase 2.
3. Conferma su SEO-019 (claim marketing) sì/no.

Se vuoi, posso partire **oggi con la sola Fase 1** e aprire in parallelo la discussione sulle 4 domande della Fase 2.
