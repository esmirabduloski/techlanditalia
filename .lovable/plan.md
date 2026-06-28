# Piano fix SEO critiche (report Claude)

## Cosa applico

### 1. Rimuovere AggregateRating falso ✅ (fix immediata, alta priorità)
Lo schema `AggregateRating` con 4.9 / 150 recensioni in `index.html` (righe ~187-193) è inventato e viola le policy Google sui dati strutturati → rischio azione manuale "Spam dei dati strutturati".

**Azione:** rimuovo l'intero blocco `LocalBusiness` con `aggregateRating` da `index.html`. Lascio invariato `EducationalOrganization` e `WebSite` schema (già corretti). Quando Trustpilot avrà recensioni reali aggregabili, reintroduciamo il blocco puntando ai dati veri.

**Impatto:** zero rischio, elimina possibile penalizzazione, nessun effetto su UX.

### 2. Prerendering SPA ❌ NON applico ora
Claude ha ragione sul problema (SPA pura, crawler social vedono shell vuota), ma la fix è invasiva e rischiosa per un sito già live con 90+ URL e blog dinamico da DB. Motivi per rimandare:

- **Googlebot** esegue JS in seconda ondata: il sito è già indicizzato (le SERP analysis lo confermano). Non è urgente per Google.
- **Social crawler** (WhatsApp/FB/LinkedIn): impattati, ma i fallback OG in `index.html` sono già decenti per la maggioranza degli URL condivisi (homepage, /corsi, /prenota condividono lo stesso preview generico — accettabile temporaneamente).
- **Migrazione SSG/SSR** (vite-react-ssg, react-snap) richiede:
  - rifattorizzazione build pipeline
  - gestione rotte dinamiche `/blog/:slug` e `/lp/:slug` (richiede fetch al build time da Supabase, oppure ISR-like)
  - test su tutti i 90+ URL per regressioni
  - rischio di rompere lazy loading, idle-defer del Footer/ChatWidget, e le RLS query
- Stack attuale (Vite SPA su Lovable) non supporta nativamente SSR senza framework switch.

**Raccomandazione:** trattare il prerendering come progetto separato (Batch dedicato), valutando in alternativa l'aggiunta di `react-snap` o `vite-plugin-prerender` solo per le rotte statiche top (/, /corsi, /chi-siamo, /prenota, /faq, /contatti, /lavora-con-noi), lasciando blog e lp/ a rendering client. Lo affrontiamo dopo, con piano dedicato e tempo per testare.

## File modificati in questo batch

- `index.html` → rimozione del blocco `<script type="application/ld+json">` contenente `LocalBusiness` + `aggregateRating` (righe ~172-194).

## Cosa NON tocco

- Schema `EducationalOrganization` (ha già `offers` e `audience` reali).
- Schema `WebSite` con SearchAction.
- `SEOHead.tsx` e schema generators (corretti).
- Stack di rendering (SPA Vite resta).

## Verifica post-fix

1. Validazione su [Rich Results Test](https://search.google.com/test/rich-results) della homepage → confermare che non compare più `AggregateRating`.
2. Nessuna regressione visiva (lo schema non ha rendering UI).

## Prossimi step suggeriti (separati)

- **Piano prerendering**: valutare `react-snap` per rotte statiche top (1-2 giornate di lavoro + test).
- **Recensioni reali**: integrare widget Trustpilot già presente per generare un `AggregateRating` legittimo in futuro.
