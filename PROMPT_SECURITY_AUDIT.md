# Prompt: audit di sicurezza del codice (da usare con Fable 5.2)

Sei un esperto di sicurezza applicativa. Devi fare un **audit di sicurezza del solo codice** del repository `techlanditalia` (piattaforma di corsi e lezioni per studenti, tra cui minorenni, con genitori, docenti e amministratori).

## Regole
- **Solo analisi statica del repo.** Non contattare il sito in produzione, il progetto Supabase live, Vercel, Stripe o altri servizi esterni. Non eseguire migrazioni e non usare tool MCP che scrivono o leggono dati reali.
- **Non modificare il codice.** L'unico file da creare è `SECURITY_AUDIT.md` nella root, scritto in italiano. Fai commit e push sul branch di sviluppo assegnato alla sessione.
- **Non copiare segreti nel report.** Se trovi chiavi o token, indica file e riga e mascherali (es. `sk_live_****abcd`).
- Puoi eseguire comandi locali di sola lettura o di verifica: `npm audit`, `npm run lint`, `npm test`, grep, lettura dei file.
- Rispetta le regole di architettura in `AGENTS.md` quando proponi i fix.
- **Riporta solo problemi verificati nel codice**, con file e riga. Se un problema è plausibile ma non confermato, segnalo come "da verificare" e spiega cosa servirebbe per confermarlo.

## Stack (per orientarti)
- Frontend: React + Vite + `vite-react-ssg`, TipTap (editor rich text), Sentry, in `src/`.
- Backend: Supabase. 163 migrazioni SQL in `supabase/migrations/` (tabelle, policy RLS, funzioni `SECURITY DEFINER`, trigger), test RLS in `supabase/tests/rls` e `scripts/test-rls.sh`, configurazione in `supabase/config.toml`.
- Circa 60 edge function in `supabase/functions/` (codice condiviso in `_shared`).
- Hosting: `public/_headers` e `public/_redirects`. È presente anche Drizzle (`drizzle/`, `drizzle.config.ts`).
- Attenzione: il file `.env` risulta **tracciato da git** anche se è nel `.gitignore`. Controlla cosa contiene e anche la cronologia git (`git log -p -- .env`).

## Aree prioritarie (in ordine di priorità, ma controlla tutto)
1. **Dati degli studenti e dei minori:**
   - Policy RLS su ogni tabella con dati personali: tabelle senza RLS, policy `USING (true)` e `WITH CHECK` mancanti.
   - Accesso orizzontale: uno studente che legge i dati di un altro studente, un genitore che accede a figli non suoi, un docente che vede studenti che non sono suoi.
   - Funzioni `create-child-account`, `parent-set-child-password`, `parent-chat`, `student-login`, `delete-my-account`, `data-retention`, `purge-deleted-accounts`.
   - Viste e funzioni RPC che aggirano la RLS. Bucket di storage e relative policy.
   - Aspetti GDPR legati alla gestione dei dati dei minori.
2. **Funzioni admin ed escalation di privilegi:**
   - Tutte le funzioni `admin-*`: verifica che il ruolo admin sia controllato lato server in base al JWT, e non a partire dal body o da campi modificabili dall'utente.
   - Controlla se un utente può modificare il proprio ruolo, ad esempio tramite update su `profiles` o `user_roles`.
   - Uso di `service_role` nelle funzioni, funzioni `SECURITY DEFINER` senza `search_path` fissato, funzioni con `verify_jwt = false` in `config.toml`.
   - Endpoint `mcp`, `chat-operator`, `create-jira-ticket`, `sync-lead-to-notion`, `quote-genie-create-client`.
3. **Login, MFA e sessioni:**
   - `check-login-attempts`: rate limiting e possibilità di aggirarlo.
   - `mfa-recovery`, `admin-reset-mfa`, `send-password-reset-email`, `admin-set-password`, `student-login`.
   - Enumerazione degli utenti, token prevedibili o riutilizzabili, gestione della sessione nel client.
4. **Tutto il resto, con la stessa attenzione:**
   - Endpoint pubblici o chiamati da cron: `newsletter-*`, `submit-booking`, `submit-job-application`, `send-contact-email`, `course-proposal`, `satisfaction-survey`, `cron-*`, `send-*`, `teacher-calendar-feed`, `google-calendar*`. Controlla autenticazione, segreto dei cron, spam e abusi, injection nelle email.
   - Pagamenti: `stripe-create-checkout`, verifica dei webhook, manipolazione di prezzi e quantità dal client.
   - Upload: `validate-file-upload`. Controlla tipo MIME, dimensione, path traversal e SVG/HTML caricati.
   - Frontend: XSS (`dangerouslySetInnerHTML`, contenuto TipTap e blog renderizzato senza sanitizzazione), open redirect, segreti nel bundle (variabili `VITE_*`), controlli di accesso fatti solo lato client.
   - Header di sicurezza in `public/_headers` (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) e CORS nelle edge function (`Access-Control-Allow-Origin: *` su endpoint autenticati).
   - Dipendenze vulnerabili (`npm audit`) e GitHub Actions in `.github/` (permessi, secret, `pull_request_target`).
   - Rispetto delle regole di `AGENTS.md`: l'apertura di un materiale non deve alterare date, iscrizioni o ricompense. Verifica se un utente può forzare completamenti, crediti o certificati tramite chiamate dirette.

## Metodo
1. Mappa i ruoli (studente, genitore, docente, admin, anonimo) e per ciascuno cosa dovrebbe poter fare.
2. Ricostruisci lo **stato finale** dello schema leggendo le migrazioni in ordine: una policy può essere stata sovrascritta o rimossa da una migrazione successiva.
3. Per ogni edge function: chi può chiamarla, come autentica, quali input accetta senza validarli, con quale client accede al DB (anon o service_role).
4. Per ogni problema costruisci uno scenario d'attacco concreto: chi è l'attaccante, quale richiesta invia e cosa ottiene.

## Formato di `SECURITY_AUDIT.md`
1. **Sintesi**: numero di problemi per gravità e i 5 più urgenti.
2. **Tabella dei problemi**: ID, gravità (Critica / Alta / Media / Bassa / Info), area, file:riga, titolo.
3. **Dettaglio di ogni problema**:
   - Descrizione
   - Scenario d'attacco passo-passo
   - Impatto (specificando se coinvolge dati di minori)
   - Evidenza nel codice, con estratto breve
   - Fix consigliato, con snippet di codice o SQL
   - Stato: Confermato / Da verificare
4. **Cose fatte bene**: controlli presenti e corretti.
5. **Limiti dell'audit**: cosa non è stato possibile verificare con la sola analisi statica e cosa conviene testare sul sistema live.

Alla fine rispondimi in chat con un riepilogo breve e il link al file.
