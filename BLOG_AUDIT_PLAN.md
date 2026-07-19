# BLOG_AUDIT_PLAN — Audit e remediation articoli blog techlanditalia.it

**Data:** 19 luglio 2026 · **Fase:** 1 (Discovery) — in attesa di approvazione
**Fonte articoli:** tabella Supabase `blog_posts` (non file MD/MDX nel repo)

---

## 1. Dove vivono i 210 articoli: mappa dell'inventario

| Aspetto | Stato rilevato |
|---|---|
| **Storage** | Tabella Supabase `blog_posts`. Nessun file markdown nel repo: il contenuto è nel campo `content` (markdown custom, parsato da `src/pages/BlogArticle.tsx:36-50`) |
| **Campi** | `id, title, slug, excerpt, content, featured_image, category, read_time, published, author_id, created_at, updated_at, scheduled_publish_at, auto_publish_queue, queue_order` |
| **Frontmatter / keyword target** | **NON ESISTE**: nessun campo keyword, nessun manifest nel repo. La keyword target andrà ricostruita (da slug/title + top query GSC) |
| **Pubblicati oggi** | **89** (ieri 86 → la coda `auto_publish_queue` pubblica ~3/giorno via `supabase/functions/blog-auto-publish`) |
| **In coda (non visibili con chiave anon)** | stimati **~121** (210 dichiarati − 89 pubblicati). **Da confermare** dal pannello admin |
| **Categorie** | 16 categorie sbilanciate: Educazione 22, Guida 13, Consigli per genitori 11, Corsi 10 … 8 categorie con ≤2 articoli |
| **URL** | `https://techlanditalia.it/blog/{slug}` — slug da NON toccare (guardrail) |
| **Rendering** | SPA senza prerendering; sitemap live stale (68 articoli su 89) — vedi `SEO_AUDIT_2026.md` SEO-001/009: limita l'attendibilità delle impression GSC |

**Vincolo operativo importante:** i fix di Fase 3 richiedono **scrittura sulla tabella `blog_posts`**, non su file del repo. Con la chiave publishable (read-only via RLS) non posso scrivere. Opzioni: (a) colleghi l'MCP Supabase all'account del progetto; (b) applico i fix via SQL che tu esegui/approvi; (c) service-role key in locale (sconsigliato in chiaro). Per mantenere i "commit atomici" richiesti: esporterò snapshot before/after di ogni articolo modificato in `content-backups/blog/` nel repo → git diff verificabile + rollback possibile.

---

## 2. Disponibilità dati di performance

| Fonte | Stato | Azione |
|---|---|---|
| **Export GSC** (impression, click, CTR, posizione per URL, 90gg) | ❌ non nel repo | **SERVE DA TE** — CSV `Pagine` + CSV `Query` (vedi §5) |
| **Export GA4** (sessioni, engagement, tempo per landing page) | ❌ non nel repo | **SERVE DA TE** — CSV per landing page, 90gg |
| **Keyword target per articolo** | ❌ non esiste | Ricostruita da me: slug/title + top-query GSC per URL |
| **Volumi keyword** (per criterio D) | ⚠️ Semrush MCP collegato ma **senza unità API** (ricarica: semrush.com/mcp-access) | O ricarichi unità, o uso i dati GSC query come proxy |
| **Analytics first-party** (`analytics_events` Supabase) | ⚠️ esiste ma RLS blocca la lettura anon | Opzionale: export da admin se vuoi integrare |
| **Sitemap articoli** | ✅ disponibile (ma stale: 68/89) | Già analizzata |
| **Contenuto + struttura dei pubblicati** | ✅ analizzati tutti gli 89 via API | Fatto (vedi §3) |

---

## 3. Baseline tecnica già misurata (89 articoli pubblicati)

Questi segnali sono già calcolati (script riproducibile, dati in scratchpad) e **non richiedono GSC/GA4**:

| Segnale | Articoli | % |
|---|---|---|
| Contenuto thin (<600 parole; mediana 348, max 813, **zero** articoli ≥1000) | **83/89** | 93% |
| Orfani (zero link in ingresso da altri articoli) | **82/89** | 92% |
| Zero link interni in uscita (né blog né corsi) | 41/89 | 46% |
| Nessun link verso pagine corso | 45/89 | 51% |
| Link interni rotti/ghost (es. `/corsi/scratch`, slug blog inesistenti) | **33/89** | 37% |
| Senza blocco AEO "Risposta breve" | 82/89 | 92% |
| Senza sezione FAQ | 62/89 | 70% |
| Title >60 caratteri (troncato in SERP) | 50/89 | 56% |
| **Menzioni Veneto/città venete** (ottimizzazione regionale dichiarata) | **0/89** | 0% |
| **Disambiguazione TechLand vs studio polacco** | **0/89** | 0% |
| Excerpt mancante o >160 char | 3/89 | 3% |

> Nota: l'ottimizzazione regionale Veneto e la disambiguazione brand, indicate come caratteristiche del progetto, **non risultano implementate in nessun articolo pubblicato** — sono un gap sistemico, non un problema di singoli articoli.

---

## 4. Criteri di "sotto-performante" — proposta finale

### Criteri quantitativi (richiedono i tuoi export GSC/GA4)

| ID | Criterio | Soglia | Diagnosi tipica | Fix |
|---|---|---|---|---|
| **Q1** | CTR basso con visibilità | Impression ≥100 (90gg) **e** CTR <1% **e** posizione ≤20 | Title/meta poco allettanti | Meta refresh |
| **Q2** | Striking distance | Posizione media 11–20 sulla query principale **e** impression ≥50 | Contenuto quasi-competitivo | Content expansion + internal linking |
| **Q3** | Engagement debole | Engagement rate GA4 <20% **o** tempo medio <30s, con ≥30 sessioni | Intent mismatch o contenuto thin | Intent realignment / Content expansion |
| **Q4** | Invisibile nonostante domanda | Impression <10 (90gg) su topic con domanda dimostrata (volume >50 se Semrush disponibile, altrimenti query GSC affini con impression) | Problema tecnico (non in sitemap, non indicizzato) o cannibalizzazione | Schema/technical fix + internal linking |

Adattamenti rispetto alla tua bozza: (a) Q1 aggiunge "posizione ≤20" per non punire articoli che appaiono solo in posizione 40+ (lì il CTR basso è fisiologico); (b) "bounce >80%" sostituito da engagement rate GA4 (il bounce classico non esiste più in GA4); (c) Q4 usa le query GSC come proxy del volume finché Semrush è senza unità.

### Criteri tecnici/qualitativi (già misurabili, si applicano da subito)

| ID | Criterio | Fix |
|---|---|---|
| **T1** | Orfano: zero inbound interni | Internal linking (in ingresso, da articoli affini e pagine corso) |
| **T2** | Zero outbound verso corsi (l'articolo non spinge le pagine transazionali) | Internal linking (2-4 link corso + 2-3 articoli correlati) |
| **T3** | Link ghost/rotti nel contenuto | Link fix (rimozione o retarget su slug validi) |
| **T4** | Thin content <600 parole su topic competitivo | Content expansion (sezioni mancanti vs top SERP) |
| **T5** | Title >60 char o excerpt fuori range | Meta refresh |
| **T6** | Manca "Risposta breve"/FAQ (pattern AEO del progetto) | Content expansion (blocco AEO + FAQ 3 domande) |
| **T7** | Nessuna disambiguazione TechLand dove il topic è a rischio collisione (articoli su videogiochi/Roblox/game dev) | Disambiguation note |
| **T8** | Nessun segnale regionale dove l'angolo lo consente | Aggiunta menzione Veneto naturale (senza forzature; guardrail: anche resto d'Italia ok) |

### Definizione di "sano" (NON toccare — guardrail)

Articolo con: posizione ≤10 sulla query principale **e** CTR ≥ media del sito **e** nessun T3 (link rotti). I link rotti si correggono comunque anche sui sani (fix chirurgico a zero rischio contenuto, lo considero manutenzione, non rewrite — se preferisci escluderli del tutto, dimmelo).

---

## 5. Metodo di scoring

Per ogni articolo, **Priority Score = Opportunità × Gravità / Sforzo**:

- **Opportunità** (0-5): impression 90gg normalizzate + volume topic (GSC query proxy). Un articolo invisibile su topic senza domanda vale meno di uno in posizione 12 su query con 500 impression.
- **Gravità** (0-5): numero di criteri Q+T violati, pesati (Q2=3, Q1=2.5, Q3=2, Q4=2, T1/T2/T3=1.5, T4=1.5, T5/T6=1, T7/T8=0.5).
- **Sforzo** (1-3): Meta refresh=1, Internal linking=1, Schema=1, Content expansion=2, Intent realignment=3, Complete rewrite=3.

Output in `BLOG_AUDIT_RESULTS.md`: classifica per Priority Score, raggruppata per categoria di fix; ogni articolo con URL, keyword target ricostruita, metriche, diagnosi, fix assegnati. Batch di Fase 3 composti scendendo la classifica.

**Stima attesa della classificazione** (da confermare coi dati GSC/GA4):

| Categoria | Stima | Base della stima |
|---|---|---|
| Solo internal linking/link fix | 25–35 | T1/T2/T3 quasi universali; molti articoli recenti hanno però contenuto ok |
| Meta refresh (+linking) | 20–30 | 50 title >60ch; Q1 restringerà ai soli con impression |
| Content expansion (+AEO/FAQ) | 30–45 | 83 thin; Q2/Q4 e opportunità decideranno quali valgono l'investimento |
| Intent realignment / rewrite | 5–10 | attesi pochi: batch generato con angoli espliciti |
| Sani (intoccati) | 10–20 | pochi, vista la baseline; sperabilmente i più recenti col pattern AEO |
| **Non classificabili ora** | ~121 in coda | vedi "Decisione preliminare" sotto |

---

## 6. Decisione preliminare che mi serve da te: i ~121 articoli in coda

Il perimetro "210 articoli" include ~121 non ancora pubblicati (invisibili alla chiave anon, pubblicazione ~3/giorno → coda di ~40 giorni). Due opzioni:

- **A (consigliata):** audit di performance sui soli **89 pubblicati** (solo loro hanno dati GSC/GA4) + **audit preventivo tecnico** sui 121 in coda (thin content, linking, title, AEO, disambiguazione, Veneto) così escono già corretti. Richiede accesso in lettura alle bozze (admin export o MCP Supabase collegato).
- **B:** solo i pubblicati, la coda si audita a fine pubblicazione.

---

## 7. Cosa mi serve da te per la Fase 2 (STOP — attendo questi input)

1. **Export GSC** (ultimi 90 giorni, filtro `/blog/`):
   - Report *Pagine*: URL, impression, click, CTR, posizione → CSV
   - Report *Query* (idealmente query+pagina da API/Looker; se non fattibile, il CSV Query globale basta)
2. **Export GA4** (ultimi 90 giorni): landing page `/blog/*` con sessioni, engagement rate, tempo medio di engagement → CSV
3. **Conferma numero reale** di articoli in coda e scelta **opzione A o B** (§6)
4. **Accesso in scrittura** per la Fase 3: MCP Supabase collegato al progetto, oppure preferisci ricevere da me gli UPDATE SQL da approvare?
5. *(Opzionale)* Ricarica unità API Semrush (semrush.com/mcp-access) per i volumi keyword del criterio Q4 — altrimenti procedo con le query GSC come proxy
6. *(Opzionale)* Se esiste il manifest keyword→articolo dello script Node.js di generazione (fuori repo?), passamelo: evita la ricostruzione da GSC

Con i CSV in mano: Fase 2 completa (classificazione di tutti gli articoli + `BLOG_AUDIT_RESULTS.md` + riepilogo top 20 per impatto stimato) senza ulteriori input.

---

## 8. Istruzioni operative per Lovable (accesso diretto al DB Supabase)

Lovable ha accesso diretto al database del progetto, quindi può eseguire i fix di Fase 3 direttamente sulla tabella `blog_posts`. Queste istruzioni sono pensate per essere incollate (o adattate) nel prompt a Lovable, batch per batch.

### 8.1 Dove e cosa modificare

Gli articoli sono righe della tabella **`public.blog_posts`**. Campi rilevanti per i fix:

| Campo | Uso nel fix | Regole |
|---|---|---|
| `title` | Meta refresh | Max 60 caratteri, keyword front-loaded, angolo emotivo per genitori. NON aggiungere "\| TECHLAND" (lo appende già `SEOHead`) |
| `excerpt` | Meta description | 150–160 caratteri, con CTA. È usato come `meta description` e nello schema BlogPosting |
| `content` | Content expansion, intent realignment, internal linking, disambiguazione, AEO | Markdown nel **sottoinsieme supportato** (vedi 8.2) |
| `read_time` | Coerenza | Ricalcolare dopo espansioni: ~200 parole/min, formato `"X min"` |
| `updated_at` | Freshness | Impostare a `now()` a ogni modifica (alimenta lastmod della sitemap dinamica) |
| `slug` | **VIETATO MODIFICARE** | Cambia l'URL → rompe ranking e backlink (guardrail di progetto) |
| `published`, `scheduled_publish_at`, `auto_publish_queue`, `queue_order`, `created_at` | **NON TOCCARE** | Gestiscono la coda di pubblicazione automatica |

### 8.2 Vincolo critico: il markdown supportato è un sottoinsieme

Il contenuto NON è renderizzato da un parser markdown completo ma da `parseMarkdown()` in `src/pages/BlogArticle.tsx:36-50`, con sanitizzazione DOMPurify limitata a `h1,h2,h3,h4,p,strong,em,a,li,br,img`. Lovable deve usare **solo** questa sintassi:

- **Supportato:** `## H2`, `### H3`, `#### H4` · `**grassetto**` · `*corsivo*` · `[testo](/link-interno)` · `[testo](https://esterno)` (apre in nuova tab) · `![alt](/images/…)` · liste con `- item` · paragrafi separati da riga vuota
- **NON supportato (verrà mostrato come testo grezzo o rimosso):** tabelle, blockquote `>`, code block/`` ` ``, liste numerate `1.`, liste annidate, HTML inline, orizzontali `---`
- **NON usare `# H1`** nel contenuto: la pagina ha già l'H1 dal `title`; un `#` nel body crea H1 duplicati
- I link interni devono puntare **solo a route esistenti**: pagine corso valide attualmente servite: `/corsi/roblox`, `/corsi/roblox-avanzato`, `/corsi/web-development`, `/corsi/python-base`, `/corsi/python-ai`, più `/prenota`, `/corsi`, `/faq`, `/glossario`. NON linkare `/corsi/scratch`, `/corsi/minecraft-education` o altri slug non verificati (oggi sono soft-404). Per i link tra articoli, verificare che lo slug di destinazione esista in `blog_posts` con `published = true`

### 8.3 Pattern di fix per articolo (template per Lovable)

Per ogni articolo del batch, applicare SOLO i fix assegnati in `BLOG_AUDIT_RESULTS.md`:

1. **Meta refresh:** riscrivi `title` (≤60 char) ed `excerpt` (150-160 char, CTA). Non toccare `content` se non richiesto.
2. **Blocco AEO:** se assente, aggiungi in testa al `content` la sezione `## Risposta breve` (2-3 frasi che rispondono alla query principale) — è il pattern già usato dagli articoli più recenti.
3. **Content expansion:** aggiungi le sezioni indicate nella diagnosi SENZA riscrivere quelle esistenti; target ≥800 parole per topic competitivi; chiudi con `## Domande frequenti` (3 domande con `### domanda` + risposta breve).
4. **Internal linking:** inserisci 2-4 link contestuali verso le pagine corso pertinenti e 2-3 verso articoli correlati (stessa categoria/topic), con anchor descrittive (mai "clicca qui"). Correggi o rimuovi i link ghost segnalati.
5. **Disambiguazione TechLand:** solo dove il topic rischia confusione (videogiochi, Roblox, game dev): una frase naturale, es. "TechLand Italia è la scuola di coding per ragazzi — da non confondere con Techland, lo studio polacco di videogiochi."
6. **Tono:** caldo, rivolto ai genitori, zero gergo tecnico non spiegato. Linguaggio inclusivo e sensibile negli articoli DSA/BES (in dubbio: flaggare, non improvvisare). Menzioni regionali (Veneto o altre regioni) solo dove suonano naturali.
7. **Chiusura:** aggiorna `read_time` e `updated_at = now()`.

### 8.4 Sicurezza e reversibilità (obbligatorio)

Prima di ogni batch, Lovable deve creare uno snapshot di backup:

```sql
-- una tantum
CREATE TABLE IF NOT EXISTS blog_posts_backup (LIKE blog_posts INCLUDING ALL);
-- prima di ogni batch (id del batch nei WHERE)
INSERT INTO blog_posts_backup SELECT * FROM blog_posts WHERE slug IN ('slug-1','slug-2', …);
```

Gli UPDATE devono essere **per singolo articolo, filtrati per `slug`** (mai UPDATE senza WHERE, mai su range), es.:

```sql
UPDATE blog_posts
SET title = '…', excerpt = '…', content = '…', read_time = '5 min', updated_at = now()
WHERE slug = 'coding-matematica-bambini' AND published = true;
```

Dopo ogni batch: (a) verificare il rendering di 2-3 articoli modificati sul sito (il parser è fragile: un carattere fuori dal sottoinsieme 8.2 degrada la resa); (b) riportare l'elenco slug modificati per il log in `BLOG_FIX_LOG.md` e per lo snapshot before/after in `content-backups/blog/` nel repo.

### 8.5 Perimetro

- Modificare SOLO gli articoli elencati nel batch corrente di `BLOG_AUDIT_RESULTS.md` — MAI gli articoli classificati "sani".
- Non creare né cancellare righe; non modificare altre tabelle.
- Se un articolo cita numeri/statistiche non verificabili: NON inventare fonti — flaggarlo nel riepilogo per revisione umana.

---

## Appendice — Riproducibilità baseline

Lo script della baseline (§3) legge gli articoli via API REST pubblica e calcola: word count, link in/out, orfani, ghost link, blocchi AEO/FAQ, menzioni regionali, disambiguazione, lunghezze title/excerpt. Dati intermedi: `scratchpad/blog_stats.json`. Nessuna modifica a DB o repo effettuata in questa fase.
