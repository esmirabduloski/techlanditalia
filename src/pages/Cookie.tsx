import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";

/**
 * Cookie Policy: elenco REALE di cookie e memorizzazioni usate dal sito.
 * Non ci sono cookie di profilazione né Google Analytics/Meta Pixel; le
 * statistiche sono di prima parte, senza IP. Se aggiungi uno script di terze
 * parti (tag manager, pixel, chat esterna) va aggiunto qui e valutato il banner.
 */
const LAST_UPDATE = "13 settembre 2026";

type Row = { name: string; type: string; purpose: string; duration: string };

const TECHNICAL: Row[] = [
  {
    name: "sb-…-auth-token",
    type: "localStorage",
    purpose: "Mantiene l'accesso all'area riservata (genitori, studenti, insegnanti, admin).",
    duration: "Fino al logout",
  },
  {
    name: "theme",
    type: "localStorage",
    purpose: "Ricorda la preferenza tema chiaro/scuro.",
    duration: "Fino a modifica",
  },
  {
    name: "sidebar:state",
    type: "cookie",
    purpose: "Ricorda se il menu laterale dell'area amministrativa è aperto o chiuso.",
    duration: "7 giorni",
  },
  {
    name: "referral_code",
    type: "sessionStorage",
    purpose: "Conserva il codice \"presenta un amico\" arrivato dal link, per attribuire il vantaggio.",
    duration: "Chiusura del browser",
  },
  {
    name: "dismissed_homework_notifications",
    type: "localStorage",
    purpose: "Ricorda gli avvisi sui compiti già chiusi dallo studente.",
    duration: "Fino a modifica",
  },
  {
    name: "impersonation",
    type: "sessionStorage",
    purpose: "Solo per gli amministratori: modalità \"vedi come l'utente\" per l'assistenza.",
    duration: "Chiusura del browser",
  },
];

const STATS: Row[] = [
  {
    name: "analytics_session_id",
    type: "sessionStorage",
    purpose:
      "Distingue una visita dall'altra per contare pagine viste, click sui pulsanti e tempo di lettura. Nessun indirizzo IP, nessun tracciamento su altri siti.",
    duration: "Chiusura del browser",
  },
  {
    name: "session-id (statistiche di hosting)",
    type: "cookie / storage",
    purpose:
      "Statistiche aggregate di traffico fornite dalla piattaforma di hosting (Lovable): misura le visite complessive, non costruisce profili né segue i visitatori tra visite diverse.",
    duration: "30 minuti",
  },
];

const THIRD_PARTIES = [
  {
    name: "Stripe",
    where: "Solo durante il pagamento di un corso",
    note: "Cookie tecnici e antifrode di Stripe sulle pagine di checkout.",
    link: "https://stripe.com/it/privacy",
  },
  {
    name: "YouTube (Google)",
    where: "Solo nelle lezioni dell'area riservata che incorporano un video",
    note: "I video sono caricati in modalità privacy-enhanced (youtube-nocookie.com): nessun cookie finché non avvii il video.",
    link: "https://policies.google.com/privacy",
  },
  {
    name: "Trustpilot",
    where: "Solo nella dashboard dell'area riservata",
    note: "Widget per lasciare una recensione.",
    link: "https://legal.trustpilot.com/for-reviewers/end-user-privacy-terms",
  },
  {
    name: "Google Firebase",
    where: "Solo se attivi le notifiche push",
    note: "Identificativo del dispositivo per recapitare le notifiche; revocabile dall'area riservata.",
    link: "https://firebase.google.com/support/privacy",
  },
];

function Table({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto not-prose">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4 font-semibold">Nome</th>
            <th className="py-2 pr-4 font-semibold">Tipo</th>
            <th className="py-2 pr-4 font-semibold">A cosa serve</th>
            <th className="py-2 font-semibold">Durata</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b align-top">
              <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap">{r.name}</td>
              <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">{r.type}</td>
              <td className="py-2 pr-4 text-muted-foreground">{r.purpose}</td>
              <td className="py-2 whitespace-nowrap text-muted-foreground">{r.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Cookie() {
  return (
    <Layout>
      <SEOHead
        title="Cookie Policy | TECHLAND"
        description="Informativa sui cookie di TECHLAND: quali cookie e memorizzazioni tecniche usiamo, le statistiche di prima parte senza profilazione e come gestirli."
        canonical="/cookie"
      />

      <div className="pt-32 pb-16">
        <div className="tech-container">
          <div className="max-w-4xl mx-auto">
            <SEOBreadcrumb items={[{ label: "Cookie Policy" }]} className="mb-8" />
            <h1 className="text-4xl font-bold mb-4">Cookie Policy</h1>
            <p className="text-muted-foreground text-lg mb-8">Ultimo aggiornamento: {LAST_UPDATE}</p>

            <div className="prose prose-lg dark:prose-invert max-w-none space-y-10">
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">In breve</h2>
                <p className="text-muted-foreground">
                  Questo sito usa solo <strong>cookie e memorizzazioni tecniche</strong> (per farti restare connesso e
                  ricordare le tue preferenze) e <strong>statistiche di prima parte</strong> che non registrano l&apos;indirizzo IP
                  e non ti seguono su altri siti. <strong>Non</strong> usiamo cookie di profilazione pubblicitaria, Google
                  Analytics, pixel di social network né pulsanti di condivisione che tracciano la navigazione. Per questo
                  motivo, in linea con le Linee guida del Garante privacy del 10 giugno 2021, non ti chiediamo un consenso
                  tramite banner.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Cosa sono cookie e memorizzazioni locali</h2>
                <p className="text-muted-foreground">
                  I cookie sono piccoli file di testo che il browser conserva per conto di un sito; localStorage e
                  sessionStorage sono memorie del browser con la stessa funzione. Servono, ad esempio, a non chiederti la
                  password a ogni pagina. La normativa (art. 122 Codice Privacy e GDPR) li tratta allo stesso modo: per questo
                  li elenchiamo tutti.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Cookie e memorizzazioni tecniche (necessari)</h2>
                <p className="text-muted-foreground">
                  Indispensabili per il funzionamento del sito e dell&apos;area riservata: non richiedono consenso e non possono
                  essere disattivati senza perdere le relative funzioni.
                </p>
                <Table rows={TECHNICAL} />
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Statistiche di prima parte</h2>
                <p className="text-muted-foreground">
                  Ci servono a capire quali pagine e quali pulsanti funzionano meglio. I dati sono raccolti direttamente da noi,
                  senza indirizzo IP, e i dati grezzi vengono cancellati dopo 30 giorni; non vengono condivisi con circuiti
                  pubblicitari né incrociati con altri siti.
                </p>
                <Table rows={STATS} />
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Servizi di terze parti (solo in aree specifiche)</h2>
                <p className="text-muted-foreground">
                  Nelle pagine pubbliche non è caricato alcuno script di terze parti. I seguenti servizi intervengono solo nei
                  contesti indicati e possono impostare cookie propri, regolati dalle rispettive informative:
                </p>
                <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
                  {THIRD_PARTIES.map((t) => (
                    <li key={t.name}>
                      <strong>{t.name}</strong> — {t.where}. {t.note}{" "}
                      <a href={t.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Informativa
                      </a>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Come gestirli</h2>
                <p className="text-muted-foreground">
                  Puoi cancellare o bloccare cookie e memorizzazioni dalle impostazioni del browser (Chrome: Impostazioni →
                  Privacy e sicurezza → Cookie; Firefox: Impostazioni → Privacy e sicurezza; Safari: Preferenze → Privacy;
                  Edge: Impostazioni → Cookie e autorizzazioni sito). Bloccando quelli tecnici non potrai accedere all&apos;area
                  riservata. Le notifiche push si disattivano dalla tua area riservata; la newsletter dal link in ogni email.
                </p>
              </section>

              <section className="space-y-4 pt-6 border-t">
                <p className="text-sm text-muted-foreground">
                  Per come trattiamo i dati personali (dati raccolti dai form, account, fornitori, diritti) consulta la{" "}
                  <Link to="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                  . Domande: <a href="mailto:info@techlanditalia.it" className="text-primary hover:underline">info@techlanditalia.it</a>.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
