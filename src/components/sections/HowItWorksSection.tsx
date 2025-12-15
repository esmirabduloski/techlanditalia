import { BookOpen, Calendar, Video, BarChart3 } from "lucide-react";

const steps = [
  {
    step: 1,
    icon: BookOpen,
    title: "Scegli il corso",
    description: "Esplora i nostri percorsi e trova quello più adatto all'età e agli interessi del tuo bambino.",
    color: "tech-purple",
  },
  {
    step: 2,
    icon: Calendar,
    title: "Prenota la prova",
    description: "Prenota una lezione gratuita di prova per far conoscere TECHLAND al tuo bambino.",
    color: "tech-orange",
  },
  {
    step: 3,
    icon: Video,
    title: "Segui le lezioni live",
    description: "Lezioni online in piccoli gruppi con docenti esperti. Interazione e divertimento garantiti.",
    color: "tech-cyan",
  },
  {
    step: 4,
    icon: BarChart3,
    title: "Monitora i progressi",
    description: "Ricevi report dettagliati, accedi alle registrazioni e vedi i progetti realizzati.",
    color: "tech-green",
  },
];

export function HowItWorksSection() {
  return (
    <section className="tech-section bg-background">
      <div className="tech-container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Come funziona
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Iniziare è semplicissimo. In 4 step il tuo bambino sarà pronto a scoprire il mondo del coding.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((item, index) => (
            <div key={item.step} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-border to-transparent" />
              )}
              
              <div className="text-center relative z-10">
                <div className={`w-24 h-24 mx-auto mb-6 rounded-3xl bg-${item.color}/10 flex items-center justify-center relative`}>
                  <item.icon className={`w-10 h-10 text-${item.color}`} />
                  <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full bg-${item.color} text-primary-foreground flex items-center justify-center font-bold text-sm`}>
                    {item.step}
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
