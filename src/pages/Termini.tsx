import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";

export default function Termini() {
  return (
    <Layout>
      <section className="tech-section">
        <div className="tech-container">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold mb-8">Termini e Condizioni</h1>
            <p className="text-muted-foreground mb-8">
              Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
            </p>

            <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Accettazione dei Termini</h2>
                <p className="text-muted-foreground">
                  Utilizzando il sito web di TECHLAND e i nostri servizi, accetti di essere vincolato 
                  dai presenti Termini e Condizioni. Se non accetti questi termini, ti preghiamo di 
                  non utilizzare il nostro sito o i nostri servizi.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Descrizione dei Servizi</h2>
                <p className="text-muted-foreground mb-4">
                  TECHLAND offre corsi di tecnologia, coding e sviluppo digitale per bambini e 
                  ragazzi dai 6 ai 18 anni. I nostri servizi includono:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Corsi online di programmazione e tecnologia</li>
                  <li>Lezioni di prova gratuite</li>
                  <li>Materiali didattici digitali</li>
                  <li>Supporto tutoriale durante i corsi</li>
                  <li>Certificati di completamento</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. Iscrizione e Account</h2>
                <p className="text-muted-foreground mb-4">
                  Per accedere ai nostri corsi:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>L'iscrizione deve essere effettuata da un genitore o tutore legale per i minori</li>
                  <li>Le informazioni fornite devono essere accurate e complete</li>
                  <li>Sei responsabile della riservatezza delle credenziali di accesso</li>
                  <li>Devi notificarci immediatamente qualsiasi uso non autorizzato del tuo account</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Lezioni di Prova Gratuite</h2>
                <p className="text-muted-foreground">
                  TECHLAND offre una lezione di prova gratuita senza alcun obbligo di acquisto. 
                  La lezione di prova ha una durata di 30-45 minuti e serve a valutare il livello 
                  dello studente e presentare i nostri metodi didattici. Non è richiesto alcun 
                  pagamento per la lezione di prova.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Pagamenti e Rimborsi</h2>
                <p className="text-muted-foreground mb-4">
                  Per i corsi a pagamento:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>I prezzi sono indicati in Euro e includono l'IVA dove applicabile</li>
                  <li>Il pagamento è richiesto prima dell'inizio del corso</li>
                  <li>Accettiamo pagamenti tramite carta di credito, bonifico bancario e altri metodi specificati</li>
                  <li>È possibile richiedere il rimborso entro 14 giorni dall'inizio del corso se non sono state fruite più di 2 lezioni</li>
                  <li>I rimborsi verranno elaborati entro 30 giorni dalla richiesta</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Proprietà Intellettuale</h2>
                <p className="text-muted-foreground">
                  Tutti i contenuti presenti sul sito e nei corsi (testi, immagini, video, codice, 
                  materiali didattici) sono di proprietà di TECHLAND o dei suoi licenzianti. 
                  È vietata la riproduzione, distribuzione o modifica di tali contenuti senza 
                  autorizzazione scritta. I progetti creati dagli studenti durante i corsi 
                  rimangono di loro proprietà.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Comportamento degli Utenti</h2>
                <p className="text-muted-foreground mb-4">
                  Durante l'utilizzo dei nostri servizi, gli utenti devono:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Comportarsi in modo rispettoso verso docenti e altri studenti</li>
                  <li>Non condividere contenuti inappropriati, offensivi o illegali</li>
                  <li>Non tentare di accedere a sistemi o dati non autorizzati</li>
                  <li>Rispettare le istruzioni dei docenti durante le lezioni</li>
                  <li>Non registrare o distribuire le lezioni senza autorizzazione</li>
                </ul>
                <p className="text-muted-foreground mt-4">
                  Ci riserviamo il diritto di sospendere o terminare l'accesso in caso di 
                  violazione di queste regole.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. Cancellazione e Riprogrammazione</h2>
                <p className="text-muted-foreground">
                  Le lezioni possono essere cancellate o riprogrammate con un preavviso minimo di 
                  24 ore senza penali. Le cancellazioni con meno di 24 ore di preavviso potrebbero 
                  comportare la perdita della lezione. TECHLAND si riserva il diritto di cancellare 
                  o riprogrammare lezioni per cause di forza maggiore o problemi tecnici, 
                  offrendo sempre una lezione sostitutiva.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Requisiti Tecnici</h2>
                <p className="text-muted-foreground mb-4">
                  Per partecipare ai corsi online sono necessari:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Computer con connessione internet stabile</li>
                  <li>Webcam e microfono funzionanti</li>
                  <li>Browser web aggiornato (Chrome, Firefox, Safari, Edge)</li>
                  <li>Software specifici indicati per ciascun corso</li>
                </ul>
                <p className="text-muted-foreground mt-4">
                  TECHLAND non è responsabile per problemi tecnici causati da apparecchiature 
                  o connessioni dell'utente.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Limitazione di Responsabilità</h2>
                <p className="text-muted-foreground">
                  TECHLAND si impegna a fornire servizi di alta qualità ma non garantisce risultati 
                  specifici di apprendimento. Non siamo responsabili per danni indiretti, incidentali 
                  o consequenziali derivanti dall'uso dei nostri servizi. La nostra responsabilità 
                  massima è limitata all'importo pagato per il servizio in questione.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">11. Privacy</h2>
                <p className="text-muted-foreground">
                  Il trattamento dei dati personali è regolato dalla nostra{" "}
                  <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>, 
                  che costituisce parte integrante dei presenti Termini e Condizioni.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">12. Modifiche ai Termini</h2>
                <p className="text-muted-foreground">
                  Ci riserviamo il diritto di modificare questi Termini e Condizioni in qualsiasi 
                  momento. Le modifiche entreranno in vigore dalla pubblicazione su questa pagina. 
                  L'uso continuato dei servizi dopo le modifiche costituisce accettazione dei 
                  nuovi termini.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">13. Legge Applicabile e Foro Competente</h2>
                <p className="text-muted-foreground">
                  I presenti Termini e Condizioni sono regolati dalla legge italiana. Per qualsiasi 
                  controversia sarà competente il Foro del luogo di residenza del consumatore, 
                  come previsto dal Codice del Consumo.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">14. Contatti</h2>
                <p className="text-muted-foreground">
                  Per qualsiasi domanda relativa a questi Termini e Condizioni, puoi contattarci:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Email: <a href="mailto:info@techland.it" className="text-primary hover:underline">info@techland.it</a></li>
                  <li>Sito web: <Link to="/" className="text-primary hover:underline">www.techland.it</Link></li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
