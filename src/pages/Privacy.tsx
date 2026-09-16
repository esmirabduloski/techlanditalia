import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";

/**
 * Informativa privacy (artt. 13-14 GDPR).
 *
 * Il testo descrive i trattamenti EFFETTIVAMENTE presenti nel codice: form di
 * prenotazione/contatto/candidatura, newsletter (double opt-in), account genitore
 * e studente dell'area riservata, chat con assistente AI, notifiche push,
 * pagamenti Stripe, statistiche di prima parte e log di sicurezza. Se aggiungi un
 * fornitore o un nuovo trattamento, aggiorna anche questa pagina e la data.
 */
const LAST_UPDATE = "16 settembre 2026";
const PRIVACY_EMAIL = "info@techlanditalia.it";

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-2xl font-semibold mb-4">{children}</h2>
);
const P = ({ children }: { children: React.ReactNode }) => <p className="text-muted-foreground">{children}</p>;
const UL = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc pl-6 space-y-2 text-muted-foreground">{children}</ul>
);
const Mail = () => (
  <a href={`mailto:${PRIVACY_EMAIL}`} className="text-primary hover:underline">
    {PRIVACY_EMAIL}
  </a>
);

export default function Privacy() {
  return (
    <Layout>
      <SEOHead
        title="Privacy Policy | TECHLAND"
        description="Informativa sulla privacy di TECHLAND: quali dati trattiamo di genitori e studenti, perché, per quanto tempo, con quali fornitori e come esercitare i tuoi diritti (GDPR)."
        canonical="/privacy"
      />

      <section className="tech-section">
        <div className="tech-container">
          <div className="max-w-3xl mx-auto">
            <SEOBreadcrumb items={[{ label: "Privacy Policy" }]} className="mb-8" />
            <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground mb-2">Ultimo aggiornamento: {LAST_UPDATE}</p>
            <p className="text-muted-foreground mb-8">
              Informativa resa ai sensi degli articoli 13 e 14 del Regolamento (UE) 2016/679 ("GDPR") a chi visita il sito
              techlanditalia.it, richiede informazioni o una lezione di prova, si iscrive alla newsletter, si candida o
              utilizza l&apos;area riservata di TECHLAND come genitore, studente o insegnante.
            </p>

            <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
              <section>
                <H2>1. Titolare del trattamento</H2>
                <P>
                  Il Titolare del trattamento è <strong>TECHLAND</strong> — P.IVA 05596490267, REA 459874 — con sede legale a
                  Vedelago (TV), Italia. Per qualsiasi richiesta relativa ai tuoi dati personali puoi scrivere a <Mail /> oppure
                  su WhatsApp al numero +39 350 581 3140.
                </P>
              </section>

              <section>
                <H2>2. Quali dati trattiamo, perché e per quanto tempo</H2>
                <P>
                  Trattiamo solo i dati necessari a ciascuna finalità. Di seguito i trattamenti, la base giuridica e i tempi di
                  conservazione.
                </P>

                <h3 className="text-xl font-semibold mt-6 mb-2">2.1 Richiesta di lezione di prova, contatti e chat</h3>
                <UL>
                  <li>
                    <strong>Dati:</strong> nome del genitore, email, telefono, età del figlio, corso di interesse, contenuto dei
                    messaggi (form contatti e chat del sito).
                  </li>
                  <li>
                    <strong>Finalità:</strong> rispondere alla richiesta, organizzare la lezione di prova gratuita, ricontattarti
                    entro 24 ore e proporti il percorso più adatto.
                  </li>
                  <li>
                    <strong>Base giuridica:</strong> misure precontrattuali adottate su tua richiesta (art. 6.1.b GDPR) e, per il
                    follow-up commerciale sulla richiesta stessa, legittimo interesse (art. 6.1.f). Non ti iscriviamo alla
                    newsletter senza un tuo consenso separato.
                  </li>
                  <li>
                    <strong>Conservazione:</strong> 24 mesi dall&apos;ultimo contatto, salvo che tu diventi cliente (vedi 2.3).
                  </li>
                  <li>
                    <strong>Chat con assistente virtuale:</strong> le domande poste nella chat del sito ricevono una prima
                    risposta da un assistente basato su intelligenza artificiale (modello Google Gemini, erogato tramite Lovable
                    AI Gateway) e, se lo chiedi, da un operatore umano. I messaggi sono conservati per gestire la richiesta e
                    migliorare il servizio per un massimo di 24 mesi dall&apos;ultimo messaggio. Ti chiediamo di non inserire in chat
                    dati sensibili (es. salute).
                  </li>
                </UL>

                <h3 className="text-xl font-semibold mt-6 mb-2">2.2 Newsletter</h3>
                <UL>
                  <li>
                    <strong>Dati:</strong> indirizzo email.
                  </li>
                  <li>
                    <strong>Finalità e base giuridica:</strong> invio di articoli, guide e novità sui corsi, sulla base del tuo{" "}
                    <strong>consenso</strong> (art. 6.1.a), confermato con il click sul link di verifica (double opt-in).
                  </li>
                  <li>
                    <strong>Conservazione:</strong> fino alla revoca. Puoi disiscriverti in ogni momento dal link presente in
                    fondo a ogni email.
                  </li>
                </UL>

                <h3 className="text-xl font-semibold mt-6 mb-2">2.3 Account genitore e studente (area riservata)</h3>
                <UL>
                  <li>
                    <strong>Dati del genitore:</strong> nome, email, telefono, corsi acquistati e saldo lezioni, comunicazioni con
                    la scuola.
                  </li>
                  <li>
                    <strong>Dati dello studente (minore):</strong> nome, età o anno di nascita, nome utente scelto per l&apos;accesso
                    (senza email personale), corsi frequentati e presenze, compiti consegnati e progetti (inclusi file e codice),
                    valutazioni e commenti dell&apos;insegnante, progressi, badge e traguardi, attestati di completamento.
                  </li>
                  <li>
                    <strong>Finalità:</strong> erogare i corsi, gestire lezioni, compiti, presenze e comunicazioni con la famiglia,
                    rilasciare gli attestati, adempiere agli obblighi contabili e fiscali.
                  </li>
                  <li>
                    <strong>Base giuridica:</strong> esecuzione del contratto (art. 6.1.b) e obblighi di legge (art. 6.1.c). I dati
                    del minore sono forniti e gestiti dal genitore o tutore, che può accedervi, correggerli e chiederne la
                    cancellazione in ogni momento.
                  </li>
                  <li>
                    <strong>Conservazione:</strong> per tutta la durata dell&apos;iscrizione e per i 10 anni successivi, termine
                    della prescrizione ordinaria e degli obblighi contabili e fiscali (artt. 2220 e 2946 c.c.); in qualsiasi
                    momento il genitore può chiedere la cancellazione anticipata dei dati didattici non necessari a tali fini.
                  </li>
                </UL>

                <h3 className="text-xl font-semibold mt-6 mb-2">2.4 Pagamenti</h3>
                <P>
                  I pagamenti con carta sono gestiti da Stripe: i dati della carta sono inseriti direttamente su pagine di
                  Stripe e non transitano né vengono conservati sui nostri sistemi. Noi conserviamo solo l&apos;esito, il prodotto
                  acquistato e l&apos;importo, per la durata del rapporto e per gli obblighi fiscali (10 anni).
                </P>

                <h3 className="text-xl font-semibold mt-6 mb-2">2.5 Notifiche push</h3>
                <P>
                  Se attivi le notifiche (promemoria lezioni, avvisi), registriamo un identificativo tecnico del dispositivo
                  fornito da Google Firebase Cloud Messaging, sulla base del tuo consenso. Puoi disattivarle in qualsiasi momento
                  dalla tua area riservata o dalle impostazioni del browser: l&apos;identificativo viene eliminato.
                </P>

                <h3 className="text-xl font-semibold mt-6 mb-2">2.6 Candidature ("Lavora con noi")</h3>
                <P>
                  Nome, email, telefono e quanto ci scrivi di te vengono usati solo per valutare la candidatura e per
                  eventuali posizioni analoghe (misure precontrattuali, art. 6.1.b) e conservati per 24 mesi, salvo
                  assunzione.
                </P>

                <h3 className="text-xl font-semibold mt-6 mb-2">2.7 Dati tecnici, sicurezza e statistiche</h3>
                <UL>
                  <li>
                    <strong>Sicurezza:</strong> per prevenire abusi, spam e accessi non autorizzati registriamo indirizzo IP, user
                    agent e timestamp delle richieste ai nostri form e dei tentativi di accesso (legittimo interesse, art. 6.1.f).
                    Conservazione: limiti di frequenza 24 ore, tentativi di accesso 7 giorni, eventi di sicurezza e accessi
                    amministrativi 90 giorni.
                  </li>
                  <li>
                    <strong>Statistiche di navigazione:</strong> misuriamo pagine viste, click sui pulsanti, tempo di lettura e
                    tipo di dispositivo con strumenti di prima parte, senza registrare l&apos;indirizzo IP e senza cookie di
                    profilazione; un identificativo di sessione temporaneo distingue le visite e viene eliminato alla chiusura
                    del browser. Per gli utenti che hanno effettuato l&apos;accesso all&apos;area riservata le statistiche possono
                    essere associate all&apos;account per migliorare la piattaforma (legittimo interesse). I dati grezzi sono
                    cancellati dopo 30 giorni.
                  </li>
                  <li>
                    <strong>Monitoraggio errori:</strong> in caso di malfunzionamento registriamo informazioni tecniche sul
                    browser e sull&apos;errore (Sentry), senza indirizzo IP, per correggere i problemi.
                  </li>
                </UL>
              </section>

              <section>
                <H2>3. Dati dei minori</H2>
                <P>
                  I nostri servizi sono rivolti ai genitori: le richieste di informazioni, le iscrizioni e gli account vengono
                  creati da un genitore o tutore, che fornisce i dati del minore e ne autorizza il trattamento. Per gli studenti
                  raccogliamo il minimo indispensabile (nome utente senza email, età), gli insegnanti vedono solo i propri
                  studenti e nessun dato del minore viene usato per finalità di marketing o profilazione.
                </P>
              </section>

              <section>
                <H2>4. A chi comunichiamo i dati</H2>
                <P>
                  I dati non vengono venduti. Sono trattati per nostro conto da fornitori nominati responsabili del trattamento
                  (art. 28 GDPR), ciascuno solo per la propria funzione:
                </P>
                <UL>
                  <li>
                    <strong>Lovable Cloud</strong> (infrastruttura Supabase) — hosting del sito, database, autenticazione e
                    archiviazione file.
                  </li>
                  <li>
                    <strong>Resend</strong> — invio delle email transazionali (conferme, promemoria, newsletter).
                  </li>
                  <li>
                    <strong>Google</strong> — Firebase Cloud Messaging per le notifiche push; modello Gemini (tramite Lovable AI
                    Gateway) per le risposte dell&apos;assistente in chat; YouTube per i video didattici incorporati nelle lezioni
                    (in modalità privacy-enhanced).
                  </li>
                  <li>
                    <strong>Stripe</strong> — pagamenti.
                  </li>
                  <li>
                    <strong>Microsoft</strong> — Clarity, statistiche d&apos;uso delle sole pagine pubbliche (mappe di calore e
                    riproduzioni anonime della navigazione, senza cookie e con i campi dei moduli mascherati); mai attivo
                    nell&apos;area riservata.
                  </li>
                  <li>
                    <strong>Notion</strong> — gestione interna dei contatti commerciali (CRM).
                  </li>
                  <li>
                    <strong>Sentry</strong> — monitoraggio degli errori tecnici.
                  </li>
                  <li>
                    <strong>Trustpilot</strong> — widget delle recensioni nell&apos;area riservata.
                  </li>
                  <li>
                    <strong>Meta (WhatsApp)</strong> — solo se scegli di contattarci tramite WhatsApp, secondo l&apos;informativa
                    di WhatsApp.
                  </li>
                </UL>
                <P>
                  I dati possono inoltre essere comunicati a consulenti (es. commercialista) per gli adempimenti di legge e alle
                  autorità competenti quando richiesto.
                </P>
              </section>

              <section>
                <H2>5. Trasferimenti fuori dall&apos;Unione Europea</H2>
                <P>
                  Alcuni fornitori (Google, Microsoft, Resend, Stripe, Notion, Sentry, Meta) hanno sede o server negli Stati Uniti. I
                  trasferimenti avvengono con le garanzie previste dal Capo V del GDPR: adesione al Data Privacy Framework
                  UE-USA e/o Clausole Contrattuali Standard approvate dalla Commissione Europea.
                </P>
              </section>

              <section>
                <H2>6. I tuoi diritti</H2>
                <P>Ai sensi degli articoli 15-22 GDPR hai diritto a:</P>
                <UL>
                  <li>
                    <strong>Accesso:</strong> sapere quali dati trattiamo e riceverne copia.
                  </li>
                  <li>
                    <strong>Rettifica:</strong> correggere dati inesatti o incompleti.
                  </li>
                  <li>
                    <strong>Cancellazione ("diritto all&apos;oblio"):</strong> ottenere la cancellazione dei dati tuoi e di tuo
                    figlio, inclusa la chiusura degli account, salvo i dati che dobbiamo conservare per legge (es. fatture).
                    I genitori possono farlo in autonomia dalla propria area riservata (Profilo → Elimina account).
                  </li>
                  <li>
                    <strong>Limitazione e opposizione:</strong> limitare il trattamento o opporti, in particolare alle
                    comunicazioni commerciali.
                  </li>
                  <li>
                    <strong>Portabilità:</strong> ricevere i dati che ci hai fornito in formato strutturato e leggibile.
                  </li>
                  <li>
                    <strong>Revoca del consenso:</strong> in qualsiasi momento, senza pregiudicare la liceità del trattamento
                    precedente (newsletter: link in ogni email; notifiche push: dalla tua area riservata).
                  </li>
                </UL>
                <P>
                  Per esercitarli scrivi a <Mail />: rispondiamo entro 30 giorni. Se ritieni che il trattamento violi la
                  normativa puoi proporre reclamo al Garante per la protezione dei dati personali (
                  <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    www.garanteprivacy.it
                  </a>
                  ).
                </P>
              </section>

              <section>
                <H2>7. Cookie e strumenti simili</H2>
                <P>
                  Usiamo solo cookie e memorizzazioni tecniche (accesso, preferenze) e statistiche di prima parte anonime, senza
                  strumenti di profilazione pubblicitaria: per questo non mostriamo un banner di consenso. L&apos;elenco completo è
                  nella{" "}
                  <Link to="/cookie" className="text-primary hover:underline">
                    Cookie Policy
                  </Link>
                  .
                </P>
              </section>

              <section>
                <H2>8. Sicurezza</H2>
                <P>
                  I dati sono trasmessi in forma cifrata (HTTPS), conservati con controlli di accesso per ruolo (ogni genitore,
                  studente e insegnante vede solo i propri dati), con log degli accessi amministrativi, protezioni anti-abuso sui
                  moduli e backup periodici. Nessun sistema è però sicuro al 100%: in caso di violazione che comporti un rischio
                  per i tuoi diritti ti informeremo come previsto dall&apos;art. 34 GDPR.
                </P>
              </section>

              <section>
                <H2>9. Modifiche</H2>
                <P>
                  Possiamo aggiornare questa informativa quando cambiano i servizi o i fornitori: la versione in vigore è sempre
                  quella pubblicata su questa pagina, con la data di ultimo aggiornamento indicata in alto.
                </P>
              </section>

              <section className="pt-8 border-t">
                <p className="text-sm text-muted-foreground">
                  Contatti per la privacy: <Mail /> · WhatsApp +39 350 581 3140 · TECHLAND, P.IVA 05596490267, Vedelago (TV).
                </p>
              </section>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
