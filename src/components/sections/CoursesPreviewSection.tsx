import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock, Users } from "lucide-react";
import { CourseEmoji } from "@/components/ui/CourseEmoji";

const courses = [
  {
    id: "abc-creativita-digitale",
    title: "L'ABC della creatività digitale",
    description: "Design digitale e alfabetizzazione informatica per i più piccoli.",
    age: "5-7 anni",
    level: "Principiante",
    duration: "32 lezioni",
    emoji: "🎨",
    color: "tech-purple",
  },
  {
    id: "minecraft-education",
    title: "Minecraft Education",
    description: "Programmazione e automazione nell'amato mondo di Minecraft.",
    age: "8+ anni",
    level: "Principiante",
    duration: "40 lezioni",
    emoji: "⛏️",
    color: "tech-green",
  },
  {
    id: "abc-informatica",
    title: "L'ABC dell'informatica",
    description: "Introduzione alle componenti del computer, programmazione a blocchi e uso del PC.",
    age: "6-8 anni",
    level: "Principiante",
    duration: "32 lezioni",
    emoji: "💻",
    color: "tech-green",
  },
  {
    id: "scratch",
    title: "Programmazione visiva con Scratch",
    description: "Dai vita a giochi e personaggi imparando la programmazione a blocchi.",
    age: "8-10 anni",
    level: "Principiante",
    duration: "32 lezioni",
    emoji: "🧩",
    color: "tech-teal",
  },
  {
    id: "roblox",
    title: "Sviluppo giochi con Roblox",
    description: "Crea giochi con Roblox Studio e pubblica il tuo primo videogame online.",
    age: "8+ anni",
    level: "Principiante",
    duration: "32 lezioni",
    emoji: "🏗️",
    color: "tech-cyan",
  },
  {
    id: "unity",
    title: "Sviluppo giochi con Unity",
    description: "Crea ambienti 3D e costruisci esperienze interattive come un vero sviluppatore.",
    age: "13+ anni",
    level: "Principiante",
    duration: "32 lezioni",
    emoji: "🎮",
    color: "tech-blue",
  },
  {
    id: "python-ai",
    title: "Python PRO & AI",
    description: "Crea bot, siti web e progetti con intelligenza artificiale.",
    age: "13+ anni",
    level: "Avanzato",
    duration: "32 lezioni",
    emoji: "🤖",
    color: "tech-emerald",
  },
];

const levelColors: Record<string, string> = {
  Principiante: "bg-tech-green/10 text-tech-green",
  Avanzato: "bg-tech-cyan/10 text-tech-cyan",
};

export function CoursesPreviewSection() {
  return (
    <section className="tech-section bg-muted/30">
      <div className="tech-container">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">Percorsi di studio</h2>
            <p className="text-lg text-muted-foreground max-w-xl">
              Ogni percorso è progettato per l'età e il livello del tuo bambino. Scopri quello perfetto per lui.
            </p>
          </div>
          <Button variant="outline" size="lg" asChild>
            <Link to="/corsi" className="gap-2">
              Vedi tutti i corsi
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.slice(0, 6).map((course) => (
            <Link key={course.id} to={`/corsi/${course.id}`} className="tech-card tech-card-hover p-6 group">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 rounded-2xl bg-${course.color}/10 flex items-center justify-center`}>
                  <CourseEmoji emoji={course.emoji} size="lg" />
                </div>
                <Badge variant="outline" className={levelColors[course.level]}>
                  {course.level}
                </Badge>
              </div>

              <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">{course.title}</h3>

              <p className="text-muted-foreground mb-4 line-clamp-2">{course.description}</p>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{course.age}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{course.duration}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border/50">
                <span className="text-primary font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
                  Scopri di più
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
