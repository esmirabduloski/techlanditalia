import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";

export default function Privacy() {
  return (
    <Layout>
      <SEOHead
        title="Privacy Policy | TECHLAND"
        description="Informativa sulla privacy di TECHLAND. Scopri come trattiamo e proteggiamo i tuoi dati personali secondo il GDPR."
        canonical="/privacy"
      />
      
      <section className="tech-section">
        <div className="tech-container">
          <div className="max-w-3xl mx-auto">
            <SEOBreadcrumb 
              items={[{ label: "Privacy Policy" }]} 
              className="mb-8"
            />
            <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
            <p className="text-muted-foreground mb-8">
              Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
            </p>

            <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Titolare del Trattamento</h2>
                <p className="text-muted-foreground">
                  Il Titolare del trattamento dei dati personali è TECHLAND, con sede in Italia. 
                  Per qualsiasi informazione relativa al trattamento dei tuoi dati personali, 
                  puoi contattarci all'indirizzo email: <a href="mailto:privacy@techland.it" className="text-primary hover:underline">privacy@techland.it</a>
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Dati Raccolti</h2>
                <p className="text-muted-foreground mb-4">
                  Raccogliamo i seguenti dati personali quando utilizzi i nostri servizi:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>Dati di contatto:</strong> nome, cognome, indirizzo email, numero di telefono</li>
                  <li><strong>Dati relativi ai minori:</strong> età del bambino, interessi formativi</li>
                  <li><strong>Dati di navigazione:</strong> indirizzo IP, tipo di browser, pagine visitate</li>
                  <li><strong>Comunicazioni:</strong> messaggi inviati tramite i form di contatto o chat</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. Finalità del Trattamento</h2>
                <p className="text-muted-foreground mb-4">
                  I tuoi dati personali vengono trattati per le seguenti finalità:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Gestione delle richieste di iscrizione e prenotazione lezioni di prova</li>
                  <li>Comunicazioni relative ai servizi richiesti</li>
                  <li>Invio di informazioni sui nostri corsi (previo consenso)</li>
                  <li>Miglioramento dei nostri servizi e dell'esperienza utente</li>
                  <li>Adempimento di obblighi legali</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Base Giuridica</h2>
                <p className="text-muted-foreground">
                  Il trattamento dei dati è basato sul tuo consenso, sull'esecuzione di un contratto 
                  o di misure precontrattuali, e sull'adempimento di obblighi legali. Per quanto 
                  riguarda i dati dei minori, il consenso viene fornito dal genitore o tutore legale.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Conservazione dei Dati</h2>
                <p className="text-muted-foreground">
                  I dati personali vengono conservati per il tempo necessario a soddisfare le 
                  finalità per cui sono stati raccolti. I dati relativi alle richieste di 
                  informazioni vengono conservati per un massimo di 24 mesi. I dati relativi 
                  agli iscritti ai corsi vengono conservati per la durata del rapporto 
                  contrattuale e per i successivi 10 anni per adempimenti fiscali.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Condivisione dei Dati</h2>
                <p className="text-muted-foreground">
                  I tuoi dati non vengono venduti a terzi. Possono essere condivisi con:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Fornitori di servizi tecnici (hosting, email, pagamenti)</li>
                  <li>Consulenti professionali (commercialisti, avvocati)</li>
                  <li>Autorità competenti quando richiesto dalla legge</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. I Tuoi Diritti</h2>
                <p className="text-muted-foreground mb-4">
                  Ai sensi del GDPR, hai diritto a:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>Accesso:</strong> ottenere conferma del trattamento e copia dei tuoi dati</li>
                  <li><strong>Rettifica:</strong> correggere dati inesatti o incompleti</li>
                  <li><strong>Cancellazione:</strong> richiedere la cancellazione dei tuoi dati</li>
                  <li><strong>Limitazione:</strong> limitare il trattamento in determinati casi</li>
                  <li><strong>Portabilità:</strong> ricevere i tuoi dati in formato strutturato</li>
                  <li><strong>Opposizione:</strong> opporti al trattamento per marketing diretto</li>
                  <li><strong>Revoca del consenso:</strong> revocare il consenso in qualsiasi momento</li>
                </ul>
                <p className="text-muted-foreground mt-4">
                  Per esercitare questi diritti, contattaci a: <a href="mailto:privacy@techland.it" className="text-primary hover:underline">privacy@techland.it</a>
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. Cookie</h2>
                <p className="text-muted-foreground">
                  Il nostro sito utilizza cookie tecnici necessari per il funzionamento del sito. 
                  Non utilizziamo cookie di profilazione senza il tuo consenso esplicito. 
                  Puoi gestire le preferenze sui cookie attraverso le impostazioni del tuo browser.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Sicurezza</h2>
                <p className="text-muted-foreground">
                  Adottiamo misure tecniche e organizzative appropriate per proteggere i tuoi 
                  dati personali da accessi non autorizzati, perdita, distruzione o alterazione. 
                  Tuttavia, nessun sistema di trasmissione o archiviazione dati è completamente sicuro.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Modifiche alla Privacy Policy</h2>
                <p className="text-muted-foreground">
                  Ci riserviamo il diritto di modificare questa Privacy Policy in qualsiasi momento. 
                  Le modifiche saranno pubblicate su questa pagina con la data di ultimo aggiornamento. 
                  Ti invitiamo a consultare periodicamente questa pagina.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">11. Contatti</h2>
                <p className="text-muted-foreground">
                  Per qualsiasi domanda relativa a questa Privacy Policy o al trattamento dei 
                  tuoi dati personali, puoi contattarci:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Email: <a href="mailto:privacy@techland.it" className="text-primary hover:underline">privacy@techland.it</a></li>
                  <li>Email generale: <a href="mailto:info@techland.it" className="text-primary hover:underline">info@techland.it</a></li>
                </ul>
              </section>

              <section className="pt-8 border-t">
                <p className="text-sm text-muted-foreground">
                  Hai anche il diritto di presentare un reclamo all'Autorità Garante per la 
                  Protezione dei Dati Personali (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.garanteprivacy.it</a>).
                </p>
              </section>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
