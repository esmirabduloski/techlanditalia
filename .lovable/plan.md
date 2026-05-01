# Piano: Miglioramenti Sicurezza & Qualità (Blocco 1-15)

In base alle tue scelte:
- ❌ **#2** (rate limit) → sostituito con **honeypot avanzato + blocklist email** (#2-bis)
- ❌ **#3** (CAPTCHA esterno) → sostituito con **honeypot + validazione domini email usa-e-getta** (incluso in #2-bis)
- ❌ **#7** (2FA) → saltato per ora
- ❌ **#12** (backup esterni) → saltato per ora

Restano **11 implementazioni** + 2 sostituzioni unite = lavoro su 11 aree.

---

## 1. HIBP — Have I Been Pwned (Password compromesse)

Abilito il controllo automatico di Supabase Auth che blocca password già trapelate sul web durante signup e cambio password.

**Tecnico:** chiamata a `configure_auth({ password_hibp_enabled: true })`.

---

## 2-bis. Anti-spam form pubblici (sostituisce #2 e #3)

Aggiungo a `submit-booking`, `send-contact-email`, `newsletter-subscribe`:

- **Honeypot field** invisibile (`website` / `company_url`) — se compilato → silent reject
- **Time-trap**: form aperto da meno di 2 secondi → reject (i bot compilano subito)
- **Blocklist domini email usa-e-getta** (mailinator, tempmail, guerrillamail, 10minutemail + ~50 domini)
- **Tabella `blocked_emails`** per blocklist manuale gestibile da admin
- Rimuovo l'in-memory rate limit attuale di `submit-booking` (inefficace, già criticato)

**Tecnico:** nuova tabella `blocked_emails`, helper Deno `isBlockedEmail()` condiviso (copy-pasted nelle 3 functions perché Deno non condivide moduli locali).

---

## 4. Audit RLS tabelle CRM/Analytics

Controllo tutte le policy su `crm_leads`, `crm_interactions`, `analytics_events`, `page_views`, `crm_lead_attachments` e verifico che:
- SELECT/INSERT/UPDATE/DELETE accessibili **solo agli admin** (via `has_role(auth.uid(),'admin')`)
- Nessun `USING (true)` permissivo
- Nessuna esposizione anonima

Se trovo lacune → migration con policy corrette. Se tutto ok → nota nel security memory.

---

## 5. Content Security Policy (CSP) e security headers

Aggiungo a `public/_headers`:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.stripe.com https://*.trustpilot.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co https://api.stripe.com wss://*.supabase.co https://connector-gateway.lovable.dev; frame-src https://*.stripe.com https://*.youtube.com https://docs.google.com https://replit.com; object-src 'none'; base-uri 'self';
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**Note:** `unsafe-inline`/`unsafe-eval` necessari per Vite e Tiptap. Soluzione conservativa per non rompere il sito; un eventuale tighten verrà fatto in seguito.

---

## 6. Sanitizzazione HTML server-side per blog

Aggiungo a `BlogEditor.tsx` (e/o relativa edge function di pubblicazione) un sanitizer Deno (`isomorphic-dompurify` via esm.sh) che ripulisce il content **prima** del salvataggio in DB. Rimane DOMPurify lato client come doppia protezione.

**Tecnico:** il blog usa già DOMPurify in `BlogArticle.tsx`. Aggiungo sanitizzazione anche al momento dell'INSERT/UPDATE (lato client su `BlogEditor.tsx`, dove l'admin scrive). Whitelist allineata a quella esistente.

---

## 8. Log accessi admin

Nuova tabella `admin_access_logs`:
```
id, admin_id, action ('login'|'view_page'|'data_export'|'sensitive_action'),
ip_address, user_agent, path, created_at, metadata jsonb
```
- RLS: solo admin può leggere
- Insert via hook `useAdminAccessLog` chiamato in `AdminLayout`/route admin
- Pagina admin `/admin/access-logs` con tabella filtri (data, admin, azione)
- Aggiungo voce nel menu Admin

---

## 9. Rotazione API key (info-only)

**Solo documentazione**: aggiungo sezione in `/admin/documentazione` che ricorda di ruotare ogni 90 giorni:
- `STRIPE_SECRET_KEY` (Stripe Dashboard)
- `RESEND_API_KEY` (Resend Dashboard)
- `JIRA_API_TOKEN` (Atlassian)
- `QUOTE_GENIE_API_KEY` (progetto Quote Genie)

Con istruzioni step-by-step e checkbox "ultima rotazione".

---

## 10. Validazione Zod server-side completa

Refactor delle edge functions principali per usare **Zod** (`https://esm.sh/zod@3`) invece di validazione manuale:

- `submit-booking` ✓ ha già validazione manuale → migro a Zod
- `send-contact-email` ✓ ha già validazione manuale → migro a Zod
- `newsletter-subscribe` ✓ → Zod
- `create-jira-ticket` → da verificare/aggiungere
- `quote-genie-create-client` → da verificare/aggiungere
- `admin-create-user`, `admin-set-password`, `admin-toggle-role` → Zod + verifica `has_role(auth.uid(),'admin')` se mancante

Schema unificati e messaggi di errore consistenti.

---

## 11. Security headers

Coperto in **#5** (HSTS, X-Frame-Options, X-Content-Type-Options + Referrer-Policy, Permissions-Policy).

---

## 13. Honeypot fields nei form

Coperto in **#2-bis**.

---

## 14. Limite tentativi login

**Implementazione client-side + DB** (visto che il backend non ha rate limit nativo):

- Tabella `login_attempts (email, ip, attempted_at, success)`
- Edge function `check-login-attempts` chiamata prima del `signInWithPassword`
- Se >5 tentativi falliti negli ultimi 15min per quella email → blocco lato UI con messaggio "Account temporaneamente bloccato, riprova tra X minuti"
- Reset automatico al login riuscito
- Cleanup cron-like (su INSERT, cancello record > 1h)

**Limite noto:** un attaccante può bypassare chiamando direttamente l'API Supabase Auth. Documentato. Per protezione vera serve infrastruttura dedicata.

---

## 15. Pulizia automatica log sensibili (>30gg)

Funzione SQL `cleanup_old_logs()` schedulata via `pg_cron`:
```sql
DELETE FROM analytics_events WHERE created_at < now() - interval '30 days';
DELETE FROM page_views WHERE created_at < now() - interval '30 days';
DELETE FROM admin_access_logs WHERE created_at < now() - interval '90 days';
DELETE FROM login_attempts WHERE attempted_at < now() - interval '7 days';
```
Schedulata ogni notte alle 3:00.

**Verifico prima** che `pg_cron` sia abilitato; altrimenti uso una edge function chiamata manualmente o tramite Lovable Cloud cron.

---

## 📋 Indici DB extra (bonus, già emerso dall'analisi)

Aggiungo indici mancanti su tabelle dei form:
```sql
CREATE INDEX IF NOT EXISTS idx_trial_bookings_email_created ON trial_bookings(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email_created ON contact_submissions(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_access_logs_admin_date ON admin_access_logs(admin_id, created_at DESC);
```

---

## 🗂 Ordine di esecuzione

1. **Migration unica DB**: `blocked_emails`, `admin_access_logs`, `login_attempts`, indici, funzione `cleanup_old_logs()`, audit RLS, eventuale `pg_cron`
2. **HIBP** via configure_auth (#1)
3. Edge functions: anti-spam + Zod (#2-bis, #10)
4. `public/_headers` con CSP + security headers (#5, #11)
5. Sanitizzazione blog server-side (#6)
6. Pagina admin access logs + hook (#8)
7. Rate limit login client-side (#14)
8. Sezione documentazione rotazione chiavi (#9)
9. Aggiorno `mem://security/audit-findings-and-rationale` con le decisioni

## ⏱ Stima
~30-45 minuti di esecuzione, una migration DB principale e ~10 file modificati/creati.

Confermi e procedo?
