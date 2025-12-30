import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";

export default function Cookie() {
  return (
    <Layout>
      <SEOHead
        title="Cookie Policy | TECHLAND"
        description="Informativa sui cookie di TECHLAND. Scopri quali cookie utilizziamo e come gestire le tue preferenze."
        canonical="/cookie"
      />
      
      <div className="pt-32 pb-16">
        <div className="tech-container">
          <div className="max-w-4xl mx-auto">
            <SEOBreadcrumb 
              items={[{ label: "Cookie Policy" }]} 
              className="mb-8"
            />
            <h1 className="text-4xl font-bold mb-8">Cookie Policy</h1>
            
            <div className="prose prose-lg max-w-none space-y-8">
              <p className="text-muted-foreground text-lg">
                Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Cosa sono i cookie</h2>
                <p className="text-muted-foreground">
                  I cookie sono piccoli file di testo che vengono memorizzati sul tuo dispositivo quando visiti un sito web. Sono ampiamente utilizzati per far funzionare i siti web in modo più efficiente e per fornire informazioni ai proprietari del sito.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Come utilizziamo i cookie</h2>
                <p className="text-muted-foreground">
                  TECHLAND utilizza i cookie per diversi scopi:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>Cookie essenziali:</strong> Necessari per il funzionamento del sito web. Includono cookie che ti permettono di accedere alle aree sicure del nostro sito.</li>
                  <li><strong>Cookie funzionali:</strong> Ci permettono di ricordare le scelte che fai (come la lingua o la regione) e fornire funzionalità migliorate e più personalizzate.</li>
                  <li><strong>Cookie analitici:</strong> Ci aiutano a capire come i visitatori interagiscono con il nostro sito web, raccogliendo informazioni in forma anonima.</li>
                  <li><strong>Cookie di marketing:</strong> Vengono utilizzati per tracciare i visitatori attraverso i siti web. L'intento è quello di visualizzare annunci pertinenti e coinvolgenti per il singolo utente.</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Tipi di cookie che utilizziamo</h2>
                
                <div className="space-y-6">
                  <div className="p-6 rounded-xl bg-muted/30 border border-border">
                    <h3 className="text-lg font-semibold mb-2">Cookie tecnici (essenziali)</h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      Questi cookie sono necessari per il funzionamento del sito e non possono essere disattivati.
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Sessione utente</li>
                      <li>• Preferenze di consenso cookie</li>
                      <li>• Sicurezza e autenticazione</li>
                    </ul>
                  </div>

                  <div className="p-6 rounded-xl bg-muted/30 border border-border">
                    <h3 className="text-lg font-semibold mb-2">Cookie analitici</h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      Utilizziamo questi cookie per analizzare il traffico e migliorare la tua esperienza.
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Google Analytics - per analisi del traffico</li>
                      <li>• Durata: fino a 2 anni</li>
                    </ul>
                  </div>

                  <div className="p-6 rounded-xl bg-muted/30 border border-border">
                    <h3 className="text-lg font-semibold mb-2">Cookie di terze parti</h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      Alcuni servizi esterni che utilizziamo potrebbero impostare i propri cookie.
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• YouTube - per video incorporati</li>
                      <li>• Social media - pulsanti di condivisione</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Come gestire i cookie</h2>
                <p className="text-muted-foreground">
                  Puoi controllare e/o eliminare i cookie come desideri. Puoi eliminare tutti i cookie già presenti sul tuo dispositivo e impostare la maggior parte dei browser per impedirne l'installazione. Tuttavia, se lo fai, potresti dover regolare manualmente alcune preferenze ogni volta che visiti un sito e alcuni servizi e funzionalità potrebbero non funzionare.
                </p>
                <p className="text-muted-foreground">
                  Per gestire i cookie nel tuo browser:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>Chrome:</strong> Impostazioni {">"} Privacy e sicurezza {">"} Cookie</li>
                  <li><strong>Firefox:</strong> Opzioni {">"} Privacy & Sicurezza {">"} Cookie</li>
                  <li><strong>Safari:</strong> Preferenze {">"} Privacy {">"} Cookie</li>
                  <li><strong>Edge:</strong> Impostazioni {">"} Cookie e autorizzazioni sito</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Cookie di terze parti</h2>
                <p className="text-muted-foreground">
                  In alcuni casi, utilizziamo cookie forniti da terze parti affidabili. La seguente sezione descrive quali cookie di terze parti potresti incontrare attraverso questo sito:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Questo sito utilizza Google Analytics, una delle soluzioni di analisi più diffuse e affidabili sul web, per aiutarci a capire come utilizzi il sito e come possiamo migliorare la tua esperienza.</li>
                  <li>Potremmo anche utilizzare pulsanti e/o plugin di social media che ti consentono di connetterti con il tuo social network in vari modi.</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Aggiornamenti alla policy</h2>
                <p className="text-muted-foreground">
                  Potremmo aggiornare questa Cookie Policy di tanto in tanto per riflettere, ad esempio, modifiche ai cookie che utilizziamo o per altri motivi operativi, legali o normativi. Ti invitiamo quindi a visitare regolarmente questa Cookie Policy per rimanere informato sul nostro utilizzo dei cookie e delle tecnologie correlate.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Contattaci</h2>
                <p className="text-muted-foreground">
                  Per qualsiasi domanda sui cookie che utilizziamo, contattaci all'indirizzo:
                </p>
                <p className="text-muted-foreground">
                  <strong>Email:</strong> info@techlanditalia.it
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
