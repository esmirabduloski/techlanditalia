
# Piano fix SEO on-page TECHLAND

Basato sull'audit Claude + tue risposte:
- Fascia età ufficiale: **6-18 anni**
- Claim Chi Siamo: **mantieni "1.200+ studenti formati" e cambia fondazione a 2023** (P3 risolto solo sulla data)
- /lp/: **strategia B** (indicizzabili + canonical verso /corsi/ corrispondente)
- Scratch/Minecraft/Unity (P6): **skip**, nessuna azione
- Prerender (P1): **skip** (non supportato in modo nativo da Lovable/Vite SPA senza riarchitettura; tutto il resto dei fix risolve il 90% dei sintomi P1)

---

## BATCH 1 — Sitewide head & coerenza (rapido, alto impatto)

**File: `index.html`**
- Rimuovere `<link rel="canonical" href="https://techlanditalia.it/">` fisso (ogni rotta lo imposta via SEOHead/Helmet).
- Rimuovere i blocchi JSON-LD `Organization` e `WebSite` (resta solo quello iniettato per pagina). Lasciare eventuale schema sitewide minimo.
- Allineare `<title>` statico a un valore neutro: `TECHLAND | Coding per Bambini e Ragazzi 6-18`.

**File: `src/components/seo/SEOHead.tsx`**
- `organizationSchema.foundingDate`: `"2019"` → `"2023"`.
- Verificare che `organizationSchema`/`websiteSchema` siano iniettati solo dove ha senso (home) per evitare duplicati con index.html (ora rimosso).

**Coerenza età 6-18** (sostituire ogni occorrenza di "5-20", "5 ai 20", "5-17", "5 ai 17" con 6-18 nel copy brand, mantenendo sotto-fasce per singolo corso):
- `src/pages/Corsi.tsx` (title + copy)
- `src/pages/FAQ.tsx` + `public/faq.md`
- `src/pages/ChiSiamo.tsx` + `public/chi-siamo.md`
- `src/pages/Termini.tsx`
- `src/pages/Prenota.tsx` + `public/prenota.md`
- `src/components/sections/HeroSection.tsx`
- `src/components/sections/SEOKeywordsSection.tsx`
- `src/pages/LavoraConNoi.tsx` (job description "5 ai 20")

**Aggiornare memoria progetto**: cambiare regola brand da 5-20 a 6-18.

## BATCH 2 — Quick wins per pagina

- **`src/pages/Corsi.tsx`** → title: `Corsi di Coding per Bambini e Ragazzi 6-18 | TECHLAND` (era 5–20).
- **`src/pages/Prenota.tsx`** → title: `Prenota la Lezione di Prova Gratuita | TECHLAND` (47 char, era 67).
- **`src/pages/Contatti.tsx`** → rimuovere `"contactOption": "TollFree"` dallo schema ContactPoint.
- **`src/pages/CorsoDettaglio.tsx`**:
  - Pulire `titleMap`/`descMap` da slug morti (`roblox-base`, `python-pro-ai`).
  - Front-load: spostare `TECHLAND |` in coda nei title (es. `Corso Python e AI per Ragazzi 14-18 | TECHLAND`).
  - Allineare il campo `age` di ogni corso col range nel title SEO.
- **`src/pages/ChiSiamo.tsx`**: `foundingDate` già coperta da SEOHead; lasciare copy "1.200+" come richiesto.

## BATCH 3 — Landing /lp/ (Strategia B)

**File: `src/pages/LandingPage.tsx`**
- Aggiungere `canonical` esplicito verso la pagina-corso corrispondente quando il tema coincide:
  - `/lp/roblox` → canonical `/corsi/roblox`
  - `/lp/python` → canonical `/corsi/python-base`
  - `/lp/python-ai` → canonical `/corsi/python-ai`
  - `/lp/scratch`, `/lp/minecraft`, `/lp/abc-informatica` → self-canonical (nessun corso equivalente).
- Mappatura in `LandingPage.tsx` con fallback al self-canonical.
- Nessuna modifica alla sitemap (restano indicizzabili).

## BATCH 4 — Lavora con noi (JobPosting)

**File: `src/pages/LavoraConNoi.tsx`**
- Aggiungere `baseSalary` allo schema JobPosting (range o "da concordare" strutturato).
- Verificare `validThrough` futura (ok 2026-12-31).
- Età 6-18 coperta dal Batch 1.

---

## Cosa NON faccio (deciso con te)
- **P1 prerender**: richiede riarchitettura (SSG/SSR) fuori scope di Lovable SPA. I mirror `.md` + `llms.txt` già coprono i bot AI; Google rende JS.
- **P3 numeri Chi Siamo**: mantenuti come confermato.
- **P6 Scratch/Minecraft/Unity**: nessuna azione.

---

## Procedura

Comincio con **Batch 1** subito dopo l'approvazione. Prima di partire ho un'ultima micro-domanda:

> Nel Batch 1 rimuovo i blocchi JSON-LD `Organization` e `WebSite` da `index.html` e li tengo solo via SEOHead sulla home. Confermi? (Alternativa: tengo i due schema in `index.html` come fallback per crawler no-JS, e li rimuovo invece da SEOHead. Risultato SEO equivalente, ma il fallback statico è leggermente meglio per Bing/AI bots.)

Dimmi A (rimuovo da index.html) o B (rimuovo da SEOHead, tengo in index.html) e procedo.
