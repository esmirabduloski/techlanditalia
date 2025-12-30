import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, ArrowRight, Filter } from "lucide-react";
import { SEOHead, generateBreadcrumbSchema } from "@/components/seo/SEOHead";

const allCourses = [
  {
    id: "abc-creativita-digitale",
    title: "L'ABC della creatività digitale",
    description: "Un corso per bambini incentrato sulle basi del design digitale e dell'alfabetizzazione informatica con editor grafici, Canva e Google Docs.",
    age: "5-7",
    ageLabel: "5-7 anni",
    level: "Principiante",
    duration: "32 lezioni",
    emoji: "🎨",
    tags: ["Design digitale", "Creatività", "Google Docs", "Canva", "Animazione"],
  },
  {
    id: "abc-informatica",
    title: "L'ABC dell'informatica",
    description: "FunTech Explorers è un corso online interattivo che introduce i bambini alle componenti del computer, alle basi della programmazione a blocchi e all'uso del PC.",
    age: "5-7",
    ageLabel: "5-7 anni",
    level: "Principiante",
    duration: "32 lezioni",
    emoji: "💻",
    tags: ["Programmazione", "Matematica", "Creazione", "Informatica di base", "Uso del computer"],
  },
  {
    id: "minecraft-education",
    title: "Minecraft Education",
    description: "Impara le basi della logica, della programmazione e dell'automazione attraverso l'amato ambiente di gioco di Minecraft Education con MakeCode.",
    age: "8-9",
    ageLabel: "8-9 anni",
    level: "Principiante",
    duration: "40 lezioni",
    emoji: "⛏️",
    tags: ["Minecraft", "MakeCode", "Programmazione a blocchi", "Automazione", "Redstone"],
  },
  {
    id: "scratch",
    title: "Programmazione visiva con Scratch",
    description: "Con Scratch ogni bambino dà vita a giochi e personaggi, imparando la logica della programmazione a blocchi in modo intuitivo e coinvolgente.",
    age: "8-10",
    ageLabel: "8-10 anni",
    level: "Principiante",
    duration: "32 lezioni",
    emoji: "🧩",
    tags: ["Scratch", "Creatività", "Sviluppo di giochi", "Animazione"],
  },
  {
    id: "roblox-base",
    title: "Sviluppo giochi con Roblox",
    description: "Crea giochi con Roblox Studio: progetta mondi e personaggi, imposta le tue regole e pubblica il tuo primo videogame online.",
    age: "8-12",
    ageLabel: "8+ anni",
    level: "Principiante",
    duration: "32 lezioni",
    emoji: "🏗️",
    tags: ["Roblox", "LUA", "Programmazione", "Game design"],
  },
  {
    id: "roblox-avanzato",
    title: "Roblox Avanzato",
    description: "Un corso pensato per chi usa già Roblox Studio: affina le tue abilità e crea giochi più complessi, originali e coinvolgenti.",
    age: "10-14",
    ageLabel: "10-14 anni",
    level: "Avanzato",
    duration: "32 lezioni",
    emoji: "🚀",
    tags: ["Script complessi", "Programmazione avanzata", "Meccaniche di gioco"],
  },
  {
    id: "web-development",
    title: "Web Development",
    description: "Immergiti nel mondo dello sviluppo web: impara linguaggi e stili di markup, collega siti a database, crea design e costruisci il tuo sito web.",
    age: "13-18",
    ageLabel: "13+ anni",
    level: "Principiante",
    duration: "32 lezioni",
    emoji: "🌐",
    tags: ["HTML", "CSS", "Sviluppo web", "Programmazione"],
  },
  {
    id: "unity",
    title: "Sviluppo giochi con Unity",
    description: "Dai vita alle tue idee con Unity: impara a creare ambienti 3D, progettare logiche di gioco e costruire esperienze interattive come un vero sviluppatore.",
    age: "13-18",
    ageLabel: "13+ anni",
    level: "Principiante",
    duration: "32 lezioni",
    emoji: "🎮",
    tags: ["Programmazione", "3D", "C#", "Game Engines", "Sviluppo di giochi"],
  },
  {
    id: "python-base",
    title: "Python Base",
    description: "Impara Python, il linguaggio scelto dagli sviluppatori di tutto il mondo, e crea giochi, app e siti web trasformando le tue idee in progetti reali.",
    age: "13-18",
    ageLabel: "13+ anni",
    level: "Principiante",
    duration: "32 lezioni",
    emoji: "🐍",
    tags: ["Python", "Programmazione", "Logica", "Progetti pratici"],
  },
  {
    id: "python-pro-ai",
    title: "Python PRO & AI",
    description: "Un percorso avanzato per creare bot, siti web e progetti con IA. Con Python PRO lavori su progetti reali e partecipi a un hackathon sul clima.",
    age: "13-18",
    ageLabel: "13+ anni",
    level: "Avanzato",
    duration: "32 lezioni",
    emoji: "🤖",
    tags: ["API", "HTML", "Estrazione dati", "Intelligenza artificiale"],
  },
];

const ageFilters = ["Tutti", "5-7", "8-9", "8-10", "8-12", "10-14", "13-18"];

const levelColors: Record<string, string> = {
  Principiante: "bg-tech-green/10 text-tech-green",
  Avanzato: "bg-tech-cyan/10 text-tech-cyan",
};

export default function Corsi() {
  const [ageFilter, setAgeFilter] = useState("Tutti");

  const filteredCourses = allCourses.filter((course) => {
    if (ageFilter !== "Tutti" && course.age !== ageFilter) return false;
    return true;
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Corsi di Programmazione per Bambini", url: "/corsi" }
  ]);

  const coursesListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Corsi di Programmazione per Bambini e Ragazzi TECHLAND",
    "description": "Tutti i corsi di coding e programmazione per bambini e ragazzi dai 6 ai 18 anni",
    "itemListElement": allCourses.map((course, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "Course",
        "name": course.title,
        "description": course.description,
        "url": `https://techlanditalia.it/corsi/${course.id}`,
        "provider": {
          "@type": "EducationalOrganization",
          "name": "TECHLAND"
        }
      }
    }))
  };

  return (
    <Layout>
      <SEOHead
        title="Corsi di Programmazione per Bambini e Ragazzi Online | TECHLAND"
        description="Scopri tutti i corsi di coding per bambini e ragazzi 6-18 anni: Scratch, Roblox, Minecraft, Python, Unity, Web Development. Lezioni online in piccoli gruppi."
        canonical="/corsi"
        structuredData={[breadcrumbSchema, coursesListSchema]}
      />
      
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-primary/10 via-tech-green-light to-background">
        <div className="tech-container">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Corsi di <span className="tech-gradient-text">programmazione per bambini</span> e ragazzi
            </h1>
            <p className="text-lg text-muted-foreground">
              Percorsi di coding studiati per ogni età e livello: da Scratch a Python, da Roblox a Unity. Trova il corso perfetto per il tuo bambino e inizia il viaggio nel mondo della programmazione.
            </p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 border-b border-border/50 sticky top-20 bg-background/95 backdrop-blur-sm z-40">
        <div className="tech-container">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filtri</span>
            </div>
            
            {/* Age Filter */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2">Età:</span>
              {ageFilters.map((filter) => (
                <Button
                  key={filter}
                  variant={ageFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAgeFilter(filter)}
                >
                  {filter === "Tutti" ? filter : `${filter} anni`}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Course Grid */}
      <section className="tech-section">
        <div className="tech-container">
          <p className="text-muted-foreground mb-8">
            {filteredCourses.length} {filteredCourses.length === 1 ? "corso trovato" : "corsi trovati"}
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => (
              <Link
                key={course.id}
                to={`/corsi/${course.id}`}
                className="tech-card tech-card-hover p-6 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
                    {course.emoji}
                  </div>
                  <Badge variant="outline" className={levelColors[course.level]}>
                    {course.level}
                  </Badge>
                </div>
                
                <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                  {course.title}
                </h3>
                
                <p className="text-muted-foreground mb-4 line-clamp-2">
                  {course.description}
                </p>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{course.ageLabel}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{course.duration}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {course.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                
                <div className="pt-4 border-t border-border/50">
                  <span className="text-primary font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
                    Dettagli corso
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {filteredCourses.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg mb-4">
                Nessun corso trovato con i filtri selezionati.
              </p>
              <Button variant="outline" onClick={() => setAgeFilter("Tutti")}>
                Rimuovi filtri
              </Button>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
