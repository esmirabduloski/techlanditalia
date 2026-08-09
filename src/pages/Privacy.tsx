import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";

/**
 * INFORMATIVA PRIVACY — NOTE INTERNE (non visibili all'utente)
 *
 * DA COMPLETARE MANUALMENTE (verificare con consulente legale/privacy):
 * - Denominazione legale completa del titolare (ragione sociale) e codice fiscale
 * - Indirizzo completo della sede legale (attualmente noto solo: Vedelago (TV), P.IVA 05596490267)
 * - Eventuale nomina di un DPO/RPD
 * - Durate di conservazione precise (qui indicati criteri realistici, non date arbitrarie)
 * - Verifica dei meccanismi di trasferimento extra-SEE dei singoli fornitori (SCC / decisioni di adeguatezza)
 *
 * SERVIZI EFFETTIVAMENTE RILEVATI NEL CODICE (aggiornare se cambiano):
 * - Lovable Cloud / Supabase: database Postgres, autenticazione email+password, storage file, edge functions
 * - Resend: invio email transazionali (benvenuto, reset password, contatti, prenotazioni, newsletter)
 * - Stripe: checkout e pagamenti (stripe-create-checkout / stripe-get-products)
 * - Trustpilot: widget recensioni caricato solo nell'area riservata genitori
 * - Lovable AI Gateway (modello Google Gemini): chatbot di assistenza
 * - Notion (sync lead CRM) e Jira (ticket segnalazione bug) — strumenti interni
 * - Embed di terze parti nelle lezioni: YouTube (nocookie), Google Docs/Drive, Replit
 * - Analytics proprietaria (tabelle page_views / analytics_events sul database del progetto).
 *   NON sono presenti Google Analytics, Meta Pixel, Conversions API o altri strumenti Meta.
 * - Nessun login social/OAuth esterno attivo: autenticazione interna email+password (hash gestito da Supabase Auth)
 */

const PRIVACY_EMAIL = "privacy@techlanditalia.it";

export default function Privacy() {
  return (
    <Layout>
      <SEOHead
        title="Privacy Policy | TECHLAND"
        description="Informativa privacy di TECHLAND: quali dati trattiamo, per quali finalità, con quali basi giuridiche e come esercitare i tuoi diritti GDPR."
        canonical="/privacy"
      />

      <section className="tech-section">
        <div className="tech-container">
          <div className="max-w-3xl mx-auto">
            <SEOBreadcrumb items={[{ label: "Privacy Policy" }]} className="mb-8" />
            <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground mb-8">
              Ultimo aggiornamento: 9 agosto 2026
            </p>

            <div className="prose prose-lg dark:prose-invert max-w-none space-y-10">
              <section>
                <p className="text-muted-foreground">
                  La presente informativa descrive come TECHLAND tratta i dati personali degli utenti del sito{" "}
                  <strong>techlanditalia.it</strong> e dei servizi collegati (area riservata, corsi online, moduli di
                  contatto e prenotazione), ai sensi del Regolamento (UE) 2016/679 (“GDPR”) e del D.lgs. 196/2003 come
                  modificato dal D.lgs. 101/2018.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Titolare del trattamento</h2>
                <p className="text-muted-foreground">
                  Il Titolare del trattamento è <strong>TECHLAND</strong>, P.IVA 05596490267, con sede a Vedelago (TV),
                  Italia. Il servizio è erogato interamente online sul territorio italiano.
                </p>
                <p className="text-muted-foreground mt-4">
                  Per qualsiasi richiesta in materia di protezione dei dati puoi scrivere a{" "}
                  <a href={`mailto:${PRIVACY_EMAIL}`} className="text-primary hover:underline">
                    {PRIVACY_EMAIL}
                  </a>{" "}
                  oppure a{" "}
                  <a href="mailto:info@techlanditalia.it" className="text-primary hover:underline">
                    info@techlanditalia.it
                  </a>
                  .
                </p>
                <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border">
                  <p className="text-sm text-muted-foreground m-0">
                    <strong>Sezione da completare:</strong> denominazione legale completa, codice fiscale, indirizzo
                    completo della sede legale ed eventuale nomina di un Responsabile della protezione dei dati (DPO).
                    Questi dati saranno inseriti non appena formalizzati; non vengono qui indicati per non riportare
                    informazioni non verificate.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Categorie di dati trattati</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>
                    <strong>Dati dell’account TECHLAND:</strong> indirizzo email utilizzato come credenziale di accesso,
                    password, ruolo (genitore, alunno, docente, amministratore), preferenze dell’interfaccia.
                  </li>
                  <li>
                    <strong>Nome e cognome</strong> del genitore/tutore e dell’alunno, quando forniti in fase di
                    iscrizione o creazione dell’account.
                  </li>
                  <li>
                    <strong>Password:</strong> non viene mai conservata in chiaro. L’autenticazione è gestita dal
                    servizio di autenticazione della piattaforma cloud che conserva la password sotto forma di hash
                    crittografico; TECHLAND non ha accesso alla password in chiaro.
                  </li>
                  <li>
                    <strong>Dati di contatto:</strong> email, numero di telefono (se fornito), contenuto dei messaggi
                    inviati tramite i moduli di contatto, prenotazione o la chat di assistenza.
                  </li>
                  <li>
                    <strong>Dati didattici:</strong> corsi e gruppi di appartenenza, calendario e presenze alle lezioni,
                    compiti consegnati, file e codice caricati, valutazioni, commenti dei docenti, progressi,
                    badge e classifiche interne.
                  </li>
                  <li>
                    <strong>Dati di pagamento:</strong> gli acquisti sono gestiti tramite il fornitore di pagamento
                    (Stripe). TECHLAND riceve l’esito della transazione e i dati necessari alla fatturazione, ma{" "}
                    <strong>non tratta né conserva i dati completi della carta</strong>.
                  </li>
                  <li>
                    <strong>Dati tecnici di navigazione:</strong> pagine visitate, referrer, parametri di campagna (UTM),
                    tipo di dispositivo e browser, risoluzione dello schermo, identificativo di sessione temporaneo,
                    indirizzo IP trattato dai sistemi di sicurezza (ad es. limitazione delle richieste e log anti-abuso).
                  </li>
                  <li>
                    <strong>Cookie e archiviazione locale:</strong> vedi la sezione 9 e la{" "}
                    <a href="/cookie" className="text-primary hover:underline">
                      Cookie Policy
                    </a>
                    .
                  </li>
                  <li>
                    <strong>Dati inseriti volontariamente:</strong> messaggi, richieste di lezione di prova,
                    candidature di lavoro (con eventuale CV), iscrizione alla newsletter, segnalazioni di bug.
                  </li>
                  <li>
                    <strong>Dati di minori:</strong> trattati esclusivamente nell’ambito delle attività didattiche e
                    sotto la responsabilità del genitore/tutore che crea o autorizza l’account (vedi sezione 6).
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. Login e account TECHLAND</h2>
                <p className="text-muted-foreground">
                  L’accesso all’area riservata avviene <strong>esclusivamente tramite un sistema di autenticazione
                  interno a TECHLAND</strong>, basato su email (o username assegnato all’alunno) e password.
                </p>
                <p className="text-muted-foreground mt-4">
                  Il servizio <strong>non utilizza Facebook Login, Instagram Login, Meta Login</strong> né altri sistemi
                  di autenticazione gestiti da Meta o da altri social network. Le credenziali utilizzate per l’accesso
                  sono specifiche dell’account TECHLAND e non vengono importate da piattaforme esterne. TECHLAND non
                  riceve dati personali da Facebook, Instagram o Meta.
                </p>
                <p className="text-muted-foreground mt-4">
                  Le password sono gestite dal servizio di autenticazione della piattaforma cloud utilizzata e
                  conservate in forma protetta tramite hashing: non sono leggibili né dal personale TECHLAND né
                  recuperabili in chiaro. In caso di smarrimento è possibile richiedere solo la reimpostazione.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Finalità del trattamento</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>creare e gestire l’account e l’area riservata;</li>
                  <li>gestire iscrizioni, gruppi, calendario delle lezioni, compiti e valutazioni;</li>
                  <li>rispondere a richieste di informazioni e prenotazioni della lezione di prova gratuita;</li>
                  <li>gestire pagamenti, fatturazione e adempimenti amministrativi e fiscali;</li>
                  <li>
                    garantire la sicurezza della piattaforma, prevenire abusi, spam e accessi non autorizzati
                    (limitazione delle richieste, registrazione degli eventi di sicurezza e degli accessi amministrativi);
                  </li>
                  <li>
                    misurare in forma aggregata l’utilizzo del sito tramite un sistema di statistiche proprietario,
                    ospitato sull’infrastruttura del servizio;
                  </li>
                  <li>inviare comunicazioni di servizio relative al percorso didattico e all’account;</li>
                  <li>
                    inviare la newsletter e comunicazioni commerciali solo previa iscrizione volontaria e con possibilità
                    di disiscrizione in ogni momento;
                  </li>
                  <li>gestire le candidature ricevute tramite la sezione “Lavora con noi”.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Basi giuridiche</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>
                    <strong>Esecuzione di un contratto o di misure precontrattuali</strong> (art. 6.1.b GDPR): creazione
                    e gestione dell’account, erogazione dei corsi, gestione di lezioni e compiti, risposta a richieste di
                    informazioni e prenotazione della lezione di prova, gestione dei pagamenti.
                  </li>
                  <li>
                    <strong>Obbligo legale</strong> (art. 6.1.c GDPR): conservazione della documentazione contabile e
                    fiscale e adempimenti previsti dalla normativa.
                  </li>
                  <li>
                    <strong>Consenso</strong> (art. 6.1.a GDPR): iscrizione alla newsletter e comunicazioni commerciali,
                    nonché eventuali cookie o strumenti non necessari. Il consenso è revocabile in ogni momento.
                  </li>
                  <li>
                    <strong>Legittimo interesse</strong> (art. 6.1.f GDPR): sicurezza della piattaforma e prevenzione
                    degli abusi, statistiche di utilizzo aggregate, gestione delle candidature spontanee. In questi casi
                    il trattamento è limitato a quanto necessario e puoi opporti scrivendoci.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Dati di bambini e adolescenti</h2>
                <p className="text-muted-foreground">
                  TECHLAND offre corsi rivolti ad alunni dai 6 ai 18 anni. L’account dell’alunno viene creato dal
                  genitore/tutore oppure da TECHLAND su richiesta e con il coinvolgimento del genitore/tutore, che
                  fornisce il consenso e resta il riferimento per l’esercizio dei diritti.
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>
                    raccogliamo solo i dati necessari all’attività didattica: nome, eventuale email/username di accesso,
                    età o fascia d’età, corso frequentato, presenze, compiti e progressi;
                  </li>
                  <li>
                    non richiediamo e non raccogliamo categorie particolari di dati (dati sanitari, opinioni, ecc.);
                  </li>
                  <li>
                    l’area riservata dell’alunno è accessibile solo previa autenticazione ed è visibile, oltre che
                    all’alunno, al genitore collegato, al docente del gruppo e agli amministratori;
                  </li>
                  <li>
                    le classifiche e i badge interni sono visibili solo agli utenti autenticati della piattaforma e non
                    sono pubblici;
                  </li>
                  <li>
                    il genitore o tutore può in qualsiasi momento chiedere accesso, rettifica o cancellazione dei dati
                    dell’alunno scrivendo a{" "}
                    <a href={`mailto:${PRIVACY_EMAIL}`} className="text-primary hover:underline">
                      {PRIVACY_EMAIL}
                    </a>
                    .
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Conservazione dei dati</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>
                    <strong>Account e dati didattici:</strong> per tutta la durata del rapporto e, salvo richiesta di
                    cancellazione anticipata, per il periodo necessario a gestire eventuali riprese del percorso o
                    contestazioni.
                  </li>
                  <li>
                    <strong>Richieste di informazioni e prenotazioni non convertite:</strong> per il tempo necessario a
                    dare riscontro e per un periodo limitato successivo, in assenza di ulteriori contatti.
                  </li>
                  <li>
                    <strong>Dati contabili e fiscali:</strong> per il termine previsto dalla normativa italiana
                    (attualmente 10 anni).
                  </li>
                  <li>
                    <strong>Log di sicurezza e accessi amministrativi:</strong> per un periodo limitato, proporzionato
                    alle finalità di sicurezza.
                  </li>
                  <li>
                    <strong>Newsletter:</strong> fino alla revoca del consenso o alla disiscrizione.
                  </li>
                  <li>
                    <strong>Statistiche di navigazione:</strong> conservate in forma aggregata o pseudonimizzata per il
                    tempo necessario alle analisi di utilizzo.
                  </li>
                </ul>
                <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border">
                  <p className="text-sm text-muted-foreground m-0">
                    <strong>Da completare:</strong> i termini esatti di conservazione per ciascuna categoria saranno
                    indicati in mesi/anni una volta formalizzata la policy di data retention interna.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. Destinatari e fornitori</h2>
                <p className="text-muted-foreground mb-4">
                  I dati possono essere trattati, in qualità di responsabili del trattamento o autonomi titolari, dai
                  seguenti soggetti effettivamente utilizzati dalla piattaforma:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>
                    <strong>Hosting del sito e infrastruttura cloud</strong> (Lovable): pubblicazione del sito e
                    funzionamento della piattaforma.
                  </li>
                  <li>
                    <strong>Database, autenticazione, storage file e funzioni server</strong> (Supabase, tramite Lovable
                    Cloud): conservazione dei dati dell’account, dei contenuti didattici e dei file caricati.
                  </li>
                  <li>
                    <strong>Invio email transazionali e newsletter</strong> (Resend): email di benvenuto, reimpostazione
                    password, conferme di prenotazione, risposte ai moduli di contatto, newsletter.
                  </li>
                  <li>
                    <strong>Pagamenti</strong> (Stripe): gestione del checkout e delle transazioni.
                  </li>
                  <li>
                    <strong>Assistente virtuale</strong> (Lovable AI Gateway, con modelli Google Gemini): elaborazione
                    dei messaggi inviati alla chat di supporto del sito.
                  </li>
                  <li>
                    <strong>Recensioni</strong> (Trustpilot): widget caricato solo nell’area riservata ai genitori per
                    invitare a lasciare una recensione.
                  </li>
                  <li>
                    <strong>Strumenti interni di gestione</strong> (Notion per l’archiviazione dei contatti commerciali,
                    Jira per la gestione delle segnalazioni tecniche).
                  </li>
                  <li>
                    <strong>Contenuti e strumenti didattici incorporati</strong> nelle lezioni: YouTube (in modalità
                    “nocookie”), Google Documenti/Drive, Replit e le piattaforme di videoconferenza utilizzate per le
                    lezioni live (Zoom/Google Meet), i cui link vengono forniti dal docente.
                  </li>
                  <li>
                    Consulenti professionali (es. commercialista) e autorità competenti, nei casi previsti dalla legge.
                  </li>
                </ul>
                <p className="text-muted-foreground mt-4">
                  I dati non vengono venduti a terzi e non vengono utilizzati per profilazione pubblicitaria su
                  piattaforme di social network.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Cookie e strumenti di tracciamento</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>
                    <strong>Tecnici / necessari:</strong> gestione della sessione di accesso (conservata nel browser
                    tramite storage locale del servizio di autenticazione), preferenze di tema e accessibilità.
                    Finalità: funzionamento del sito. Durata: dalla sessione fino alla scadenza del token o alla
                    disconnessione. Non richiedono consenso.
                  </li>
                  <li>
                    <strong>Statistiche proprietarie:</strong> identificativo di sessione temporaneo salvato nel
                    <em> sessionStorage</em> del browser, usato per contare le visite sul database di TECHLAND. Nessun
                    dato viene condiviso con circuiti pubblicitari; la durata è limitata alla sessione del browser.
                  </li>
                  <li>
                    <strong>Terze parti attivate solo su richiesta:</strong> il widget Trustpilot (area riservata
                    genitori) e i contenuti incorporati nelle lezioni (YouTube nocookie, Google Drive/Documenti, Replit)
                    possono impostare cookie propri quando vengono visualizzati.
                  </li>
                </ul>
                <p className="text-muted-foreground mt-4">
                  <strong>Non utilizziamo Google Analytics, Meta Pixel, Conversions API o altri strumenti di
                  tracciamento pubblicitario di Meta o di terze parti.</strong> Puoi bloccare o eliminare i cookie
                  tramite le impostazioni del browser; il blocco dei cookie tecnici può impedire l’accesso all’area
                  riservata. Maggiori dettagli nella{" "}
                  <a href="/cookie" className="text-primary hover:underline">
                    Cookie Policy
                  </a>
                  .
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. I tuoi diritti</h2>
                <p className="text-muted-foreground mb-4">Ai sensi degli artt. 15-22 GDPR hai diritto a:</p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>Accesso:</strong> sapere quali dati trattiamo e ottenerne copia;</li>
                  <li><strong>Rettifica:</strong> correggere dati inesatti o incompleti;</li>
                  <li><strong>Cancellazione:</strong> ottenere l’eliminazione dei dati, nei casi previsti;</li>
                  <li><strong>Limitazione:</strong> chiedere la sospensione del trattamento in determinati casi;</li>
                  <li><strong>Opposizione:</strong> opporti ai trattamenti basati sul legittimo interesse e al marketing diretto;</li>
                  <li><strong>Portabilità:</strong> ricevere in formato strutturato i dati trattati sulla base del consenso o del contratto;</li>
                  <li><strong>Revoca del consenso</strong> in qualsiasi momento, senza pregiudicare la liceità del trattamento precedente;</li>
                  <li><strong>Reclamo</strong> al Garante per la protezione dei dati personali.</li>
                </ul>
                <p className="text-muted-foreground mt-4">
                  Per esercitare i tuoi diritti scrivi a{" "}
                  <a href={`mailto:${PRIVACY_EMAIL}`} className="text-primary hover:underline">
                    {PRIVACY_EMAIL}
                  </a>
                  . Rispondiamo entro 30 giorni dalla ricezione della richiesta.
                </p>
              </section>

              <section id="cancellazione-dati" className="scroll-mt-24">
                <h2 className="text-2xl font-semibold mb-4">11. Richiesta di cancellazione dei dati</h2>
                <div className="p-6 rounded-xl bg-muted/30 border border-border not-prose">
                  <p className="text-muted-foreground mb-4">
                    Puoi richiedere in qualsiasi momento la cancellazione dell’account TECHLAND e dei dati personali
                    collegati. La procedura riguarda esclusivamente i dati dell’account TECHLAND: il sito non utilizza
                    login tramite Facebook, Instagram o Meta e non conserva dati provenienti da tali piattaforme.
                  </p>
                  <p className="text-muted-foreground mb-2"><strong>Come richiederla</strong></p>
                  <ol className="list-decimal pl-6 space-y-2 text-muted-foreground mb-4">
                    <li>
                      Invia un’email a{" "}
                      <a href={`mailto:${PRIVACY_EMAIL}?subject=Richiesta%20cancellazione%20dati%20account%20TECHLAND`} className="text-primary hover:underline">
                        {PRIVACY_EMAIL}
                      </a>{" "}
                      con oggetto “Richiesta cancellazione dati”.
                    </li>
                    <li>
                      Indica l’indirizzo email dell’account (per gli account degli alunni: nome dell’alunno e account del
                      genitore collegato) e specifica se desideri cancellare l’intero account o solo determinati dati.
                    </li>
                    <li>
                      Per motivi di sicurezza la richiesta deve essere inviata dall’indirizzo email associato
                      all’account o, per gli alunni minorenni, dall’indirizzo del genitore/tutore. Se non è possibile,
                      potremmo chiedere un’ulteriore verifica dell’identità.
                    </li>
                    <li>
                      Riceverai una conferma di presa in carico via email e l’esito entro 30 giorni.
                    </li>
                  </ol>
                  <a
                    href={`mailto:${PRIVACY_EMAIL}?subject=Richiesta%20cancellazione%20dati%20account%20TECHLAND&body=Salve%2C%20richiedo%20la%20cancellazione%20dei%20dati%20personali%20associati%20al%20mio%20account%20TECHLAND.%0A%0AEmail%20dell%27account%3A%20%0ANome%20e%20cognome%3A%20%0A%28Se%20account%20di%20un%20alunno%29%20Nome%20alunno%20e%20account%20genitore%3A%20%0ATipo%20di%20richiesta%3A%20cancellazione%20completa%20dell%27account%20%2F%20cancellazione%20di%20dati%20specifici%20%28indicare%29%0A`}
                    className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-primary-foreground font-medium hover:opacity-90 transition-opacity"
                  >
                    Invia richiesta di cancellazione
                  </a>
                  <p className="text-sm text-muted-foreground mt-4 mb-0">
                    Alcuni dati potrebbero dover essere conservati anche dopo la cancellazione dell’account quando
                    sussiste un obbligo di legge (ad esempio documenti contabili e fiscali).
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">12. Sicurezza</h2>
                <p className="text-muted-foreground mb-4">
                  Adottiamo misure tecniche e organizzative adeguate, tra cui quelle effettivamente implementate sulla
                  piattaforma:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>connessione cifrata HTTPS su tutto il sito;</li>
                  <li>autenticazione obbligatoria per l’accesso all’area riservata;</li>
                  <li>password conservate esclusivamente in forma di hash dal servizio di autenticazione;</li>
                  <li>
                    regole di accesso a livello di database (row level security) che limitano la visibilità dei dati al
                    singolo utente, al genitore collegato, al docente del gruppo e agli amministratori;
                  </li>
                  <li>limitazione delle richieste (rate limiting) e registrazione degli eventi di sicurezza;</li>
                  <li>registro degli accessi amministrativi;</li>
                  <li>controlli sul caricamento dei file e restrizioni sulle cartelle di destinazione;</li>
                  <li>intestazioni di sicurezza HTTP, inclusa una Content Security Policy;</li>
                  <li>backup periodici dei contenuti della piattaforma.</li>
                </ul>
                <p className="text-muted-foreground mt-4">
                  Nessun sistema è sicuro al 100%: in caso di violazione dei dati che comporti un rischio elevato per i
                  tuoi diritti, ti informeremo secondo quanto previsto dagli artt. 33-34 GDPR.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">13. Trasferimenti internazionali</h2>
                <p className="text-muted-foreground">
                  Alcuni fornitori utilizzati (ad esempio quelli di hosting, infrastruttura cloud, invio email,
                  pagamenti e servizi di intelligenza artificiale) sono società con sede o infrastrutture anche al di
                  fuori dello Spazio Economico Europeo. In tali casi il trasferimento avviene sulla base delle garanzie
                  previste dal Capo V del GDPR, quali le Clausole Contrattuali Standard della Commissione europea o una
                  decisione di adeguatezza.
                </p>
                <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border">
                  <p className="text-sm text-muted-foreground m-0">
                    <strong>Da completare:</strong> verifica puntuale, per ciascun fornitore, della localizzazione dei
                    server e dello specifico meccanismo di trasferimento applicato. Le informazioni verranno dettagliate
                    qui una volta acquisite dalla documentazione contrattuale dei fornitori.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">14. Aggiornamenti dell’informativa</h2>
                <p className="text-muted-foreground">
                  Questa informativa può essere aggiornata per riflettere modifiche ai servizi, ai fornitori o alla
                  normativa. La data di ultimo aggiornamento è indicata all’inizio della pagina. In caso di modifiche
                  rilevanti informeremo gli utenti registrati via email o tramite un avviso ben visibile sul sito.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">15. Contatti</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>
                    Richieste privacy:{" "}
                    <a href={`mailto:${PRIVACY_EMAIL}`} className="text-primary hover:underline">
                      {PRIVACY_EMAIL}
                    </a>
                  </li>
                  <li>
                    Informazioni generali:{" "}
                    <a href="mailto:info@techlanditalia.it" className="text-primary hover:underline">
                      info@techlanditalia.it
                    </a>
                  </li>
                </ul>
              </section>

              <section className="pt-8 border-t">
                <p className="text-sm text-muted-foreground">
                  Hai anche il diritto di presentare reclamo all’Autorità Garante per la Protezione dei Dati Personali (
                  <a
                    href="https://www.garanteprivacy.it"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    www.garanteprivacy.it
                  </a>
                  ).
                </p>
              </section>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
