import { Link } from "react-router-dom";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { StaggerContainer, StaggerItem } from "@/components/animations/StaggerContainer";

/**
 * Sezione testuale ricca di keyword per migliorare il posizionamento SEO
 * sulle ricerche non-brand (corsi per bambini, corsi di scratch, ecc.).
 * Pensata per essere semantica, leggibile e link-rich verso le pagine corso.
 */
export function SEOKeywordsSection() {
  return (
    <section className="tech-section bg-muted/30 dark:bg-background dark:border-t dark:border-border/40">
      <div className="tech-container">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Corsi di programmazione per bambini online: tutte le opzioni TECHLAND
            </h2>
            <p className="text-lg text-muted-foreground">
              Cerchi <strong>corsi online per bambini</strong>,
              <strong> corsi di informatica per bambini</strong> o
              <strong> corsi di coding</strong>? TECHLAND propone percorsi live
              in piccoli gruppi (max 6 alunni) per ogni età, dai 5 ai 20 anni.
            </p>
          </ScrollReveal>

          <StaggerContainer className="grid md:grid-cols-2 gap-6 mb-10">
            <StaggerItem>
              <article className="tech-card p-6 h-full">
                <h3 className="text-xl font-semibold mb-3">
                  <Link to="/corsi/roblox" className="hover:text-primary">
                    Corsi di Roblox per bambini e ragazzi
                  </Link>
                </h3>
                <p className="text-muted-foreground">
                  Con i <strong>corsi di Roblox online</strong> ragazzi dai 10 ai 14 anni imparano
                  a creare videogiochi 3D in Roblox Studio con il linguaggio Lua. Disponibile anche
                  un corso Roblox avanzato per chi ha già le basi.
                </p>
              </article>
            </StaggerItem>

            <StaggerItem>
              <article className="tech-card p-6 h-full">
                <h3 className="text-xl font-semibold mb-3">
                  <Link to="/corsi/python-base" className="hover:text-primary">
                    Corsi di Python per ragazzi
                  </Link>
                </h3>
                <p className="text-muted-foreground">
                  I <strong>corsi di Python online</strong> sono indicati per ragazzi 12-18 anni.
                  Python è il linguaggio di programmazione più richiesto al mondo e la base per
                  imparare l'<strong>intelligenza artificiale</strong> e il machine learning.
                </p>
              </article>
            </StaggerItem>

            <StaggerItem>
              <article className="tech-card p-6 h-full">
                <h3 className="text-xl font-semibold mb-3">
                  <Link to="/corsi/web-development" className="hover:text-primary">
                    Corsi di Web Development per ragazzi
                  </Link>
                </h3>
                <p className="text-muted-foreground">
                  Con il <strong>corso di Web Development</strong> ragazzi 12-16 anni imparano
                  HTML, CSS e JavaScript da zero per creare siti web responsive e pubblicarli online.
                </p>
              </article>
            </StaggerItem>
          </StaggerContainer>

          <ScrollReveal>
            <div className="tech-card p-8 bg-primary/5 border border-primary/20">
              <h3 className="text-2xl font-semibold mb-4 text-center">
                Perché scegliere TECHLAND per i corsi di coding online dei tuoi figli
              </h3>
              <p className="text-muted-foreground mb-4">
                TECHLAND è una <strong>scuola di coding online italiana</strong> specializzata in
                <strong> corsi di programmazione per bambini e ragazzi</strong> dai 5 ai 20 anni.
                Tutti i nostri <strong>corsi di coding</strong> e <strong>corsi di informatica per bambini</strong>
                si svolgono in diretta, in piccoli gruppi di massimo 6 alunni, con docenti professionisti
                del settore tech formati sulla didattica per i più giovani.
              </p>
              <p className="text-muted-foreground mb-4">
                Offriamo <strong>corsi di Scratch</strong>, <strong>corsi di Roblox</strong>,
                <strong> corsi di Minecraft</strong>, <strong>corsi di Python</strong>,
                Web Development e percorsi di intelligenza artificiale (AI). La <strong>prima lezione
                è gratuita e senza impegno</strong>, così puoi capire se il corso è adatto al tuo bambino
                prima di iscriverti.
              </p>
              <p className="text-muted-foreground">
                I nostri <strong>corsi online per bambini</strong> sono disponibili in tutta Italia:
                basta un computer e una connessione internet stabile.
                <Link to="/corsi" className="text-primary font-semibold hover:underline ml-1">
                  Scopri tutti i corsi di programmazione per bambini →
                </Link>
              </p>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
