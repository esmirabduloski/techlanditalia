
# Piano: Protezione da attacchi, scraping e bot

Obiettivo: ridurre la superficie d'attacco contro hacker, data scraping non autorizzato, bot e crawler aggressivi. Tutto applicato lato edge function + frontend, senza rompere SEO (Google/Bing restano ammessi).

## 1. Rate limiting sulle edge functions sensibili
Aggiungere una tabella `rate_limits` (ip + endpoint + window) con una funzione `check_rate_limit(_ip, _endpoint, _max, _window_seconds)` SECURITY DEFINER. Applicarla a:
- `submit-trial-booking` (max 3/ora per IP)
- `submit-contact-form` (max 5/ora per IP)
- `newsletter-subscribe` (max 5/giorno per IP)
- `ai-chat-support` (max 30/ora per IP/utente)
- `send-*` email functions (max 10/ora)
- login endpoint (già esistente `check_login_rate_limit`, estendere anche per IP non solo email)

Risposta 429 con `Retry-After` quando superato.

## 2. Honeypot + validazione anti-bot nei form pubblici
Aggiungere campo nascosto `website` (honeypot) a:
- TrialBookingForm
- ContactForm
- NewsletterForm

Se compilato → scarta silenziosamente la submission lato edge function (i bot riempiono tutti i campi).

Aggiungere anche un timestamp di apertura form: se submit < 2 secondi dal mount → bot.

## 3. Anti-scraping su endpoint dati pubblici
Per le edge function che restituiscono cataloghi/blog/corsi in JSON:
- Verifica `User-Agent` (blocca UA vuoti o sospetti come `python-requests`, `curl`, `scrapy`, `httpclient`)
- Whitelist solo bot SEO legittimi (Googlebot, Bingbot, DuckDuckBot) verso route HTML/MD; blocca gli altri sui dati JSON sensibili
- Aggiungi cache header e limite di paginazione massima (es. max 50 risultati per richiesta)

## 4. robots.txt rinforzato
Aggiornare `public/robots.txt`:
- `Allow` esplicito a Googlebot, Bingbot, DuckDuckBot, Applebot
- `Disallow: /` per scraper noti aggressivi (GPTBot, CCBot, ClaudeBot, anthropic-ai, Bytespider, PerplexityBot, Amazonbot) — opzionale, chiedo conferma
- Mantenere `/llms.txt` e mirror MD accessibili

## 5. Headers di sicurezza HTTP
Aggiungere meta/header in `index.html` e nelle risposte edge function:
- `Content-Security-Policy` (whitelist domini)
- `X-Frame-Options: DENY` (anti clickjacking)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (disabilita camera/mic non usati)

## 6. Audit log accessi sospetti
Tabella `security_events` (ip, event_type, metadata, created_at) per tracciare:
- Tentativi rate-limit superati
- Honeypot triggerati
- Login falliti ripetuti
- Accessi admin (già esistente `admin_access_logs`)

Visibili in una pagina admin `/admin/security`.

## 7. CAPTCHA invisibile (opzionale, da confermare)
Aggiungere hCaptcha o Turnstile (Cloudflare, gratuito) sui form pubblici critici (trial booking, contact, signup). Richiede una secret e una connection — chiedo se procedere.

## 8. Protezione dati lato DB
- Verificare che nessuna view pubblica esponga email/telefono di utenti (audit RLS già fatto, ricontrollare `crm_leads`, `trial_bookings`, `profiles`)
- Aggiungere mascheramento email/telefono nei log e nelle risposte non-admin

---

## Domande prima di procedere

1. **CAPTCHA**: vuoi che integri Cloudflare Turnstile (gratis, invisibile) sui form pubblici? Richiede una sitekey + secret.
2. **Bot AI** (GPTBot, ClaudeBot, PerplexityBot, CCBot): bloccarli da `robots.txt` o lasciarli passare? Bloccarli = i tuoi contenuti non finiranno nei training LLM, ma perdi visibilità nei chatbot AI.
3. **Headers CSP strict**: alcuni script terzi (Trustpilot, Resend tracking, Stripe) richiedono whitelist precise. Confermi che posso configurarli per i domini che già usate?

Dimmi come preferisci su questi tre punti e procedo con l'implementazione.
