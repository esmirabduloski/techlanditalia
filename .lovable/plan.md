# Analisi BLOG_AUDIT_PLAN.md e piano di esecuzione

## Verdetto: applicabile, con 1 blocco e 2 ipotesi da confermare

Il piano è ben strutturato e tecnicamente corretto rispetto a quello che vedo nel codice:

- Conferma verificata: gli articoli sono in `blog_posts` (non file MD nel repo), la coda `auto_publish_queue` è gestita da `supabase/functions/blog-auto-publish`, la sitemap dinamica in `generate-sitemap` legge `updated_at` (quindi il fix di `updated_at = now()` alimenta davvero il lastmod), e il parser markdown fragile citato al §8.2 è reale (`src/pages/BlogArticle.tsx:36-50`, whitelist DOMPurify limitata).
- Blocco principale: **non abbiamo GSC/GA4 nel repo**. I criteri quantitativi Q1–Q4 (§4) non sono calcolabili finché non carichi i CSV. Senza quelli, la Fase 2 "classificazione completa con Priority Score" non è eseguibile.
- Buona notizia: i criteri tecnici T1–T8 (§4) e la baseline §3 sono **già calcolabili senza dati esterni** — quindi possiamo iniziare subito da lì e dare valore anche prima dei CSV.

## Punti forti del piano da tenere

- Guardrail chiari (slug immutabili, sottoinsieme markdown, articoli "sani" intoccati).
- Backup obbligatorio via `blog_posts_backup` prima di ogni batch, UPDATE per singolo slug.
- Whitelist esplicita delle route corso valide per evitare i soft-404 (§8.2).
- Snapshot before/after in `content-backups/blog/` = diff verificabile e rollback.

## Cose da correggere/migliorare rispetto al piano originale

1. **§8.4 sconsiglio di creare `blog_posts_backup` come tabella parallela**: già esiste il sistema `content_snapshots` (backup JSONB, memoria progetto). Uso quello invece di duplicare uno schema che poi diverge.
2. **Manca un dry-run rendering**: il parser è fragile (§8.2). Prima di ogni UPDATE di `content` serve un check automatico che il markdown stia nella whitelist, altrimenti il rendering si rompe silenziosamente.
3. **Coda ~121 bozze**: il piano offre opzioni A/B ma non decide. Propongo A (audit preventivo anche sulle bozze) perché così escono già corretti e non si accumula debito.
4. **Semrush senza unità API**: uso query GSC come proxy come previsto — nessun blocco, solo perdita di precisione su Q4.
5. **Menzioni Veneto e disambiguazione TechLand**: la memoria di progetto conferma che TECHLAND va front-loaded; ma "0 menzioni Veneto su 89" può essere una scelta editoriale, non un bug. Da confermare prima di trattarlo come gap sistemico.

## Divisione in 3 fasi

### Fase 1 — Discovery tecnica + fix a zero rischio (eseguibile subito, senza input esterni)

Obiettivo: chiudere tutto ciò che non richiede GSC/GA4 né rewrite di contenuto.

1. Ri-eseguire la baseline §3 aggiornata (ora ci sono più articoli pubblicati) e salvarla in `scratchpad/blog_stats.json`.
2. Produrre `BLOG_AUDIT_RESULTS.md` **parziale**: solo criteri tecnici T1–T8, classifica per gravità, senza Priority Score (opportunità non ancora nota).
3. Fix chirurgici a rischio nullo su TUTTI gli articoli (anche i "sani"):
   - T3 link ghost/rotti (33 articoli): retarget su slug corso validi o rimozione.
   - T5 title >60 char e excerpt fuori range (50 + 3 articoli).
   - Aggiungere `updated_at = now()` solo agli articoli effettivamente modificati.
4. Setup infrastruttura riutilizzabile per Fase 2/3:
   - Validator markdown (whitelist §8.2) come check pre-UPDATE.
   - Backup via `content_snapshots` esistente, non nuova tabella.
   - Log delle modifiche in `BLOG_FIX_LOG.md`.

Deliverable: `BLOG_AUDIT_RESULTS.md` parziale + ~53 articoli con meta/link corretti + validator riutilizzabile.

### Fase 2 — Classificazione completa e batch strutturali (richiede CSV GSC + GA4)

Prerequisito: CSV `Pagine` e `Query` da GSC (90gg, filtro `/blog/`) + CSV GA4 landing page. Decisione su coda bozze (A consigliata).

1. Calcolare criteri Q1–Q4 e Priority Score completo.
2. Riscrivere `BLOG_AUDIT_RESULTS.md` con classifica finale + top 20 per impatto.
3. Batch di internal linking sistematico (T1/T2): orfani (82), inbound da articoli affini, 2–4 link corso per articolo. Zero rewrite di contenuto, solo link.
4. Batch AEO/FAQ minimo (T6): aggiungere blocco "Risposta breve" + 3 FAQ dove manca, senza espandere il resto.
5. Se scegli opzione A: audit preventivo delle ~121 bozze sugli stessi criteri tecnici, così vengono corrette prima della pubblicazione automatica.

Deliverable: linking sano su tutto il blog + AEO/FAQ diffusi + bozze pulite.

### Fase 3 — Content expansion e intent realignment (batch iterativi, on-demand)

Solo per articoli in cima al Priority Score che lo giustificano.

1. Content expansion (T4 + Q2 striking distance): sezioni mancanti vs top SERP, target ≥800 parole su topic competitivi.
2. Meta refresh mirato (Q1): title/excerpt su articoli con impression alte e CTR basso.
3. Intent realignment / rewrite completi (Q3): stimati 5–10, non di più.
4. Disambiguazione TechLand (T7) e menzioni regionali (T8): solo dove naturale — da approvare articolo per articolo, non broadcast.

Deliverable: batch di 5–10 articoli/settimana con rewrite mirato, ognuno con snapshot before/after.

## Cosa serve da te per sbloccare le fasi

- **Per Fase 1 (adesso)**: nulla, parto.
- **Per Fase 2**: CSV GSC (Pagine + Query, 90gg) e CSV GA4 landing page. Conferma opzione A per la coda bozze. Conferma se vuoi che T8 (Veneto) sia trattato come gap da colmare o come scelta editoriale da lasciare com'è.
- **Per Fase 3**: approvazione batch per batch (rewrite più invasivi).

## Note tecniche (per te lato dev)

- Scritture: le faccio via migrazione SQL (tool Supabase disponibile), un UPDATE per slug, con snapshot `content_snapshots` prima. Nessun uso di service_role in chiaro.
- Non tocco: `slug`, `published`, `scheduled_publish_at`, `auto_publish_queue`, `queue_order`, `created_at`. Aggiorno solo `title`, `excerpt`, `content`, `read_time`, `updated_at`.
- Route corso whitelisted (verificate): `/corsi/roblox`, `/corsi/roblox-avanzato`, `/corsi/web-development`, `/corsi/python-base`, `/corsi/python-ai`. Confermate anche dai redirect legacy già in `CorsoDettaglio.tsx`.
- Sitemap dinamica: si aggiorna da sola via `updated_at` — nessun intervento su `generate-sitemap`.
