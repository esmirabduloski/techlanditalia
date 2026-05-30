# Piano riduzione costi — Esmir's Travel Compass

**Obiettivo:** ridurre la spesa Cloud da ~$9.35/mese a ~$5/mese (-45%) intervenendo sulle 3 voci che dominano la spesa: generazione AI articoli, immagini di copertina, pipeline email + cron.

> ⚠️ Questo piano riguarda il progetto **Esmir's Travel Compass**, non Techland. L'implementazione richiederà di lavorare in quel progetto separato (cambio progetto attivo).

---

## Quadro di partenza

| Area | Costo stimato/mese | % | Tipologia |
|---|---:|---:|---|
| AI generativa (articoli + cover) | ~$5.50 | 59% | Ricorrente (per richiesta) |
| Email pipeline (queue + drip + cron) | ~$2.20 | 24% | Ricorrente schedulato |
| Bot renderer + sitemap/rss (SEO) | ~$1.10 | 12% | Ricorrente (crawler) |
| DB + storage + bandwidth | ~$0.55 | 5% | Passivo |
| **Totale** | **~$9.35** | 100% | |

---

## Interventi proposti (ordinati per ROI)

### 1. Cache aggressiva su `ai-generate-article` — **risparmio ~$3.00/mese**
**Problema:** ogni rigenerazione articolo (anche minor edit, anteprime, retry) consuma token Gemini/GPT. Spesso lo stesso prompt viene chiamato 2-4 volte.

**Soluzione:**
- Aggiungere tabella `ai_generation_cache(prompt_hash, model, output, created_at, hit_count)`.
- Hash SHA-256 di `{prompt + model + temperature}` → se esiste e ha <30 giorni, restituire output cached.
- TTL: 30 giorni. Pulsante "Forza rigenerazione" per bypass esplicito.
- Telemetria: contatore hit/miss in admin per validare il risparmio.

**Impatto stimato:** -60% chiamate AI testuali → -$3.00/mese.

---

### 2. Cache + downscale su `ai-cover-image` — **risparmio ~$1.50/mese**
**Problema:** le cover vengono rigenerate ad ogni save bozza, e usano modelli image premium.

**Soluzione:**
- Stessa logica di cache (hash su prompt + stile + dimensione).
- Default model: passare a `google/gemini-3.1-flash-image-preview` (Nano Banana 2) invece di gpt-image-2 standard, che costa ~4× in meno per immagine.
- Generare a 1024×1024 e ridimensionare lato client invece di 1920×1920.
- Salvare in storage Supabase con cache headers `max-age=31536000`.

**Impatto stimato:** -70% costo immagine → -$1.50/mese.

---

### 3. Consolidare cron email — **risparmio ~$0.80/mese**
**Problema:** `process-email-queue` gira ogni 5s (= 17.280 invocazioni/giorno) anche quando la coda è vuota. `drip-publish` e `monthly-admin-report` girano separatamente.

**Soluzione:**
- Abbassare frequenza `process-email-queue` da 5s a 60s (sufficiente per volumi <200 email/giorno). → -92% invocazioni.
- Aggiungere early-return: se `SELECT count FROM pgmq queue` = 0, esce in <50ms senza loggare.
- Disabilitare `monthly-admin-report` se non viene letto (chiedere a Esmir).
- Unire `drip-publish` dentro `process-email-queue` come step opzionale ogni 5 minuti.

**Impatto stimato:** -$0.80/mese (meno invocazioni + meno CPU idle).

---

### 4. Throttle bot-renderer + cache statica sitemap/rss — **risparmio ~$0.50/mese**
**Problema:** crawler (Google, Bing, GPTBot, ecc.) chiamano `bot-renderer`, `generate-sitemap`, `generate-rss` molte volte/giorno. Ogni chiamata fa SSR + query DB.

**Soluzione:**
- Cache HTTP headers su sitemap/rss: `Cache-Control: public, max-age=21600, s-maxage=21600` (6h).
- `bot-renderer`: cache in-memory per URL (TTL 1h) o pre-render in storage notturno via cron.
- Aggiungere `robots.txt` con `Crawl-delay: 10` per bot non essenziali.

**Impatto stimato:** -$0.50/mese.

---

### 5. Pulizia opzionale — **risparmio ~$0.10/mese**
- Comprimere immagini esistenti in storage in WebP/AVIF (one-shot).
- Aggiungere indici su query lente (verificare con `pg_stat_statements`).
- Eliminare log `email_send_log` > 90 giorni (cron mensile).

---

## Risparmio totale stimato

| Intervento | Risparmio/mese | Effort |
|---|---:|---|
| 1. Cache articoli AI | $3.00 | M |
| 2. Cache + downscale cover | $1.50 | S |
| 3. Cron email ottimizzato | $0.80 | S |
| 4. Cache SEO/bot | $0.50 | S |
| 5. Pulizia varie | $0.10 | XS |
| **Totale** | **~$5.90** | |

**Costo finale stimato:** $9.35 → **~$3.45/mese** (-63%).

---

## Dettagli tecnici (per la fase build)

Lavoreremo nel progetto **Esmir's Travel Compass** (devo cambiare progetto attivo). Sequenza consigliata:

```text
fase 1 → cache AI articoli + cover (impatto maggiore, basso rischio)
fase 2 → cron email consolidato (richiede test del flusso transactional)
fase 3 → cache SEO/bot (validare che Google non perda freshness)
fase 4 → cleanup
```

Ogni fase è isolata e rilasciabile separatamente, con metriche before/after via `supabase--analytics_query` su `function_edge_logs` per validare il risparmio reale dopo 7 giorni.

## Cosa NON faccio in questo piano
- Non tocco la logica editoriale (prompt, modelli scelti per qualità) se non per cache.
- Non rimuovo funzionalità: tutto resta uguale per l'utente finale.
- Non migro provider AI.

---

## Domande prima di partire (build)
1. Confermare che posso cambiare progetto attivo a "Esmir's Travel Compass".
2. `monthly-admin-report`: lo leggi davvero ogni mese? (Se no → disabilito.)
3. Vuoi che parta solo dalla **fase 1** (massimo risparmio, minimo rischio) o approccio "tutto in una volta"?
