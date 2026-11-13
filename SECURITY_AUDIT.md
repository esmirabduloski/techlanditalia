# Audit di sicurezza del codice — TechLand Italia

Data: 13 novembre 2026. Ambito: sola analisi statica del repository (nessun contatto con sito, Supabase, Stripe o altri servizi live).

Cosa è stato esaminato:

- **Database:** stato finale ricostruito applicando in ordine le 163 migrazioni di `supabase/migrations`, `supabase/tests/rls/00_drift.sql` e le 88 di `drizzle/migrations` (95 tabelle, 272 policy, 129 funzioni, grant e trigger).
- **Edge function:** le 55 funzioni in `supabase/functions`. Login, MFA, funzioni `admin-*`, account figli, pagamenti, upload e chat sono state lette per intero; le altre sono state controllate su autenticazione, ruolo, MFA e validazione degli input (vedi sezione 5).
- **Frontend:** punti di iniezione HTML, iframe, redirect, variabili `VITE_*`, CSP.
- **Altro:** `.env`, `public/_headers`, workflow GitHub, `npm audit`.

## 1. Sintesi

| Gravità | Numero |
|---|---|
| Critica | 0 |
| Alta | 1 |
| Media | 8 |
| Bassa | 14 |
| Info | 4 |

Non sono emerse falle che permettano a un utente di diventare admin o di leggere liberamente le tabelle con i dati degli studenti: la RLS è attiva su tutte le tabelle e i controlli su ruoli e 2FA sono solidi. I problemi trovati stanno ai margini di questo impianto.

I 5 più urgenti:

1. **A-01** — La classifica (`get_leaderboard`) è chiamabile senza login e restituisce nome, cognome e ID di tutti gli studenti.
2. **M-01** — Uno studente può inserirsi da solo una consegna già valutata, con voto e "feedback dell'insegnante" falsi.
3. **M-02** — Otto edge function riservate agli admin non verificano la 2FA: con la sola password di un admin si può, per esempio, inviare una newsletter a tutti gli iscritti.
4. **M-03** — Il blocco dopo i tentativi di login falliti è per email e vale solo dentro `student-login`: chiunque può bloccare l'account di un altro, e chi attacca può aggirarlo.
5. **M-06** — Il codice web degli studenti gira in un iframe con la stessa origine del sito, quindi può leggere il token di sessione.

## 2. Tabella dei problemi

| ID | Gravità | Area | File:riga | Titolo | Stato |
|---|---|---|---|---|---|
| A-01 | Alta | Dati minori | `supabase/migrations/20260309233113_…sql:2` | Classifica studenti leggibile senza login | Confermato nel codice |
| M-01 | Media | Integrità voti | `supabase/migrations/20260624204034_…sql:75` | Consegna con voto e feedback falsi tramite INSERT diretto | Confermato |
| M-02 | Media | Admin / MFA | `supabase/functions/newsletter-send/index.ts:57` e altre 7 | Funzioni admin senza controllo 2FA | Confermato |
| M-03 | Media | Login | `supabase/functions/student-login/index.ts:57,124` | Blocco login per email: abusabile e aggirabile | Confermato / in parte da verificare |
| M-04 | Media | Integrità dati | `supabase/migrations/20260629225042_…sql:35,74` | `consume_streak_freeze` agisce su qualsiasi studente | Confermato |
| M-05 | Media | Dati minori | `drizzle/migrations/0052_course_certificates.sql:80`, `0065_…sql:74` | Codici attestato corti ed enumerabili | Confermato |
| M-06 | Media | Frontend / XSS | `src/components/lesson/WebCompiler.tsx:550,943`, `HomeworkView.tsx:705`, `TeacherHomeworkView.tsx:420` | Iframe del codice studente con stessa origine del sito | Confermato |
| M-07 | Media | Auth / OAuth | `src/pages/OAuthConsent.tsx:30-87`, `supabase/functions/mcp/index.ts:122` | Consenso OAuth: token utente a client terzi | Da verificare |
| M-08 | Media | Upload | `supabase/functions/validate-file-upload/index.ts`, `supabase/migrations/20251229015707_…sql:19` | Validazione upload solo consultiva, bucket senza limiti | Confermato |
| B-01 | Bassa | Abuso | `supabase/functions/create-jira-ticket/index.ts:92-131` | Ticket Jira creabili da qualsiasi utente, senza limiti | Confermato |
| B-02 | Bassa | Ricompense | `supabase/migrations/20260718130813_…sql:10` | `complete_lesson`: nessun controllo data senza gruppo | Confermato |
| B-03 | Bassa | Login | `supabase/functions/student-login/index.ts:156-202` | Login figlio con la password del genitore | Confermato |
| B-04 | Bassa | Info leak | `drizzle/migrations/0078_second_parent.sql:53` e altre | Funzioni di supporto chiamabili senza login | Confermato nel codice |
| B-05 | Bassa | Storage | `supabase/migrations/20251229015707_…sql:19`, `20260101015056_…sql` | Bucket pubblici residui | Da verificare |
| B-06 | Bassa | CORS / redirect | `supabase/functions/_shared/cors.ts:29`, `familyaccounts.ts:39` | Wildcard `*.lovable.app` | Confermato |
| B-07 | Bassa | Anti-abuso | `supabase/functions/_shared/turnstile.ts`, `ratelimit.ts:67` | Turnstile e rate limit "fail-open" | Confermato |
| B-08 | Bassa | Privacy | `send-password-reset-email/index.ts:49`, `student-login/index.ts:74` e altre | Email e username nei log | Confermato |
| B-09 | Bassa | Enumerazione | `newsletter-subscribe/index.ts:94`, `check-login-attempts/index.ts:57` | Risposte che rivelano se un'email esiste o è bloccata | Confermato |
| B-10 | Bassa | Admin | `admin-toggle-role/index.ts`, `admin-set-password/index.ts`, `delete-my-account/index.ts` | Azioni sensibili senza riconferma né registro | Confermato |
| B-11 | Bassa | Account figli | `supabase/functions/create-child-account/index.ts:44-131` | Nessun limite, username non validato, profilo orfano | Confermato |
| B-12 | Bassa | Dipendenze | `package.json` | 10 vulnerabilità alte e 11 moderate in `npm audit` | Confermato |
| B-13 | Bassa | Minori | `supabase/functions/course-proposal/index.ts:259` | Lo studente può accettare la proposta commerciale | Confermato |
| B-14 | Bassa | Header | `public/_headers:2-4`, `index.html:15` | Header di sicurezza non applicati, CSP permissiva | Confermato nel codice |
| I-01 | Info | Segreti | `.env` | `.env` tracciato da git (solo chiavi pubbliche) | Confermato |
| I-02 | Info | Auth | — | Registrazione pubblica: account "nudi" | Da verificare |
| I-03 | Info | Supply chain | `supabase/functions/*/index.ts:1-3`, `.github/workflows/*.yml` | Import e action non fissati a una versione esatta | Confermato |
| I-04 | Info | Login | `supabase/functions/student-login/index.ts:20,77` | Client service-role riusato per il login utente | Da verificare |

## 3. Dettaglio

### A-01 — Classifica studenti leggibile senza login (Alta)

**Descrizione.** `get_leaderboard` è `SECURITY DEFINER`, non controlla `auth.uid()` e nessuna migrazione ne revoca l'esecuzione ad `anon`. Il parametro `_limit` non ha tetto.

**Scenario.**
1. L'attaccante prende URL e chiave pubblica dal bundle del sito.
2. Chiama `POST /rest/v1/rpc/get_leaderboard` con `{"_limit": 100000}`, senza login.
3. Riceve `user_id`, `full_name`, `avatar_id`, `total_points` di tutti i profili con ruolo `student`.

**Impatto.** Elenco completo di nomi e cognomi di minori, con il loro ID interno. Coinvolge dati di minori. Gli ID ottenuti alimentano M-04 e B-04.

**Evidenza.** `supabase/migrations/20260309233113_…sql:2-45`: `LANGUAGE sql STABLE SECURITY DEFINER`, `WHERE p.role = 'student' AND (_filter_type = 'global' OR …) LIMIT _limit`. Nessun `REVOKE` in tutte le migrazioni.

**Fix.**
```sql
CREATE OR REPLACE FUNCTION public.get_leaderboard(...)  -- stessa firma
... AS $$
  SELECT ... FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND public.mfa_ok()
    AND p.role = 'student'
    AND ( -- solo classifiche a cui chi chiama appartiene
      (_filter_type = 'course' AND (public.is_enrolled_in_course(auth.uid(), _filter_id)
         OR public.is_parent_of_enrolled(auth.uid(), _filter_id)
         OR public.is_teacher_of_course(auth.uid(), _filter_id)))
      OR (_filter_type = 'group' AND (public.is_student_in_group(auth.uid(), _filter_id)
         OR public.is_parent_of_group(auth.uid(), _filter_id)
         OR public.is_teacher_of_group(auth.uid(), _filter_id)))
      OR public.has_role(auth.uid(), 'admin'))
  LIMIT least(coalesce(_limit, 50), 100);
$$;
REVOKE ALL ON FUNCTION public.get_leaderboard(text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, uuid, integer) TO authenticated;
```
Se la classifica globale deve restare, mostrare solo nome e iniziale del cognome e non restituire `user_id`.

**Stato.** Confermato nel codice. Da provare sul sistema live con una chiamata anonima.

---

### M-01 — Consegna con voto e feedback falsi (Media)

**Descrizione.** La policy di INSERT su `homework_submissions` controlla solo che lo studente sia sé stesso e sia iscritto. Non limita le colonne: `grade`, `status`, `teacher_feedback`, `feedback_at`, `auto_score`, `file_url` sono scrivibili. Le RPC `submit_homework_code` / `submit_homework_file` fanno i controlli giusti, ma l'INSERT diretto le aggira.

**Scenario.** Uno studente, per un compito non ancora consegnato, invia `POST /rest/v1/homework_submissions` con `{"homework_id": "...", "student_id": "<sé>", "status": "approved", "grade": 100, "teacher_feedback": "Bravissimo!"}`. Il trigger `calculate_graded_homework_points` gli assegna i punti pieni.

**Impatto.** Voti e punti falsificati; il genitore vede un finto feedback dell'insegnante. Viola la regola di `AGENTS.md` sulle ricompense.

**Evidenza.** `supabase/migrations/20260624204034_…sql:75-82`: `WITH CHECK (auth.uid() = student_id AND public.is_enrolled_for_homework(auth.uid(), homework_id))`.

**Fix.** Il frontend usa già le RPC: basta togliere l'INSERT diretto.
```sql
DROP POLICY "Students can insert their submissions" ON public.homework_submissions;
```

**Stato.** Confermato.

---

### M-02 — Funzioni admin senza controllo 2FA (Media)

**Descrizione.** Nel database il ruolo admin vale solo con sessione `aal2` (`has_role` + `mfa_ok`). Le edge function usano la service role e devono ripetere il controllo: la maggior parte lo fa, queste no.

| Funzione | Riga del controllo ruolo | Cosa permette |
|---|---|---|
| `newsletter-send` | 57 | Email HTML libera a tutti gli iscritti |
| `send-welcome-email` | 61 | Email "ufficiale" a qualsiasi indirizzo, con link scelto dal chiamante |
| `blog-auto-publish` | 33 | Pubblicazione dei post programmati |
| `send-lesson-reminders` | 78 | Invio push a studenti e genitori |
| `send-payment-reminders` | 96 | Invio solleciti di pagamento |
| `indexnow-submit` | 42 | Invio URL a IndexNow |
| `sync-lead-to-notion` | 144 | Lettura lead CRM e invio a Notion |
| `quote-genie-create-client` | 75 | Lettura lead e invio a Quote Genie |

**Scenario.** L'attaccante conosce la password di un admin (phishing, riuso). Fa login senza secondo fattore (sessione `aal1`) e chiama `newsletter-send` con un contenuto di phishing: parte da `techlanditalia.it` verso tutti gli iscritti.

**Impatto.** La 2FA degli admin non protegge queste azioni. Phishing credibile verso famiglie; esposizione dei lead CRM.

**Fix.** Aggiungere dopo il controllo del ruolo, come in `admin-toggle-role`:
```ts
import { decodeClaims, mfaRequiredResponse } from "../_shared/mfa.ts";
if (decodeClaims(token).aal !== "aal2") return mfaRequiredResponse(corsHeaders);
```
Meglio ancora: un helper condiviso `requireAdmin(req)` in `_shared` che faccia token + ruolo + `aal2`, così nessuna funzione nuova lo dimentica.

**Stato.** Confermato.

---

### M-03 — Blocco login per email: abusabile e aggirabile (Media)

**Descrizione.**
- Il blocco conta i tentativi falliti per email (5 in 15 minuti; 10 per gli studenti), non per IP.
- `student-login` non ha alcun limite per IP.
- Il conteggio esiste solo dentro `student-login`: l'endpoint standard di Supabase Auth (`/auth/v1/token?grant_type=password`) è raggiungibile con la chiave pubblica e non scrive in `login_attempts`.

**Scenari.**
1. *Blocco di un account altrui:* 5 richieste con password sbagliata per l'email di un genitore (10 per lo username di uno studente) e la vittima resta fuori 15 minuti; ripetibile all'infinito.
2. *Password spraying:* una password comune provata su molti username, senza limite per IP.
3. *Aggiramento:* tentativi diretti su Supabase Auth, soggetti solo ai limiti predefiniti di Supabase.

**Impatto.** Negazione del servizio mirata; forza bruta meno ostacolata del previsto. Gli admin restano protetti dalla 2FA.

**Fix.** Aggiungere in `student-login` un limite per IP (`rateLimit` con `clientIp`, es. 20 tentativi/15 min) e uno per username inesistente. Nel progetto Supabase attivare CAPTCHA su Auth e verificare i rate limit di Auth.

**Stato.** Scenari 1 e 2 confermati nel codice. Scenario 3 da verificare sulla configurazione Auth live.

---

### M-04 — `consume_streak_freeze` agisce su qualsiasi studente (Media)

**Descrizione.** La funzione interna `consume_streak_freeze(_student_id, …)` è `SECURITY DEFINER`, non controlla chi chiama ed è concessa ad `authenticated`. La versione corretta è `use_my_streak_freeze`, che verifica studente/genitore/admin.

**Scenario.** Un utente autenticato chiama `rpc/consume_streak_freeze` con l'ID di un altro studente (ottenibile da A-01) quattro volte: consuma i due "congelamenti" mensili per tipo della vittima e scrive righe con testo libero in `reason`.

**Impatto.** Danneggia la serie di un altro bambino; dati spuri visibili a studente e genitore.

**Evidenza.** `supabase/migrations/20260629225042_…sql:35-71` (nessun controllo su `auth.uid()`), riga 74 (`GRANT … TO authenticated`).

**Fix.**
```sql
REVOKE ALL ON FUNCTION public.consume_streak_freeze(uuid, text, text, boolean, uuid, integer)
  FROM PUBLIC, anon, authenticated;
```
`use_my_streak_freeze` e i trigger continuano a funzionare perché girano come proprietario.

**Stato.** Confermato.

---

### M-05 — Codici attestato corti ed enumerabili (Media)

**Descrizione.** Il codice è `TL-<anno>-` più 5 caratteri su 32 simboli (circa 33,5 milioni di combinazioni), generati con `random()`. `verify_certificate` è pubblica per scelta e non ha limiti di frequenza.

**Scenario.** Uno script prova i codici in sequenza su `rpc/verify_certificate`. Con qualche centinaio di attestati l'anno, trova un codice valido ogni poche decine di migliaia di tentativi.

**Impatto.** Per gli attestati condivisi: nome completo dello studente, corso, insegnante e competenze. Per gli altri: iniziali, corso e data. Coinvolge dati di minori.

**Fix.** Allungare il codice per i nuovi attestati (almeno 10 caratteri, generati con `gen_random_bytes`) e far passare la verifica da una edge function con `rateLimit` per IP, revocando l'esecuzione diretta ad `anon`.

**Stato.** Confermato.

---

### M-06 — Iframe del codice studente con stessa origine del sito (Media)

**Descrizione.** L'anteprima del compilatore web carica HTML/JS da un URL `blob:` in un iframe con `sandbox="allow-scripts allow-same-origin …"`. Un `blob:` creato dalla pagina ha la stessa origine del sito, quindi lo script può leggere `localStorage` (token di sessione Supabase) e il DOM della pagina.

**Scenario.**
1. Uno studente incolla nel compilatore codice trovato online ("trucco per avere più punti"): lo script legge il token e lo invia a un server esterno (la CSP consente `connect-src https:`).
2. In `TeacherHomeworkView.tsx` gira il codice di partenza del compito nella sessione dell'insegnante: un contenuto compromesso ne ruba la sessione `aal2`.

Le consegne degli studenti, invece, sono mostrate all'insegnante come testo (`CodeViewer`): lì il codice non viene eseguito.

**Impatto.** Furto della sessione di chi esegue il codice (studente, insegnante, admin in anteprima).

**Fix.** Togliere `allow-same-origin` dai quattro iframe: lo script gira in un'origine isolata. Se il codice degli studenti deve usare `localStorage`, servire l'anteprima da un dominio separato.

**Stato.** Confermato.

---

### M-07 — Consenso OAuth: token utente a client terzi (Media, da verificare)

**Descrizione.** Il progetto espone il server OAuth di Supabase (pagina `OAuthConsent.tsx`, usato dalla funzione `mcp`). Un client che ottiene il consenso riceve un token con audience `authenticated` per l'utente.

**Scenario.** Se la registrazione dinamica dei client è aperta, un attaccante registra "Assistente TechLand", manda il link di autorizzazione a un genitore e, dopo il clic su "Consenti", usa il token contro l'API con i permessi del genitore (dati dei figli).

**Impatto.** Accesso ai dati dei figli con un solo clic di consenso. Coinvolge dati di minori.

**Cosa verificare.** In Supabase Auth: se la registrazione dinamica è attiva, quali client esistono, durata e scope dei token. Se serve solo l'MCP pubblico in sola lettura, valutare di toglierne l'autenticazione utente: gli strumenti leggono solo corsi e blog pubblici.

**Stato.** Da verificare.

---

### M-08 — Validazione upload solo consultiva (Media)

**Descrizione.** `validate-file-upload` riceve nome, tipo e primi byte dichiarati dal client e risponde "valido": non carica né blocca nulla. Il file arriva poi direttamente allo storage. Il bucket `homework-files` non ha `file_size_limit` né `allowed_mime_types`; la policy chiede solo di scrivere nella propria cartella.

**Scenario.** Un qualsiasi utente autenticato carica in `homework-files/<proprio id>/` file di qualunque tipo e dimensione, senza chiamare la validazione.

**Impatto.** Consumo di spazio, file eseguibili consegnati all'insegnante. Il bucket è privato, quindi non c'è hosting pubblico.

**Fix.**
```sql
UPDATE storage.buckets
SET file_size_limit = 20971520,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/webp','application/pdf',
      'text/plain','application/zip','application/x-zip-compressed','video/mp4','video/webm',
      'audio/mpeg','audio/wav','application/octet-stream']
WHERE id = 'homework-files';
```
Aggiungere alla policy di INSERT la condizione che l'utente abbia almeno un'iscrizione attiva.

**Stato.** Confermato.

---

### Problemi di gravità bassa

**B-01 — Ticket Jira senza limiti.** `create-jira-ticket` accetta qualsiasi utente autenticato, senza rate limit né lunghezza massima di titolo e descrizione. Fix: `rateLimit` per utente (es. 5/ora), `zod` con lunghezze massime.

**B-02 — `complete_lesson` senza gruppo.** Se lo studente è iscritto ma non è in un gruppo, il controllo sulla data viene saltato: può completare subito tutte le lezioni, ottenere i punti e far scalare il saldo lezioni. Inoltre il gruppo è scelto con `LIMIT 1` senza escludere quelli archiviati, e la data è `CURRENT_DATE` (UTC) invece di Europe/Rome come chiede `AGENTS.md`. Stesso schema in `complete_task`. Fix: rifiutare se non c'è un gruppo attivo; usare `(now() AT TIME ZONE 'Europe/Rome')::date`.

**B-03 — Login figlio con la password del genitore.** Per gli account "legacy" lo username del figlio accetta la password del genitore, con blocco contato sull'account del figlio (10 tentativi). È un secondo punto d'ingresso per indovinare la password del genitore. Fix: fissare una data di fine del periodo legacy e forzare l'impostazione della password del figlio.

**B-04 — Funzioni di supporto chiamabili senza login.** `get_children_ids`, `is_parent_of*`, `is_enrolled_*`, `is_teacher_of*`, `is_student_in_group`, `check_login_rate_limit`, `is_email_blocked` sono `SECURITY DEFINER` senza revoca. Chi conosce un ID può scoprire legami genitore-figlio, iscrizioni, o se un'email è bloccata. Fix: `REVOKE … FROM PUBLIC, anon` su tutte; `check_login_rate_limit` e `is_email_blocked` solo a `service_role`. Nota: diverse migrazioni revocano solo da `PUBLIC`; su Supabase `anon` ha un grant esplicito, quindi va nominato.

**B-05 — Bucket pubblici residui.** `web-compiler-assets` e `homework-attachments` sono creati pubblici e nessuna migrazione li rende privati. Da verificare se `web-compiler-assets` contiene ancora file caricati dagli studenti prima della migrazione 0055.

**B-06 — Wildcard `*.lovable.app`.** `cors.ts:29` e `familyaccounts.ts:39` accettano qualsiasi sottodominio `lovable.app`, dove chiunque può pubblicare. L'impatto è limitato perché la sessione non è nei cookie. `send-password-reset-email` usa già la lista esatta: allineare gli altri due.

**B-07 — Turnstile e rate limit "fail-open".** Senza `TURNSTILE_ENFORCE=true` i token mancanti passano; se Cloudflare o la RPC del limiter danno errore, la richiesta passa. Fix: attivare l'enforcement; per login e reset password far fallire la richiesta se il limiter è in errore.

**B-08 — Dati personali nei log.** Email e username scritti con `console.log` in `send-password-reset-email:49`, `student-login:74`, `admin-create-user:102`, `send-booking-notification:28`. Fix: rimuoverli o mascherarli.

**B-09 — Enumerazione.** `newsletter-subscribe:94` risponde "Sei già iscritto"; `check-login-attempts` dice a chiunque se un'email è bloccata e quanti errori ha. Fix: risposta uniforme; rate limit su `check`.

**B-10 — Azioni sensibili senza riconferma.** `admin-toggle-role` e `admin-set-password` non chiedono un codice TOTP recente (come fa `admin-reset-mfa`) e non scrivono in `admin_access_logs`; si può rimuovere l'ultimo admin. `delete-my-account` non chiede di nuovo la password. Fix: `hasRecentAuth(claims, ["totp"], 300)`, riga di log, blocco sulla rimozione dell'ultimo admin.

**B-11 — `create-child-account`.** Nessun limite al numero di figli; lo username non è validato (può contenere `@`, che `student-login` tratta come email); se l'aggiornamento del profilo fallisce resta un account senza genitore. Fix: `rateLimit`, regex sullo username, eliminare l'utente in caso di errore.

**B-12 — Dipendenze.** `npm audit --omit=dev`: 10 alte, 11 moderate. Quelle che toccano il sito in produzione: `react-router-dom` (open redirect), `zod` (esaurimento memoria), `firebase`. `vite` ed `esbuild` riguardano solo lo sviluppo. Fix: `npm audit fix`, poi aggiornare `react-router-dom`, `zod`, `@lovable.dev/mcp-js`.

**B-13 — Proposta commerciale accettata dal minore.** `course-proposal:259`: "respond" è consentito anche allo studente. Fix: limitare a genitori e tutori.

**B-14 — Header di sicurezza.** `public/_headers` dichiara che l'hosting ignora il file: HSTS, `X-Content-Type-Options` e `Permissions-Policy` non arrivano come header. La CSP in `index.html` consente `'unsafe-inline'`, `'unsafe-eval'` e qualsiasi `https:`, quindi non ferma l'esfiltrazione (aggrava M-06). Fix: restringere `connect-src` e `script-src` ai domini usati; valutare un hosting o un proxy che applichi gli header.

### Note informative

**I-01 — `.env` tracciato da git.** Contiene solo chiavi pubbliche (chiave `anon`, DSN Sentry, chiavi web Firebase, ID Analytics); la cronologia ha un solo commit. Nessun segreto esposto. Conviene comunque `git rm --cached .env` per evitare che in futuro vi finisca un segreto.

**I-02 — Registrazione pubblica.** Il client espone `signUp` (`src/hooks/useAuth.tsx:150`). Se la registrazione è aperta, chiunque ottiene un account "studente" senza iscrizioni, che può comunque usare M-04, M-08 e B-01. Da verificare nelle impostazioni Auth.

**I-03 — Versioni non fissate.** Le edge function importano `https://esm.sh/@supabase/supabase-js@2` (versione mobile); i workflow usano action per tag (`@v4`). I workflow non usano segreti e girano solo su `pull_request`.

**I-04 — Client service-role riusato per il login.** In `student-login` lo stesso client fa `signInWithPassword` e poi scrive sul database: dopo il login le scritture potrebbero partire con il token dell'utente e fallire in silenzio per la RLS (registrazione del tentativo riuscito, `student_password_settings`). Fix: usare un client separato con chiave `anon` per il login. Da verificare.

## 4. Cose fatte bene

- **RLS ovunque:** tutte le 95 tabelle hanno la RLS attiva; le tabelle solo-backend non hanno policy o hanno `REVOKE` esplicito.
- **Ruoli:** `user_roles` non è scrivibile dai client; `has_role` richiede `aal2` per chi verifica il proprio ruolo; i trigger su `profiles` bloccano la modifica di ruolo, genitore, saldo lezioni, punti, email e username.
- **2FA:** policy restrittiva `mfa_required` applicata a tutte le tabelle; reset 2FA solo con approvazione di un admin e codice TOTP recente; il recupero self-service non rimuove la 2FA.
- **Funzioni `admin-*`:** ruolo letto dal database a partire dal token, mai dal body; `aal2` verificato.
- **Accesso tra utenti:** genitori, insegnanti e studenti passano da funzioni dedicate (`is_parent_of`, `is_teacher_of_student_in_course`, …) e sono coperti dai test RLS in CI.
- **Cron:** token per singolo job verificati lato database, lunghezza minima 32 caratteri.
- **Redirect:** liste esatte per reset password e checkout Stripe; `?next=` accetta solo percorsi interni.
- **Pagamenti:** il prezzo lo decide Stripe tramite `priceId`, quantità fissa a 1.
- **HTML:** contenuti di blog, compiti e glossario passano da DOMPurify; gli embed sono limitati a una lista di domini; le email dei moduli pubblici fanno l'escape dei dati.
- **Chat pubblica:** limiti per IP e tetto giornaliero globale, cronologia presa dal server, Turnstile.
- **Password figli:** nessuna password in chiaro; password casuale alla creazione; password trovate in fughe di dati rifiutate.

## 5. Limiti dell'audit

Non verificabile con la sola analisi statica:

- **Stato reale del database:** l'analisi usa le migrazioni; `00_drift.sql` documenta che in produzione ci sono modifiche fuori repo. Policy, grant e bucket vanno confrontati con il database live (advisor di sicurezza Supabase).
- **Bucket creati fuori dalle migrazioni:** `roblox-lesson-material`, `python-lesson-material` e simili hanno policy ma non una creazione nel repo; non si sa se sono pubblici.
- **Configurazione Auth:** registrazione aperta, CAPTCHA, rate limit, password minima, server OAuth (M-03, M-07, I-02).
- **Segreti delle edge function** e loro rotazione.
- **Header effettivi** serviti dall'hosting.
- **Edge function lette solo in parte:** per `admin-email-center`, `admin-send-push`, `admin-import-students`, `data-retention`, `satisfaction-survey`, `certificates-released`, `google-calendar*`, `monthly-report`, `student-risk-check`, `subscription-pause-check`, `school-closure-notice`, `cron-health-check`, `purge-deleted-accounts`, `submit-booking`, `send-contact-email`, `submit-job-application` è stato verificato lo schema di autenticazione (token, ruolo, `aal2`, token cron, rate limit), non tutta la logica.
- **Pagine admin del frontend:** non esaminate una per una; la protezione reale è nel database.

Da provare sul sistema live, in ordine: chiamata anonima a `get_leaderboard` (A-01); INSERT diretto di una consegna con un account studente di prova (M-01); `newsletter-send` con sessione admin `aal1` in ambiente di test (M-02); login diretto su Supabase Auth oltre il limite (M-03).
