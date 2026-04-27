## Obiettivo

Trasformare `/admin/bookings` in un CRM completo che unifica i lead da `trial_bookings`, `contact_submissions`, `newsletter_subscribers` e i clienti già iscritti (`profiles` con ruolo parent/student), con pipeline, comunicazioni, analytics e integrazione push verso Quote Genie.

## Risposta diretta alle tue domande

1. **Dove costruirlo:** lo integro nel pannello prenotazioni esistente (`/admin/bookings` → rinominato in `/admin/crm` con redirect dal vecchio path). Mantieni il flusso attuale, ottieni un CRM completo.
2. **Quote Genie:** sì serve modificare anche l'altro progetto (è un'app separata). Approccio scelto: **API condivisa**. Una edge function su Quote Genie riceve i dati cliente, li crea/aggiorna, restituisce l'URL del cliente. Su TECHLAND il bottone "Crea preventivo" chiama questa API e apre direttamente la pagina cliente già pronta. Vantaggi: nessun dato in URL leggibile, tracciabilità, niente duplicati.

## Architettura

```text
┌─────────────────────── TECHLAND CRM ───────────────────────┐
│  Vista unificata "Lead & Clienti"                           │
│  ├─ trial_bookings        → lead trial                      │
│  ├─ contact_submissions   → lead contatto                   │
│  ├─ newsletter_subscribers→ lead newsletter                 │
│  └─ profiles (parent/stud)→ clienti attivi                  │
│                                                             │
│  Per ogni record:                                           │
│  ├─ Pipeline (stato), tag, note, follow-up, assegnatario    │
│  ├─ Timeline interazioni (email/whatsapp/call/note)         │
│  └─ Bottone "Crea Preventivo" → POST a Quote Genie          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ HTTPS + API key
┌────────────────── QUOTE GENIE (altro progetto) ────────────┐
│  Edge function `crm-import-client`                          │
│  ├─ Verifica API key (header X-CRM-Key)                     │
│  ├─ Upsert cliente (match per email)                        │
│  └─ Restituisce { client_id, redirect_url }                 │
└─────────────────────────────────────────────────────────────┘
```

## Modifiche database (TECHLAND)

**Nuova tabella `crm_leads`** — record unificato, una riga per "persona" (matching per email). Generata via trigger quando arrivano nuovi `trial_bookings`/`contact_submissions`/`newsletter_subscribers`, oppure collegata a `profiles.id`:
- `id`, `email` (unique), `full_name`, `phone`, `source` (trial/contact/newsletter/registered)
- `pipeline_stage` (enum: `new`, `contacted`, `qualified`, `proposal_sent`, `won`, `lost`, `nurture`)
- `assigned_to` (uuid → profiles admin), `tags` (text[]), `lead_score` (int), `lifetime_value_cents` (int)
- `next_followup_at`, `last_contacted_at`, `notes` (text)
- `linked_profile_id` (nullable → profiles), `quote_genie_client_id` (text, nullable)
- `created_at`, `updated_at`
- RLS: solo admin manage.

**Nuova tabella `crm_interactions`** — timeline:
- `id`, `lead_id` → `crm_leads`, `admin_id`
- `type` (`email`, `whatsapp`, `call`, `note`, `quote_sent`, `meeting`, `status_change`)
- `subject`, `content`, `metadata` (jsonb), `created_at`
- RLS: solo admin.

**Nuova tabella `crm_tags`** — gestione centralizzata tag con colore.

**Trigger:** funzione `sync_lead_from_source()` che alla insert su `trial_bookings`/`contact_submissions`/`newsletter_subscribers` fa upsert in `crm_leads` matching per email. Funzione anche per collegare i `profiles` esistenti (one-shot backfill in migration).

## UI nuovo `/admin/crm` (sostituisce AdminBookings)

**Layout a tab interni:**
- **Tab 1 — Pipeline (Kanban):** colonne per stage, drag & drop card lead, contatore per colonna.
- **Tab 2 — Lista (tabella):** filtri (sorgente, stage, tag, assegnatario, data, follow-up scaduti), ricerca full-text, ordinamento, export CSV, selezione multipla per azioni bulk (cambio stato, assegnazione, tag).
- **Tab 3 — Analytics:** funnel di conversione (lead → contattato → preventivo → vinto), tasso conversione per sorgente, lead per origine, tempo medio in pipeline, LTV totale clienti collegati.
- **Tab 4 — Calendario:** follow-up programmati e scadenze.

**Drawer/Dialog dettaglio lead** (cliccando una card):
- Header: nome, email, telefono, badge sorgente, badge stage, score
- Sezione "Dati lead": età alunno, interesse corso, messaggio originale, data prima richiesta
- Sezione "Pipeline": dropdown stage, tag editabili, assegnazione admin, follow-up date picker, note libere
- Sezione "Timeline interazioni": elenco cronologico con icone per tipo, form inline per loggare nuova interazione (email/whatsapp/call/note/meeting)
- Sezione "Profilo collegato": se `linked_profile_id` mostra link al profilo studente/genitore, lesson_balance, corsi attivi
- Bottoni azione rapida: 
  - **"Crea Preventivo"** → chiama edge function `quote-genie-create-client` (vedi sotto), apre nuova tab
  - "Invia email" (mailto pre-compilato)
  - "WhatsApp" (wa.me pre-compilato)
  - "Marca contattato" (cambio stage rapido)

## Integrazione Quote Genie (richiede modifiche a entrambi i progetti)

### Lato TECHLAND
1. Nuovo secret `QUOTE_GENIE_API_KEY` (lo generi tu, lo aggiungi a entrambi i progetti).
2. Edge function `quote-genie-create-client`:
   - Input: `{ lead_id }`
   - Recupera dati lead da `crm_leads`
   - POST a `https://preventivi.techlanditalia.it/functions/v1/crm-import-client` con header `X-CRM-Key: <secret>` e body `{ external_id: lead.id, full_name, email, phone, source: "techland_crm", metadata: { interest, child_age } }`
   - Salva risposta `client_id` in `crm_leads.quote_genie_client_id`
   - Logga interazione tipo `quote_sent` in `crm_interactions`
   - Restituisce `{ redirect_url }` al frontend
3. Frontend apre `redirect_url` in nuova tab.

### Lato Quote Genie (devo guidarti dopo, in chat)
Devi creare lì una edge function `crm-import-client` che:
- Verifica `X-CRM-Key` contro un secret
- Upsert nella tabella clienti per email (no duplicati)
- Restituisce `{ client_id, redirect_url: "https://preventivi.techlanditalia.it/clienti/<id>" }`

**Importante:** non posso modificare l'altro progetto da qui. Ti darò istruzioni passo-passo (o se vuoi puoi `@mentioned` Quote Genie e potrei leggerne il codice in cross-project per generare lo snippet pronto).

## File da creare/modificare

**Migrazioni SQL:**
- `crm_leads`, `crm_interactions`, `crm_tags` + enum `pipeline_stage` + RLS + trigger di sync + backfill iniziale

**Edge function:**
- `supabase/functions/quote-genie-create-client/index.ts`

**Frontend nuovo:**
- `src/pages/admin/AdminCRM.tsx` (sostituisce AdminBookings come entry point)
- `src/components/admin/crm/CRMKanbanBoard.tsx`
- `src/components/admin/crm/CRMLeadList.tsx`
- `src/components/admin/crm/CRMAnalytics.tsx`
- `src/components/admin/crm/CRMFollowupCalendar.tsx`
- `src/components/admin/crm/CRMLeadDetailDrawer.tsx`
- `src/components/admin/crm/CRMInteractionTimeline.tsx`
- `src/components/admin/crm/CRMQuoteButton.tsx`
- `src/hooks/useCRMLeads.ts`, `useCRMInteractions.ts`

**Frontend modifiche:**
- `src/App.tsx`: nuova route `/admin/crm`, mantieni `/admin/bookings` come redirect
- `src/components/admin/AdminNav.tsx`: voce "CRM" sostituisce "Prenotazioni"

## Cosa NON è incluso (eventuale fase 2)

- Email automatiche via sequenze nurturing (Avanzato)
- Lead score automatico ML-based
- Integrazione Stripe per LTV calcolato da pagamenti reali (al momento manuale)

## Prossimo step (quando approvi)

1. Implemento tutto il lato TECHLAND in un'unica iterazione.
2. Ti chiedo di generare un valore per `QUOTE_GENIE_API_KEY` e lo aggiungo come secret qui.
3. Ti fornisco lo snippet completo (SQL + edge function) da incollare su Quote Genie, oppure se mi dai accesso cross-project con `@quote-genie` lo applico io leggendo il codice esistente lì.
