import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Gamepad2, Code2, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Stage {
  id: string;
  title: string;
  age: string;
  description: string;
  badge: string;
  icon: typeof Sparkles;
  courses: { label: string; slug: string }[];
  accent: string;
}

const stages: Stage[] = [
  {
    id: "foundations",
    title: "Fondamenta visuali",
    age: "6-9 anni",
    description: "Primi passi col coding a blocchi: logica, sequenze, creatività.",
    badge: "Inizia qui",
    icon: Sparkles,
    courses: [
      { label: "Scratch", slug: "programmazione-visiva-con-scratch" },
      { label: "Minecraft", slug: "programmazione-visiva-con-minecraft" },
    ],
    accent: "from-tech-green to-tech-green/40",
  },
  {
    id: "game-design",
    title: "Game design",
    age: "9-13 anni",
    description: "Costruire giochi veri con Lua: variabili, eventi, scripting.",
    badge: "Livello 2",
    icon: Gamepad2,
    courses: [
      { label: "Roblox Base", slug: "roblox" },
      { label: "Roblox Avanzato", slug: "roblox-avanzato" },
    ],
    accent: "from-tech-blue to-tech-blue/40",
  },
  {
    id: "real-coding",
    title: "Coding reale",
    age: "11-16 anni",
    description: "Python: il linguaggio più usato al mondo, dal pensiero algoritmico ai progetti veri.",
    badge: "Livello 3",
    icon: Code2,
    courses: [
      { label: "Python Base", slug: "python-base" },
    ],
    accent: "from-tech-cyan to-tech-cyan/40",
  },
  {
    id: "ai-future",
    title: "AI & futuro",
    age: "14-18 anni",
    description: "Intelligenza artificiale, machine learning e progetti che usano modelli generativi.",
    badge: "Livello 4",
    icon: Brain,
    courses: [
      { label: "Python + AI", slug: "python-ai" },
    ],
    accent: "from-primary to-tech-cyan",
  },
];

export function LearningRoadmap() {
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Percorso di apprendimento TECHLAND: da Scratch a Python a AI",
    description:
      "Roadmap pedagogica per imparare a programmare dai 6 ai 18 anni: dal coding visuale fino all'intelligenza artificiale.",
    itemListElement: stages.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.title,
      description: `${s.description} (${s.age})`,
    })),
  };

  return (
    <section className="py-12 md:py-16 border-b border-border/50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <div className="tech-container">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge variant="outline" className="mb-3 bg-primary/10 text-primary border-primary/30">
            Percorso consigliato
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Da <span className="tech-gradient-text">Scratch</span> a{" "}
            <span className="tech-gradient-text">Python</span> a{" "}
            <span className="tech-gradient-text">AI</span>
          </h2>
          <p className="text-muted-foreground">
            Un percorso pluriennale che cresce con tuo figlio: ogni tappa prepara la successiva.
          </p>
        </div>

        {/* Desktop: horizontal */}
        <div className="hidden lg:grid grid-cols-4 gap-4 relative">
          <div className="absolute top-10 left-[12.5%] right-[12.5%] h-1 bg-gradient-to-r from-tech-green via-tech-blue via-tech-cyan to-primary rounded-full opacity-30" />
          {stages.map((stage, i) => {
            const Icon = stage.icon;
            return (
              <div key={stage.id} className="relative flex flex-col items-center text-center group">
                <div
                  className={`relative z-10 w-20 h-20 rounded-full bg-gradient-to-br ${stage.accent} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-9 h-9 text-white" strokeWidth={2.2} />
                  <span className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-background border-2 border-primary text-xs font-bold flex items-center justify-center text-primary">
                    {i + 1}
                  </span>
                </div>
                <Badge variant="secondary" className="mb-2 text-xs">
                  {stage.badge}
                </Badge>
                <h3 className="font-semibold text-lg mb-1">{stage.title}</h3>
                <p className="text-xs text-primary font-medium mb-2">{stage.age}</p>
                <p className="text-sm text-muted-foreground mb-4 px-2">{stage.description}</p>
                <div className="flex flex-col gap-1.5 w-full mt-auto">
                  {stage.courses.map((c) => (
                    <Link
                      key={c.slug}
                      to={`/corsi/${c.slug}`}
                      className="text-sm font-medium text-primary hover:text-primary/80 flex items-center justify-center gap-1 group/link"
                    >
                      {c.label}
                      <ArrowRight className="w-3 h-3 group-hover/link:translate-x-1 transition-transform" />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile/Tablet: vertical */}
        <div className="lg:hidden flex flex-col gap-4 relative">
          <div className="absolute top-0 bottom-0 left-10 w-1 bg-gradient-to-b from-tech-green via-tech-blue via-tech-cyan to-primary rounded-full opacity-30" />
          {stages.map((stage, i) => {
            const Icon = stage.icon;
            return (
              <div key={stage.id} className="relative flex gap-4 items-start pl-0">
                <div
                  className={`relative z-10 flex-shrink-0 w-20 h-20 rounded-full bg-gradient-to-br ${stage.accent} flex items-center justify-center shadow-lg`}
                >
                  <Icon className="w-8 h-8 text-white" strokeWidth={2.2} />
                  <span className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-background border-2 border-primary text-xs font-bold flex items-center justify-center text-primary">
                    {i + 1}
                  </span>
                </div>
                <div className="flex-1 tech-card p-4">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {stage.badge}
                    </Badge>
                    <span className="text-xs text-primary font-medium">{stage.age}</span>
                  </div>
                  <h3 className="font-semibold text-lg mb-1">{stage.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{stage.description}</p>
                  <div className="flex flex-wrap gap-3">
                    {stage.courses.map((c) => (
                      <Link
                        key={c.slug}
                        to={`/corsi/${c.slug}`}
                        className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1"
                      >
                        {c.label}
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
