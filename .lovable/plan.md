

## Piano: Pagina Admin "Documentazione Funzionalità"

### Obiettivo
Creare una pagina `/admin/documentazione` che elenca tutte le funzionalità della piattaforma, organizzate per ruolo, sempre aggiornata perché fa parte del codice stesso.

### Cosa verrà creato

**1. Nuovo file `src/pages/admin/AdminDocumentation.tsx`**
- Pagina con sezioni espandibili (Accordion) per ogni area:
  - **Area Pubblica** — Homepage, Corsi, Blog, Prenotazione, Contatti, FAQ, pagine legali
  - **Area Studenti** — Dashboard, gamification (punti/badge/streak), editor codice (Python/Web), compiti, classifica, acquisti
  - **Area Genitori** — Monitoraggio figli, storico pagamenti, chat supporto, feedback
  - **Area Insegnanti** — Dashboard, gestione gruppi, registro presenze, gradebook, report lezioni, vista corsi/lezioni
  - **Area Admin** — Blog editor, gestione corsi/lezioni/task/compiti, gruppi, calendario, presenze, prenotazioni, contatti, newsletter, utenti, valutazioni, statistiche, analytics, backup, link insegnanti, report, simulatore vista
- Ogni funzionalità avrà: nome, breve descrizione, percorso della rotta
- Stile coerente con le altre pagine admin (usa Layout, AdminNav, Card, Badge)
- Barra di ricerca per filtrare rapidamente le funzionalità

**2. Registrazione rotta in `src/App.tsx`**
- Aggiunta lazy import e `<Route path="/admin/documentazione">` 

**3. Link nella navigazione admin `src/components/admin/AdminNav.tsx`**
- Aggiunta voce "Docs" con icona `BookText` nell'array `navItems`

### Dettagli tecnici
- I dati delle funzionalità sono definiti staticamente nel componente (array di oggetti tipizzati) — questo è intenzionale: ogni volta che si aggiunge una feature al sito, si aggiunge anche la relativa entry nella documentazione
- Componenti UI: `Accordion`, `Card`, `Badge`, `Input` (ricerca), icone Lucide
- Nessuna modifica al database necessaria

