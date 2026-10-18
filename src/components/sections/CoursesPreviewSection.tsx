import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock, Users } from "lucide-react";
import { CourseEmoji } from "@/components/ui/CourseEmoji";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { StaggerContainer, StaggerItem } from "@/components/animations/StaggerContainer";
import { BUILD_COURSES } from "@/lib/buildCourseFacts";

// Corsi in evidenza e colore della card. Nome, emoji, descrizione, livello,
// durata ed età vengono dalla tabella courses (letta a build-time), come in
// ogni altra pagina: un corso senza dati non viene mostrato.
const featured = [
  { id: "roblox", color: "tech-cyan" },
  { id: "roblox-avanzato", color: "tech-cyan" },
  { id: "web-development", color: "tech-blue" },
  { id: "python-base", color: "tech-emerald" },
  { id: "python-ai", color: "tech-emerald" },
];

const courses = featured.flatMap(({ id, color }) => (BUILD_COURSES[id] ? [{ ...BUILD_COURSES[id], color }] : []));

const levelColors: Record<string, string> = {
  Principiante: "bg-tech-green/10 text-tech-green",
  Intermedio: "bg-tech-blue/10 text-tech-blue",
  Avanzato: "bg-tech-cyan/10 text-tech-cyan",
};

export function CoursesPreviewSection() {
  return (
    <section className="tech-section bg-muted/30">
      <div className="tech-container">
        <ScrollReveal className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
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
        </ScrollReveal>

        <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.slice(0, 6).map((course) => (
            <StaggerItem key={course.slug}>
              <Link to={`/corsi/${course.slug}`} className="tech-card tech-card-hover p-6 group block h-full">
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
                  {course.ageRange && (
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{course.ageRange}</span>
                    </div>
                  )}
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
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
