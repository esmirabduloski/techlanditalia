# Export / Import JSON — estensione admin + storico automatico

## 1) Cosa conviene aggiungere a Export/Import JSON

Divido per "utilità reale" nel gestire la piattaforma. Per ognuno indico la tabella, la colonna di conflitto (per upsert idempotente) e le colonne da rimuovere all'import.

### Alta priorità (gestione contenuti didattici)
| Sezione admin | Tabella | Conflict | Strip on import | Perché serve |
|---|---|---|---|---|
| Lezioni | `lessons` | `id` (o coppia `course_id + lesson_number`) | `created_at, updated_at` | Duplicare contenuti tra corsi, backup pre-modifiche massive |
| Task lezione | `lesson_tasks` | `id` | `created_at, updated_at` | Riordinare/clonare esercizi, migrare da un corso all'altro |
| Compiti | `homework` | `id` | `created_at, updated_at` | Riutilizzare compiti tipo tra gruppi |
| Glossario | `glossary_terms` | `slug` | `created_at, updated_at` | Import massivo termini, backup |
| Landing pages | `landing_pages` | `slug` | `created_at, updated_at` | Duplicare landing SEO, versionare |
| FAQ / Site settings | `site_settings` | `key` | `updated_at` | Backup configurazioni home/SEO |
| Badge | `badges` | `id` | `created_at` | Clonare set di badge tra ambienti |

### Media priorità (CRM & marketing)
| Sezione | Tabella | Conflict | Note |
|---|---|---|---|
| Newsletter | `newsletter_subscribers` | `email` | Import lista esterna |
| Prenotazioni trial | `trial_bookings` | `id` | Solo export (archivio) |
| Contatti | `contact_submissions` | `id` | Solo export |
| Referral | `referrals` | `id` | Solo export (audit) |
| Blocked emails | `blocked_emails` | `pattern + type` | Import blocklist condivise |

### Bassa priorità / solo export (dati sensibili, non ha senso reimportare)
- `homework_submissions`, `lesson_progress`, `task_progress`, `group_attendance`, `lesson_reports` → solo **export** per backup/analisi. Import è pericoloso (invaliderebbe punti, streak, trigger).
- `admin_access_logs`, `security_events`, `login_attempts` → solo **export** per audit.
- `crm_interactions` → solo export (storia lead).

### Da NON esportare/importare via JSON
- `profiles`, `user_roles`, `enrollments`, `group_students` → già gestiti dal flusso "Utenti" con Edge Function dedicata (creano auth.users). Duplicarli qui rompe l'integrità.
- Tabelle `auth.*`, `storage.*` → mai.
- `analytics_events`, `page_views`, `conversion_funnels` → volumi enormi, non ha senso.

### Suggerimento UX
Nel pannello admin aggiungere una pagina unica **"Backup & Import"** (`/admin/backup`) con una tabella che elenca ogni entità e i suoi pulsanti Export/Import, invece di spargere i bottoni in ogni tab. Rimane comunque il bottone rapido nelle pagine principali.

---

## 2) Storico automatico degli export

### Dove salvarli
Non nella cartella `/dev-server` del repo (i file scritti non tornano in git dal runtime dell'app). L'unico posto veramente persistente e leggibile dall'admin è **Supabase Storage**, in un bucket privato dedicato: `backups-json/`.

Struttura proposta:
```
backups-json/
  2026/
    07/
      2026-07-24_blog_posts.json
      2026-07-24_courses.json
      2026-07-24_crm_leads.json
      ...
    08/
      ...
```
File uno per tabella, timestamp nel nome. Un file "manifest" giornaliero `2026-07-24_manifest.json` con conteggi/righe per verifica.

### Come generarli
Edge Function `backup-json-snapshot` (verify_jwt = false, protetta da secret header):
1. Legge la whitelist di tabelle da esportare.
2. Per ogni tabella fa `select *` (paginazione se > 10k righe).
3. Scrive su Storage al path `YYYY/MM/YYYY-MM-DD_<tabella>.json`.
4. Aggiorna `manifest.json` del giorno.

### Schedulazione
`pg_cron` giornaliero (es. 03:00 Europe/Rome) che chiama la function via `net.http_post`. Frequenza consigliata: **giornaliera** per contenuti "vivi" (blog, courses, crm_leads, landing_pages), **settimanale** per il resto.

### Retention / pulizia mensile
Job `pg_cron` mensile (1° del mese) che:
- Elenca gli oggetti in `backups-json/`.
- Mantiene: ultimi **90 giorni** completi + il **primo snapshot di ogni mese** dei 12 mesi precedenti (archivio storico).
- Cancella tutto il resto.

### Accesso admin
Nuova pagina `/admin/backups-json`: lista file per mese, download diretto tramite signed URL (bucket privato). Nessun dato mai pubblico.

---

## 3) Costi Lovable Cloud

**Sì, consuma un po' di Cloud usage (non crediti chat)**, ma quantità piccole:

- **Storage**: JSON compresso poco (testo). Stima con volumi attuali (~72 blog post, 10 profiles, poche centinaia di lead) → ogni snapshot giornaliero **< 5 MB**. In un mese: ~150 MB. Con retention proposta: sotto **~1 GB stabile**. Costo Storage Supabase: trascurabile rispetto al credito Cloud incluso ($25/mese).
- **Egress**: solo quando l'admin scarica un file. Marginale.
- **Compute Edge Function**: pochi secondi al giorno.
- **pg_cron**: gratuito.

**Non consuma crediti di messaggi Lovable AI** (nessuna chiamata a modelli).

Verdict: **rientra abbondantemente nei $25 gratuiti mensili di Cloud** finché il DB non cresce di 10-20×. Se in futuro si vuole ridurre a zero, si può ospitare i backup su un bucket esterno (S3/R2), ma non è necessario oggi.

---

## 4) Fasi di implementazione proposte

**Fase A — Estensione UI Import/Export** (piccola)
- Aggiungere il componente `JsonImportExport` a: Lezioni, Task, Compiti, Glossario, Landing Pages, Site Settings, Badge, Newsletter, Blocked emails.
- Solo export per: prenotazioni, contatti, referral, submission/progress, log admin.

**Fase B — Backup automatico su Storage** (media)
- Creare bucket privato `backups-json`.
- Edge Function `backup-json-snapshot` con whitelist tabelle e paginazione.
- Cron giornaliero + manifest.
- Pagina admin `/admin/backups-json` con lista/download via signed URL.

**Fase C — Retention & pulizia mensile** (piccola)
- Edge Function `backup-json-cleanup` che applica la policy 90 giorni + 1/mese storico.
- Cron mensile.
- Bottone manuale "Esegui pulizia ora" in `/admin/backups-json`.

Confermi che procedo con Fase A + B + C, oppure vuoi partire solo dalla A?
