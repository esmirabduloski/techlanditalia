# Procedura di rollback — TECHLAND

Il rollback del codice e quello dei dati sono due cose diverse. Questa procedura copre entrambe.

## 1. Rollback del codice (2 minuti)

L'hosting pubblica build immutabili: per tornare indietro basta ripubblicare la versione precedente dalla cronologia del progetto. Non serve rebuild.

1. Aprire la cronologia delle versioni del progetto.
2. Selezionare l'ultima versione funzionante (prima del deploy sospetto).
3. Ripristinare e ripubblicare.
4. Verificare: home, `/corsi`, login genitore, login studente, `/prenota`.

## 2. Rollback delle edge function

Le funzioni non tornano indietro con il codice pubblicato: vanno ridistribuite dalla versione ripristinata. Dopo il ripristino, richiedere il deploy delle funzioni toccate dal deploy incriminato.

## 3. Rollback del database (attenzione)

Le migrazioni **non** sono reversibili automaticamente.

Prima di ogni migrazione rischiosa (rinomina/eliminazione colonne, cambio tipi, cancellazioni massive):

1. Eseguire un export da `/admin/backup-json` delle tabelle coinvolte (oltre allo snapshot giornaliero automatico).
2. Annotare data/ora dell'export.
3. Applicare la migrazione.

In caso di problema:

- **Struttura**: scrivere una migrazione inversa (es. ri-aggiungere la colonna con i valori di default) — non esiste "undo".
- **Dati**: reimportare il file JSON esportato al punto 1 tramite le funzioni di import di `/admin/backup-json`, `/admin/utenti`, blog, corsi o CRM.

## 4. Checklist post-rollback

- [ ] Login genitore, studente, insegnante, admin
- [ ] Prenotazione lezione gratuita (form + email)
- [ ] Area riservata: corsi, compiti, calendario
- [ ] Errori Sentry in calo
- [ ] Pubblicazione blog programmata ancora in coda

## 5. Prova periodica

Ogni trimestre: ripristinare una versione precedente in preview e reimportare un export JSON di prova, per verificare che la procedura funzioni prima di averne bisogno.
