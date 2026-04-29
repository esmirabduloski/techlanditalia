# Piano implementazione: llms.txt + Markdown Mirrors

## Scelte confermate
- Markdown mirrors **indicizzabili da tutti** (Google + AI crawler) con `<link rel="canonical">` markdown verso le pagine HTML per evitare duplicate content
- Mirror **dinamici completi** via edge function per blog e corsi

## File da creare

### 1. `public/llms.txt`
Index curato secondo standard llmstxt.org:
- H1 "TECHLAND" + blockquote descrizione (scuola coding online 5-20 anni, alunni)
- Sezione "About" con value proposition, target, modalità lezioni
- Sezione "Corsi" con link markdown a `/corsi/<slug>.md` per ogni corso visibile
- Sezione "Per i genitori" → faq.md, chi-siamo.md, come-funziona
- Sezione "Blog" → link a `/blog.md` + top articoli evergreen
- Sezione "Prenotazione" → prenota.md + contatti.md
- Sezione "Optional" → privacy, termini, cookie

### 2. `public/llms-full.txt`
Versione "all-in-one": contenuto completo concatenato delle pagine evergreen (homepage, corsi, FAQ, chi-siamo, prenota). Permette agli LLM di consumare tutto in un fetch.

### 3. Markdown mirrors statici in `public/`
- `index.md` — homepage (hero, perché TECHLAND, corsi preview, FAQ top 8, CTA)
- `corsi.md` — catalogo completo con descrizioni, età, durata, prezzo
- `chi-siamo.md` — storia, mission, team, valori
- `faq.md` — tutte le FAQ in formato Q&A markdown
- `prenota.md` — come prenotare lezione gratuita, cosa serve
- `contatti.md` — telefono, email, social, orari

Ogni file include header YAML-style (title, description, url canonico) e link assoluti `https://techlanditalia.it`.

### 4. Edge function `generate-llms-content`
Route handler che genera dinamicamente:
- `GET /functions/v1/generate-llms-content?type=blog&slug=<slug>` → markdown articolo
- `GET /functions/v1/generate-llms-content?type=course&slug=<slug>` → markdown corso

Legge da `blog_posts` (published=true) e `courses` (is_visible=true). Rende HTML→markdown del contenuto, aggiunge metadata, link canonical, CTA.

CORS abilitato. `verify_jwt = false` (contenuto pubblico).

### 5. Aggiornamenti file esistenti

**`public/robots.txt`** — aggiungo blocchi espliciti per AI crawler (best practice, anche se sono già coperti da `User-agent: *`):
```
User-agent: GPTBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: anthropic-ai
Allow: /

# AI/LLM discovery
# llms.txt: https://techlanditalia.it/llms.txt
```

**`public/_headers`** — aggiungo:
```
/*.md
  Content-Type: text/markdown; charset=utf-8
  Cache-Control: public, max-age=3600
  X-Robots-Tag: index, follow

/llms.txt
  Content-Type: text/markdown; charset=utf-8
  Cache-Control: public, max-age=3600

/llms-full.txt
  Content-Type: text/markdown; charset=utf-8
  Cache-Control: public, max-age=3600
```

**`index.html`** — nel `<head>`:
```html
<link rel="alternate" type="text/markdown" title="TECHLAND (Markdown for LLMs)" href="/llms.txt" />
<link rel="alternate" type="text/markdown" href="/index.md" />
```

**`supabase/functions/generate-sitemap/index.ts`** — aggiungo le URL `.md` statiche al sitemap (homepage.md, corsi.md, ecc.) e una entry per `llms.txt` così i crawler tradizionali le scoprono.

**`public/robots.txt`** — aggiungo riferimento a `llms.txt` come commento e mantengo `Sitemap:` esistente.

## Struttura finale

```text
public/
├── llms.txt
├── llms-full.txt
├── index.md
├── corsi.md
├── chi-siamo.md
├── faq.md
├── prenota.md
├── contatti.md
├── robots.txt        (aggiornato)
└── _headers          (aggiornato)

supabase/functions/
└── generate-llms-content/
    └── index.ts      (nuovo)

src/
└── (index.html aggiornato con <link rel="alternate">)
```

## Note SEO
- I `.md` avranno frontmatter con link canonical alla versione HTML per evitare problemi duplicate content lato Google
- Tutti i link interni nei markdown saranno **assoluti** (`https://techlanditalia.it/...`) per massima portabilità quando un LLM li consuma fuori contesto
- Copy ottimizzato con keywords brand (TECHLAND prima nei titoli) e keyword long-tail già presenti nel sito
- Tono coerente con memoria: "alunni", target 5-20 anni

## Cosa non viene toccato
- Database, RLS, auth
- Routing React (i `.md` sono file statici serviti da Lovable hosting)
- Componenti UI esistenti
