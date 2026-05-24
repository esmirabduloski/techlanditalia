import { GraduationCap, Users, Rocket, Shield } from "lucide-react";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { StaggerContainer, StaggerItem } from "@/components/animations/StaggerContainer";

const features = [
  {
    icon: GraduationCap,
    title: "Docenti esperti e verificati",
    description: "I nostri insegnanti sono professionisti del settore tech, formati per insegnare ai giovani con metodologie coinvolgenti.",
    color: "tech-green",
  },
  {
    icon: Users,
    title: "Percorsi per ogni età",
    description: "Corsi studiati per 3 fasce d'età (6-8, 9-12, 13-18) con contenuti adatti al livello di sviluppo cognitivo.",
    color: "tech-teal",
  },
  {
    icon: Rocket,
    title: "Progetti reali e creativi",
    description: "I bambini creano giochi, siti web, mondi Roblox e app. Imparano facendo, non solo guardando.",
    color: "tech-cyan",
  },
  {
    icon: Shield,
    title: "Ambiente sicuro per i genitori",
    description: "Accesso completo ai progressi, registrazioni delle lezioni e supporto dedicato. Sicurezza online garantita.",
    color: "tech-blue",
  },
];

export function WhyTechlandSection() {
  return (
    <section className="tech-section bg-background dark:border-t dark:border-border/40">
      <div className="tech-container">
        <ScrollReveal className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Perché scegliere{" "}
            <span className="tech-gradient-text">TECHLAND</span>?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Non siamo solo una scuola di coding. Siamo il partner educativo che prepara i tuoi figli per il futuro digitale.
          </p>
        </ScrollReveal>
        <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="tech-card tech-card-hover p-8 text-center group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`w-16 h-16 mx-auto mb-6 rounded-2xl bg-${feature.color}/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className={`w-8 h-8 text-${feature.color}`} />
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
