## Problema

Mi sono sbagliato nella risposta precedente: la pagina `/admin/utenti` **non ha** alcun bottone per creare nuovi utenti. La edge function `admin-create-user` esiste già e funziona, ma è chiamata solo da `AuthPage.tsx` (vecchio form di registrazione). Mancava completamente la UI nel pannello admin.

## Cosa farò

### 1. Aggiungere bottone "Crea utente" in `src/pages/admin/AdminUsers.tsx`
- Bottone primario "+ Crea utente" in alto a destra, vicino alla barra di ricerca
- All'apertura mostra un Dialog con form

### 2. Dialog di creazione (riusa logica già presente in AuthPage)
Campi del form:
- **Tipo account**: select tra "Genitore + Figlio" oppure "Insegnante"
- **Nome completo** (genitore o insegnante)
- **Email**
- **Password** (con generatore password casuale opzionale)

Se tipo = Genitore, mostra anche:
- **Nome del figlio**
- **Username del figlio** (per login senza email)
- **Corso da assegnare** (select dalla tabella `courses`, opzionale)

### 3. Submit
- Chiama `supabase.functions.invoke("admin-create-user", { body })` (già implementata)
- Mostra toast di successo/errore
- Ricarica la lista utenti
- Chiude il dialog

### 4. Validazioni client
- Email valida, password ≥ 6 caratteri
- Per genitore: nome figlio e username obbligatori
- Username figlio: solo lettere/numeri/underscore

## File modificati
- `src/pages/admin/AdminUsers.tsx` — aggiunta bottone + Dialog + handler

Nessuna modifica al backend: la edge function `admin-create-user` è già pronta e invia anche email di benvenuto automaticamente.
