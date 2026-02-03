import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Eye, Video, BarChart3, Shield, MessageSquare, Clock } from "lucide-react";

const parentFeatures = [
  {
    icon: Eye,
    title: "Monitoraggio in tempo reale",
    description: "Accedi alla dashboard genitori per vedere progressi, partecipazione e feedback dei docenti.",
  },
  {
    icon: Video,
    title: "Registrazioni delle lezioni",
    description: "Ogni lezione viene registrata. Rivedi con il tuo bambino i concetti più importanti.",
  },
  {
    icon: BarChart3,
    title: "Report dettagliati",
    description: "Analisi delle performance, punti di forza e aree di miglioramento del tuo bambino.",
  },
  {
    icon: Shield,
    title: "Sicurezza garantita",
    description: "Ambiente online protetto, docenti verificati, nessuna interazione con esterni.",
  },
  {
    icon: MessageSquare,
    title: "Supporto dedicato",
    description: "Un tutor di riferimento per ogni dubbio. Chat, email o chiamata: siamo sempre disponibili.",
  },
  {
    icon: Clock,
    title: "Flessibilità totale",
    description: "Recupera le lezioni perse, cambia orario quando vuoi, pausa in qualsiasi momento.",
  },
];

export function ParentsSection() {
  return (
    <section className="tech-section bg-gradient-to-br from-tech-green-light via-background to-tech-cyan-light dark:from-background dark:via-background dark:to-background">
      <div className="tech-container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              Per i{" "}
              <span className="tech-gradient-text">genitori</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Sappiamo quanto sia importante per te sapere cosa fa tuo figlio online. Con TECHLAND hai il controllo completo e la tranquillità che meriti.
            </p>
            <Button variant="cta" size="lg" asChild>
              <Link to="/prenota">Scopri di più</Link>
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {parentFeatures.map((feature) => (
              <div
                key={feature.title}
                className="p-5 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 hover:shadow-tech-md transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold mb-2">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
