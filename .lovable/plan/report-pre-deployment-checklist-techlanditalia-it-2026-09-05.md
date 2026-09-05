# Report Pre-Deployment Checklist — techlanditalia.it

Verifica punto per punto sullo stato attuale del progetto (dati raccolti dal codice, dalle policy del database e dalla configurazione di hosting).

Legenda: OK = requisito soddisfatto · PARZIALE = presente ma con lacune · DA FARE = mancante.

## 1. Autorizzazione (ogni accesso limitato ai propri dati) — OK
- Tutte le 61 tabelle pubbliche hanno la protezione a livello di riga attiva, con 187 regole di accesso complessive: non esiste tabella esposta senza policy.
- I controlli di proprietà usano l'identità dell'utente autenticato (`auth.uid()`) e funzioni helper dedicate (es. verifica genitore-figlio, insegnante-corso), quindi non basta essere loggati per leggere i dati di un altro.
- Gli ID sono UUID e le pagine private (area riservata, insegnante, admin) verificano il ruolo lato server, non solo lato interfaccia.

## 2. Link di reset password a scadenza — PARZIALE
- Il reset usa il sistema di autenticazione gestito della piattaforma: i link sono monouso e con scadenza, quindi il requisito di base è coperto.
- Da verificare/ridurre esplicitamente: la durata del token (valore consigliato 15–60 minuti) è ancora quella di default e non è stata configurata su misura. Da toccare nelle impostazioni di autenticazione.

## 3. Validazione input (SQL injection e XSS) — OK
- Nessuna query SQL costruita a mano dal client: tutto passa dal client ufficiale/API con query parametrizzate.
- I contenuti ricchi (blog, lezioni) vengono sanificati con DOMPurify prima di essere mostrati.
- Le funzioni server validano i campi in ingresso (email, lunghezze, tipi) e ci sono controlli anti-spam sui form pubblici.

## 4. CORS bloccato sul proprio dominio — DA FARE (punto più debole)
- 26 funzioni server su 28 rispondono con `Access-Control-Allow-Origin: *`, cioè accettano chiamate da qualsiasi sito.
- Solo il checkout di pagamento ha una lista di domini consentiti (`techlanditalia.it`, `www`, dominio lovable).
- Rischio concreto sulle funzioni amministrative e su quelle che inviano email. La protezione reale resta l'autenticazione, ma la restrizione dei domini va aggiunta.

## 5. Rate limiting — PARZIALE
- Presente su 7 funzioni sensibili: login studente, controllo tentativi di accesso, prenotazione, contatti, newsletter, candidature, chat AI. Ci sono anche tabelle dedicate al conteggio e agli eventi di sicurezza.
- Non coperte: funzioni admin (creazione utenti, reset password, assegnazione figli), invio newsletter, sitemap/llms, generazione contenuti. Il reset password si affida solo ai limiti di default della piattaforma.

## 6. Gestione errori e schermate personalizzate — PARZIALE
- Pagina 404 curata, in italiano, con link di rientro e `noindex`. Le funzioni server restituiscono JSON strutturato e non stack trace.
- Manca un **error boundary** React globale: se un componente va in errore, l'utente vede una pagina bianca invece di una schermata di errore con possibilità di riprovare.
- Non esistono schermate dedicate per 403/429/500 lato app.

## 7. Indici database sulle query calde — PARZIALE
- 164 indici presenti, quindi la base c'è.
- 26 chiavi esterne non hanno indice, tra cui alcune usate in continuazione: `enrollments.course_id`, `lesson_progress.lesson_id`, `task_progress.task_id`, `homework.lesson_id`, `homework_submissions.homework_id`, `profiles.parent_id`, `group_students.student_id`, `student_groups.course_id/teacher_id`, `blog_posts.author_id`.
- Con la crescita di studenti e articoli sono esattamente le query che rallentano prima (dashboard studente, progressi, gruppi).

## 8. Logging e monitoraggio — OK
- Sentry attivo in produzione con tracing e session replay, ed è già stato usato per intercettare bug reali.
- Tabelle interne per eventi di sicurezza, log di accesso admin, analytics e monitoraggio di progetto.
- Migliorabile: alert espliciti su picco errori/5xx e uptime check, oggi la notifica arriva solo via Sentry.

## 9. Strategia di rollback — OK (gestita dalla piattaforma)
- Non c'è blue-green self-hosted, ma l'hosting pubblica build immutabili e versionate: si può ripubblicare una versione precedente, e la cronologia del progetto consente di tornare indietro nel codice.
- Punto di attenzione reale: le **migrazioni del database non tornano indietro** con il rollback del codice. Esiste già un sistema di backup/export JSON, ma non una procedura di rollback testata.

## Riepilogo

| # | Punto | Stato |
|---|---|---|
| 1 | Autorizzazione | OK |
| 2 | Scadenza reset password | PARZIALE |
| 3 | Validazione input | OK |
| 4 | CORS | DA FARE |
| 5 | Rate limiting | PARZIALE |
| 6 | Gestione errori | PARZIALE |
| 7 | Indici database | PARZIALE |
| 8 | Logging e monitoraggio | OK |
| 9 | Rollback | OK |

## Interventi consigliati, in ordine di priorità

1. **CORS**: helper condiviso con lista domini consentiti (`techlanditalia.it`, `www`, dominio di pubblicazione, preview) applicato a tutte le funzioni server; mantenere aperte solo sitemap e llms, che sono pubbliche per natura.
2. **Indici**: una migrazione che aggiunge indice alle 26 chiavi esterne scoperte (operazione sicura, nessun impatto sui dati).
3. **Error boundary globale**: schermata di errore in italiano con pulsante "ricarica", collegata a Sentry.
4. **Rate limiting**: estenderlo alle funzioni admin e all'invio email; ridurre la durata dei token di reset password.
5. **Rollback**: scrivere e provare una procedura per il ripristino dei dati oltre a quella del codice.

Nessuna modifica è stata applicata: questo documento è solo il report richiesto. Se vuoi, procedo con gli interventi partendo dal punto 1.
