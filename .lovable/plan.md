# Sync CRM → Notion (push one-way)

Il sito resta la **fonte di verità**. Ogni modifica ai lead viene replicata automaticamente su un database Notion che hai già preparato. Costo Cloud stimato: **~$0.02/mese** (praticamente zero).

## Cosa serve da te prima di partire (build)

1. **ID del database Notion** dei lead (lo trovi nell'URL: `notion.so/.../<DATABASE_ID>?v=...`).
2. **Condividere il database** con il connettore Notion durante la procedura di collegamento (la finestra OAuth ti chiederà quali pagine/database autorizzare — seleziona quello dei lead).
3. **Mapping colonne**: confermarmi che il tuo DB Notion abbia (o crei) queste proprietà. I nomi possono cambiare — basta che me li dici:

| Campo CRM (sito) | Tipo Notion suggerito | Nome colonna Notion (default) |
|---|---|---|
| `email` | Email | Email |
| `full_name` | Title | Nome |
| `phone` | Phone | Telefono |
| `pipeline_stage` | Select | Stage |
| `source` | Select | Origine |
| `lead_score` | Number | Score |
| `lifetime_value_cents` | Number (€) | LTV |
| `tags` | Multi-select | Tag |
| `next_followup_at` | Date | Prossimo follow-up |
| `last_contacted_at` | Date | Ultimo contatto |
| `child_age` | Number | Età alunno |
| `interest` | Rich text | Interesse |
| `notes` | Rich text | Note |
| `original_message` | Rich text | Messaggio originale |
| `created_at` | Date | Creato il |
| *(nuovo)* `notion_page_id` | — | (salvato sul sito, non su Notion) |

## Cosa farò io (passi tecnici)

### 1. DB: aggiungere campo di link
Aggiungo a `crm_leads` la colonna `notion_page_id text` (per sapere quale pagina Notion aggiornare ad ogni update — evita duplicati).

### 2. Collegamento connettore Notion
Useremo il **Notion connector** ufficiale di Lovable (OAuth, niente API key manuale). Le chiamate passano dal connector gateway: zero gestione token, refresh automatico.

### 3. Edge function `sync-lead-to-notion`
Riceve `lead_id` e:
- Se `notion_page_id` è vuoto → `POST /v1/pages` (crea pagina Notion) → salva ID nel DB.
- Se presente → `PATCH /v1/pages/{id}` (aggiorna proprietà).
- Su `DELETE` → archivia la pagina Notion (`archived: true`).

Tutta la chiamata HTTP passa per `connector-gateway.lovable.dev/notion/v1/...` con header `Authorization` + `X-Connection-Api-Key`.

### 4. Trigger DB su `crm_leads`
Un trigger `AFTER INSERT OR UPDATE OR DELETE` chiama l'edge function via `pg_net.http_post` in modo asincrono — l'utente nel CRM non aspetta Notion, l'UI resta veloce.

### 5. Backfill iniziale
Pulsante "Sincronizza tutti i lead esistenti su Notion" in `/admin/crm` (one-shot) per popolare Notion la prima volta con i lead già nel DB.

### 6. UI: indicatore di sync
Piccolo badge nel CRM con stato:
- ✅ Sincronizzato (data ultimo push)
- ⏳ In corso
- ⚠️ Errore (con dettaglio + pulsante "Riprova")

Tabella `crm_notion_sync_log` per tracciare ogni tentativo (utile per debug).

## Cosa NON farò (per scelta tua)
- Niente lettura da Notion → sito. Le modifiche fatte direttamente su Notion **non torneranno indietro**. Notion va trattato come dashboard read-only / vista mobile / vista condivisibile col team.
- Niente conflitti, niente race conditions, niente polling.

## Consumi Cloud reali (stima conservativa)

Con ~200 lead totali + ~20 modifiche/giorno:

| Voce | Volume/mese | Costo |
|---|---|---|
| Edge function invocations | ~600 | < $0.01 |
| Egress bandwidth (~3KB/req) | ~2 MB | trascurabile |
| pg_net calls | ~600 | incluso |
| **Totale** | | **~$0.02/mese** |

Anche moltiplicando per 10 il volume (2.000 modifiche/mese), resti sotto i **$0.20/mese**. Irrilevante.

## Limitazioni di Notion da sapere
- **Rate limit**: 3 richieste/secondo per integrazione. Con i tuoi volumi non lo tocchi mai, ma l'edge function avrà retry con backoff.
- **Select/Multi-select**: i valori devono esistere come opzioni in Notion, oppure le creiamo al volo con l'API. Gestito automaticamente.
- **Eliminazioni**: Notion non permette delete via API → la pagina viene **archiviata** (sparisce dalla vista ma resta nel cestino 30gg).

---

Dopo la tua approvazione del piano, ti chiederò il **Database ID Notion** e i **nomi esatti delle colonne** che hai già su Notion, poi procedo con migrazione + connettore + edge function in un'unica passata.