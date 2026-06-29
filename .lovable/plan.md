
# Piano implementazione: Roadmap, Streak Freeze, Glossario, Referral

Quattro feature indipendenti, organizzate in batch separati così posso fermarmi tra uno e l'altro se vuoi rivedere.

---

## Batch 1 — Roadmap visiva "Da Scratch a Python a AI" (#20)

**Dove:** sezione dedicata in `/corsi`, sopra la grid dei corsi. Solo frontend, nessuna modifica DB.

**Cosa costruisco:**
- Nuovo componente `src/components/corsi/LearningRoadmap.tsx`: timeline orizzontale (desktop) / verticale (mobile) con 4 tappe in ordine pedagogico:
  1. **Fondamenta visuali** (6-9 anni) → Scratch, Minecraft
  2. **Game design** (9-13 anni) → Roblox base & avanzato
  3. **Coding reale** (11-16 anni) → Python base
  4. **AI & futuro** (14-18 anni) → Python + AI
- Ogni tappa: icona corso, età, durata media, badge "Inizia qui" / "Livello successivo", CTA che linka a `/corsi/{slug}`.
- Linea di connessione animata (CSS gradient verde primario → blu accent) tra le tappe.
- Inserita in `src/pages/Corsi.tsx` subito sopra la sezione filtri/grid.
- JSON-LD `ItemList` con i 4 step per visibilità SEO/AI.

**Niente impatto su:** DB, auth, altre pagine.

---

## Batch 2 — Streak Freeze (#26, entrambi)

Due meccaniche combinate:

### 2A. Freeze automatico per assenze giustificate (logica server, zero UI)
- Modifica `update_group_attendance_streak`: status `'excused'` non azzera più la streak (oggi solo `'absent'` reset — verifico in fix la coerenza).
- Stessa logica per `update_homework_streak`: aggiungo controllo su nuovo campo o flag per "assenza giustificata in quella lezione" → niente reset per compito non consegnato.

### 2B. Freeze manuali (2/mese) attivabili dall'alunno
- **Nuova tabella `streak_freezes`**: `id, student_id, used_at, freeze_type ('homework'|'attendance'), reason, related_homework_id?, related_lesson_number?`.
- **Funzione `consume_streak_freeze(student_id, freeze_type)`** SECURITY DEFINER: verifica < 2 freeze nel mese corrente, inserisce record, ritorna boolean.
- **Trigger streak homework** modificato: prima di azzerare, prova a consumare un freeze; se ok, mantiene streak.
- **UI nuovo componente `StreakFreezeButton.tsx`** in `HomeworkSection.tsx` e nella card streak del dashboard: "🧊 Usa Freeze (X/2 questo mese)" con dialog di conferma.
- Visualizzazione storico freeze usati nel mese nel widget streak.

**Tabelle modificate:** nuova `streak_freezes` + GRANT + RLS (student/parent vede i propri, admin tutti).

---

## Batch 3 — Glossario interattivo (#36)

### 3A. Database & gestione
- **Nuova tabella `glossary_terms`**: `id, term, slug, definition (text), category ('scratch'|'python'|'roblox'|'ai'|'general'), examples (jsonb), related_terms (uuid[]), is_published`.
- Seed iniziale ~40 termini (variabile, ciclo, funzione, classe, IDE, debug, sprite, blocco, evento, API, ML, prompt, ecc.).
- CRUD admin in nuova pagina `src/pages/admin/AdminGlossary.tsx` (link in sidebar admin).

### 3B. Pagina pubblica `/glossario` (SEO)
- `src/pages/Glossario.tsx`: filtro A-Z + filtro categoria, ricerca, card per termine, `DefinedTerm` JSON-LD per ogni voce.
- Route in `App.tsx`, voce in footer, sitemap aggiornata.

### 3C. Tooltip in-lezione
- Componente `GlossaryTooltip.tsx`: wrappa parole matchate.
- Hook `useGlossaryHighlight(htmlContent)`: parsa HTML lezione, sostituisce occorrenze (case-insensitive, prima occorrenza per termine, no match dentro `<code>`/`<pre>`) con `<span data-term="slug">`.
- Applicato in `LessonView` / componente di rendering contenuto lezione. Popover shadcn con definizione + link a `/glossario#slug`.

---

## Batch 4 — Referral program (#57, versione admin-driven)

**Flusso scelto:** codice univoco genitore → link tracking → admin vede pending → accredita manualmente con motivo.

### 4A. Database
- Aggiungo a `profiles`: `referral_code text unique` (auto-generato per genitori al primo login).
- **Nuova tabella `referrals`**: `id, referrer_id (parent), referred_email, referred_lead_id?, referred_profile_id?, status ('pending'|'qualified'|'rewarded'|'rejected'), source_url, created_at, rewarded_at, reward_notes`.
- Estendo enum `lesson_balance_log.operation_type` (o aggiungo riga con `notes`) per supportare reason "referral_paying" e altri motivi liberi.

### 4B. Dashboard genitore
- Nuova sezione "Invita un amico" in `src/pages/Dashboard.tsx`:
  - Mostra codice + link copiabile (`https://techlanditalia.it/?ref=CODICE`).
  - Bottoni share WhatsApp/email/copy.
  - Lista dei propri referral con stato (in attesa / accreditato).
  - Messaggio: "Quando il tuo amico paga la prima lezione, riceverete entrambi 1 lezione gratis dopo verifica admin."

### 4C. Tracking
- Hook `useReferralTracking()`: legge `?ref=` da URL, salva in localStorage 30 giorni.
- Form trial booking + signup leggono il codice, creano riga `referrals` (pending) con referrer + email/lead.

### 4D. Admin
- Nuova pagina `src/pages/admin/AdminReferrals.tsx`:
  - Lista referral pending, qualified, rewarded.
  - Azione "Accredita lezione" con dropdown motivi (`1 referral pagante`, `bonus campagna`, `compensazione`, `altro` con textarea libera).
  - Al click: aggiorna `profiles.lesson_balance` (+1) per referrer e per referred, scrive 2 righe in `lesson_balance_log` con `operation_type='credit_added'` e `notes` con il motivo scelto, marca referral `rewarded`.

---

## Dettagli tecnici (riassunto)

```text
DB migrations richieste:
  - streak_freezes (tabella + RLS + GRANT)
  - consume_streak_freeze() function
  - update_homework_streak / update_group_attendance_streak (revisione 'excused')
  - glossary_terms (tabella + RLS + GRANT, public read, admin write)
  - profiles.referral_code (colonna + unique + backfill)
  - referrals (tabella + RLS + GRANT)

Nuove pagine / route:
  - /glossario (pubblica)
  - /admin/glossary
  - /admin/referrals

Nuovi componenti chiave:
  - LearningRoadmap, StreakFreezeButton, GlossaryTooltip, ReferralCard
```

## Esecuzione

Procedo **Batch 1 → 2 → 3 → 4** in ordine, fermandomi dopo ogni batch così puoi testare. Confermi di partire dal Batch 1 (Roadmap)?
