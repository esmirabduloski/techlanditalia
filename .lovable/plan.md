

## Piano: Bottone Segnala Bug + Integrazione Jira Service

### Integrazione con Atlassian Jira

Jira non è disponibile come connettore standard in Lovable, quindi l'integrazione avverrà tramite le **API REST di Jira Cloud** con autenticazione via API token. Ecco cosa serve da parte tua:

1. **Crea un API Token Atlassian**: Vai su [https://id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) e crea un nuovo token
2. **Informazioni necessarie**:
   - **Email Atlassian** associata all'account (es. `tuaemail@esempio.com`)
   - **API Token** appena creato
   - **URL del tuo sito Jira** (es. `https://tuosito.atlassian.net`)
   - **Project Key** del progetto Jira Service dove vuoi ricevere i ticket (es. `TECH` o `SUP`)

Questi verranno salvati come secrets sicuri nel backend e usati solo dalla edge function.

### Implementazione tecnica

1. **Creare componente `BugReportButton`** — Un bottone floating o posizionato nell'header della dashboard che apre un dialog con:
   - Campo titolo (obbligatorio)
   - Campo descrizione (textarea)
   - Priorità (bassa/media/alta)
   - Screenshot opzionale
   - Il componente invia i dati alla edge function

2. **Creare edge function `create-jira-ticket`** — Riceve titolo, descrizione, priorità e info utente, poi chiama l'API Jira REST per creare un issue:
   ```
   POST https://{site}.atlassian.net/rest/api/3/issue
   ```
   con autenticazione Basic (email:apitoken in base64)

3. **Aggiungere il bottone in tutte e 3 le dashboard** — Student (`Dashboard.tsx`), Teacher (`TeacherDashboard.tsx`), Admin (`AdminDashboard.tsx`)

4. **Salvare i secrets** — `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_SITE_URL`, `JIRA_PROJECT_KEY`

### Prossimi passi

Prima di procedere con l'implementazione ho bisogno che tu:
1. Confermi di avere un progetto Jira Service Management creato
2. Mi fornisca il **Project Key** del progetto
3. Mi fornisca l'**URL del sito** (es. `https://tuosito.atlassian.net`)

Poi ti chiederò di inserire email e API token tramite il sistema sicuro di secrets.

