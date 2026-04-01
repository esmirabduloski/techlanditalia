import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";

export default function Accessibilita() {
  return (
    <Layout>
      <SEOHead
        title="Dichiarazione di Accessibilità | TECHLAND"
        description="Dichiarazione di accessibilità e conformità WCAG 2.1 del sito TECHLAND. Il nostro impegno per un'esperienza digitale inclusiva."
        canonical="/accessibilita"
      />

      <section className="tech-section bg-gradient-to-b from-tech-green-light to-background dark:from-background dark:to-background">
        <div className="tech-container">
          <SEOBreadcrumb items={[{ label: "Accessibilità" }]} className="mb-8" />
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Dichiarazione di Accessibilità
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              TECHLAND si impegna a garantire l'accessibilità digitale per tutte le persone, incluse quelle con disabilità.
            </p>
          </div>
        </div>
      </section>

      <section className="tech-section">
        <div className="tech-container">
          <div className="max-w-3xl mx-auto prose prose-lg dark:prose-invert">
            <h2>Standard di conformità</h2>
            <p>
              Questo sito web è progettato per essere conforme alle{" "}
              <strong>Web Content Accessibility Guidelines (WCAG) 2.1</strong> al livello <strong>AA</strong>.
              Le WCAG definiscono requisiti per rendere i contenuti web più accessibili a persone con diverse disabilità,
              incluse quelle visive, uditive, motorie e cognitive.
            </p>

            <h2>Misure adottate</h2>
            <p>TECHLAND adotta le seguenti misure per garantire l'accessibilità del sito:</p>
            <ul>
              <li><strong>Navigazione da tastiera</strong>: tutti i contenuti sono raggiungibili e utilizzabili tramite tastiera, incluso un link "Salta al contenuto" per bypassare la navigazione.</li>
              <li><strong>Contrasto colori</strong>: i rapporti di contrasto rispettano il minimo di 4.5:1 per il testo normale e 3:1 per il testo grande, sia in modalità chiara che scura.</li>
              <li><strong>Screen reader</strong>: il sito utilizza markup semantico, attributi ARIA, e annunci per i cambi di pagina per garantire compatibilità con le tecnologie assistive.</li>
              <li><strong>Animazioni</strong>: le animazioni rispettano la preferenza <code lang="en">prefers-reduced-motion</code> del sistema operativo dell'utente.</li>
              <li><strong>Form accessibili</strong>: ogni campo è associato a una label descrittiva, con messaggi di errore collegati e attributi di autocompletamento.</li>
              <li><strong>Touch target</strong>: tutti gli elementi interattivi hanno una dimensione minima di 44×44 pixel sui dispositivi touch.</li>
              <li><strong>Zoom</strong>: il layout è completamente funzionante con zoom fino al 200%.</li>
              <li><strong>Regolazione testo</strong>: è disponibile un widget per aumentare o diminuire la dimensione del testo.</li>
            </ul>

            <h2>Tecnologie utilizzate</h2>
            <p>L'accessibilità di questo sito dipende dalle seguenti tecnologie:</p>
            <ul>
              <li lang="en">HTML5</li>
              <li lang="en">WAI-ARIA</li>
              <li lang="en">CSS</li>
              <li lang="en">JavaScript</li>
            </ul>

            <h2>Limitazioni note</h2>
            <p>
              Nonostante i nostri sforzi, alcune parti del sito potrebbero non essere completamente accessibili.
              Stiamo lavorando continuamente per identificare e risolvere eventuali problemi. Le limitazioni note includono:
            </p>
            <ul>
              <li>Contenuti incorporati di terze parti (es. widget Trustpilot) potrebbero non essere completamente accessibili.</li>
              <li>Alcuni PDF caricati potrebbero non avere una struttura completamente accessibile.</li>
            </ul>

            <h2>Feedback e contatti</h2>
            <p>
              Se riscontri problemi di accessibilità su questo sito, ti preghiamo di contattarci:
            </p>
            <ul>
              <li>Email: <a href="mailto:info@techlanditalia.it">info@techlanditalia.it</a></li>
              <li>Telefono/WhatsApp: <a href="tel:+393505813140">+39 350 581 3140</a></li>
            </ul>
            <p>
              Cercheremo di rispondere entro 5 giorni lavorativi e di risolvere il problema nel più breve tempo possibile.
            </p>

            <h2>Data di aggiornamento</h2>
            <p>Questa dichiarazione è stata aggiornata il 1 aprile 2026.</p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
