## Obiettivo

Permettere all'admin di modificare TUTTI i contenuti della pagina dettaglio di ogni corso (`/corsi/scratch`, `/corsi/roblox`, ecc.) direttamente dal pannello admin → Corsi, cliccando l'icona matita.

## Cosa potrai modificare

Per ogni corso, dal pannello admin:

**Sezioni Hero / informazioni base** (già presenti nel DB):
- Titolo, emoji, descrizione breve, fascia d'età, livello, durata

**Sezioni di contenuto** (oggi hardcoded, da spostare in DB):
- "Informazioni sul corso" (descrizione lunga)
- Tag visualizzati
- "Argomenti trattati" (lista bullet)
- "Esempi di progetto" (lista titoli, oppure progetti Scratch embed per il corso Scratch)
- "Curriculum del corso" → moduli, ognuno con titolo, lezioni e risultato

**SEO**:
- SEO title, meta description, keywords (override per singolo corso)

## Approccio tecnico

1. **DB** — aggiungere alla tabella `courses` una colonna `detail_content jsonb` (default `{}`) che ospita tutti i campi sopra. Nessun nuovo JOIN, nessuna nuova tabella.
   - Backfill: popolare `detail_content` di ogni corso esistente con i dati attualmente hardcoded in `src/pages/CorsoDettaglio.tsx`, così la pagina pubblica continua a mostrare gli stessi contenuti subito dopo la migrazione.

2. **Pagina pubblica** (`src/pages/CorsoDettaglio.tsx`) — leggere `detail_content` dal DB e usarlo come fonte verità. I dati hardcoded restano solo come fallback di sicurezza per slug non ancora migrati.

3. **Admin Corsi** (`src/pages/admin/AdminCourses.tsx`) — il dialog "Modifica corso" attuale resta per i campi base. Aggiungere un secondo bottone "Modifica contenuto pagina" su ogni card corso che apre un editor dedicato (nuova pagina `src/pages/admin/AdminCourseContent.tsx` su rotta `/admin/corsi/:id/contenuto`) con form strutturato:
   - Textarea per descrizione lunga
   - Lista editabile di tag (aggiungi/rimuovi)
   - Lista editabile di argomenti trattati
   - Lista editabile di esempi di progetto (titolo + opzionale ID Scratch per embed)
   - Editor moduli: aggiungi/rimuovi modulo, ogni modulo ha titolo, lista lezioni riordinabili, campo risultato
   - Sezione SEO (title, description, keywords)
   - Auto-backup pre-salvataggio (riusa `useAutoBackup` già esistente)

4. **Sicurezza** — nessun cambio RLS necessario: la policy `Admins can manage courses` copre già update di `detail_content`.

## File modificati / creati

- migration: aggiunta colonna `detail_content jsonb` + backfill di tutti i corsi esistenti
- modificato: `src/pages/CorsoDettaglio.tsx` (legge dal DB, fallback sui dati hardcoded)
- modificato: `src/pages/admin/AdminCourses.tsx` (bottone "Modifica contenuto pagina" su ogni card)
- nuovo: `src/pages/admin/AdminCourseContent.tsx` (editor dedicato)
- modificato: `src/App.tsx` (rotta `/admin/corsi/:id/contenuto`)

## Cosa NON cambia

- Le rotte pubbliche `/corsi/<slug>` restano identiche
- La gestione lezioni (`/admin/corsi/:id/lezioni`) resta separata e invariata
- Il form "Prenota una lezione" in fondo alla pagina resta invariato
- Layout e stile della pagina pubblica restano identici
