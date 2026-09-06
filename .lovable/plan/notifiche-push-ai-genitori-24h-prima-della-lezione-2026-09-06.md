# Notifiche push ai genitori 24h prima della lezione

## Come funziona (risposta alla tua domanda)

Non ci si "collega" al telefono: è il telefono che deve dare il permesso una volta sola.

1. Il genitore entra nella sua area riservata dal telefono e preme un pulsante "Attiva notifiche".
2. Il telefono mostra il classico avviso di sistema "Vuoi ricevere notifiche da techlanditalia.it?". Se accetta, il browser genera un codice identificativo del dispositivo.
3. Quel codice viene salvato nel suo account. Da quel momento possiamo mandargli notifiche anche a sito chiuso.

Non serve email, non serve compilare moduli: solo quel consenso una volta per dispositivo. Se usa più dispositivi (telefono + PC), li attiva su ognuno.

Limiti da sapere:
- Android/Chrome: funziona subito.
- iPhone: Apple richiede che il sito venga prima aggiunto alla schermata Home ("Aggiungi a Home") e aperto da lì; altrimenti il permesso non compare. Va spiegato con un messaggio dedicato.
- Dentro l'anteprima Lovable il permesso non può comparire: va provato sul sito pubblicato in una scheda normale.
- Se il genitore rifiuta o non attiva nulla, non riceve niente: per questo teniamo comunque l'email come canale di riserva (opzionale, vedi Fase 3).

## Cosa costruiamo

Fase 1 — Consenso e registrazione dispositivo
- Nuova tabella dei dispositivi registrati (utente, codice dispositivo, tipo di dispositivo, data ultimo uso), leggibile e scrivibile solo dal proprietario.
- Pulsante "Attiva notifiche" nella dashboard genitore + interruttore nel profilo per disattivarle.
- Messaggi chiari per i casi: già attive, permesso negato, iPhone da aggiungere alla Home, anteprima da aprire in scheda separata.

Fase 2 — Invio automatico 24h prima
- Funzione server che ogni ora cerca le lezioni programmate che iniziano tra 24 e 25 ore, trova i genitori degli alunni di quel gruppo e invia la notifica tramite Firebase.
- Testo: "Domani lezione di {corso} alle {ora}" con tocco che apre la dashboard.
- Registro degli invii per non mandare mai due volte la stessa notifica.
- I codici dispositivo scaduti vengono eliminati automaticamente.

Fase 3 (opzionale, da confermare)
- Pagina admin per vedere quanti genitori hanno le notifiche attive e inviare un avviso manuale a un gruppo.
- Email di promemoria per chi non ha attivato le notifiche.

## Dettagli tecnici

- Client: `firebase/app` + `firebase/messaging`, config dalle variabili `VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_*` (`messagingSenderId` ricavato dall'app id); service worker `public/firebase-messaging-sw.js` registrato con la config in query string; token ottenuto con la VAPID key.
- DB: tabella `push_devices` (`user_id`, `token` unico, `platform`, `user_agent`, `last_seen_at`) con RLS per proprietario + `service_role`; tabella `push_notifications_log` (`user_id`, `schedule_id`, `type`, `sent_at`) con unicità su (`user_id`,`schedule_id`,`type`).
- Edge function `send-lesson-reminders`: legge `group_lesson_schedule` (con `lesson_time`, fuso Europe/Rome) unendo `group_students` → `profiles.parent_id`, invia via gateway `https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send` con `LOVABLE_API_KEY` + `FIREBASE_MESSAGING_API_KEY`; su 404 UNREGISTERED cancella il token.
- Schedulazione oraria con pg_cron/pg_net verso la funzione.
- Coperte anche le lezioni in `scheduled_lessons` (per corso) se vuoi includerle: da confermare.

## Domanda aperta

Il promemoria deve partire dalle date dei gruppi (`group_lesson_schedule`, quelle che vedi nel calendario del gruppo), da quelle di corso (`scheduled_lessons`), o da entrambe? Di default userò le date dei gruppi.
