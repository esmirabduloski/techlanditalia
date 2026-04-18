

## Situazione attuale

La logica c'è già nel codice (funzioni `updateSchedule`, `toggleQueue`, `updateSettings` in `AdminDashboard.tsx`) e i dati sono nel database (`scheduled_publish_at`, `auto_publish_queue`, tabella `blog_settings`), ma **non sono visibili nell'interfaccia admin**. Per questo non trovi dove settare la data: i campi non sono renderizzati.

Inoltre nella `BlogEditor.tsx` (pagina di creazione/modifica articolo) manca completamente il campo "Data di pubblicazione programmata".

## Cosa aggiungere

### 1. Pannello globale "Auto-publish" in cima alla lista articoli (`AdminDashboard.tsx`)

Una card riassuntiva con:
- **Toggle "Auto-publish coda attivo"** → attiva/disattiva la pubblicazione automatica giornaliera (1 articolo al giorno alle 12:00).
- **Selettore orario** (numerico 0-23) → ora UTC in cui pubblicare.
- **Indicatore "Prossima pubblicazione"** → mostra il prossimo articolo in coda e quando uscirà.
- **Spiegazione testuale** breve di come funziona il sistema (data programmata vs coda).

### 2. Per ogni articolo nella lista (`AdminDashboard.tsx`)

Sotto al titolo/categoria aggiungo una riga compatta con:
- **Badge stato esteso**: `Pubblicato` / `Bozza` / `Programmato il GG/MM/AAAA HH:MM` / `In coda (#N)`.
- **Input datetime-local** "Programma pubblicazione" → setta `scheduled_publish_at` (con bottone "rimuovi" se già impostata).
- **Toggle "Aggiungi alla coda automatica"** → setta `auto_publish_queue`.

### 3. Nel `BlogEditor.tsx` (pagina nuovo/modifica articolo)

Aggiungo nell'header, accanto al toggle "Pubblicato/Bozza", una nuova sezione:
- **Campo "Programma pubblicazione"** (datetime-local) → permette di salvare un articolo come bozza con data futura.
- **Checkbox "Aggiungi a coda auto-publish"**.

### 4. Spiegazione delle 3 modalità (mostrata in UI come info-box)

```text
1. PUBBLICA SUBITO       → toggle "Pubblicato" attivo
2. DATA PROGRAMMATA      → bozza + data futura nel campo "Programma"
                            → si pubblica automaticamente a quella data/ora
3. CODA AUTOMATICA       → bozza + toggle "Aggiungi alla coda"
                            → uno al giorno alle 12:00 UTC, in ordine
```

## File da modificare

- `src/pages/admin/AdminDashboard.tsx` → aggiungere pannello settings + controlli per articolo
- `src/pages/admin/BlogEditor.tsx` → aggiungere campi data programmata e toggle coda

Nessuna modifica al database o all'edge function: tutto è già pronto lato backend (cron job ogni ora, tabella `blog_settings`, campi su `blog_posts`).

