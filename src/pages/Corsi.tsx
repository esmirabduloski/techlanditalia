import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, ArrowRight, Filter, Loader2 } from "lucide-react";
import { CourseEmoji } from "@/components/ui/CourseEmoji";
import { SEOHead, generateBreadcrumbSchema } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";
import { supabase } from "@/integrations/supabase/client";

interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  emoji: string;
  level: string;
  age_range: string | null;
  duration: string | null;
}

const ageFilters = ["Tutti", "5-8", "8-10", "10-14", "12-18"];

const levelColors: Record<string, string> = {
  Principiante: "bg-tech-green/10 text-tech-green",
  Avanzato: "bg-tech-cyan/10 text-tech-cyan",
  base: "bg-tech-green/10 text-tech-green",
  intermedio: "bg-tech-blue/10 text-tech-blue",
  avanzato: "bg-tech-cyan/10 text-tech-cyan",
};

const levelLabels: Record<string, string> = {
  base: "Principiante",
  intermedio: "Intermedio",
  avanzato: "Avanzato",
};

export default function Corsi() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ageFilter, setAgeFilter] = useState("Tutti");

  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, slug, title, description, emoji, level, age_range, duration')
        .eq('is_visible', true)
        .order('title');

      if (!error && data) {
        setCourses(data);
      }
      setIsLoading(false);
    };

    fetchCourses();
  }, []);

  // Extract age range as [min, max] from strings like "8-12 anni"
  const parseAgeRange = (ageRange: string | null): [number, number] | null => {
    if (!ageRange) return null;
    const match = ageRange.match(/(\d+)-(\d+)/);
    return match ? [parseInt(match[1]), parseInt(match[2])] : null;
  };

  // Check if two age ranges overlap
  const rangesOverlap = (courseRange: [number, number], filterRange: [number, number]) => {
    return courseRange[0] <= filterRange[1] && courseRange[1] >= filterRange[0];
  };

  const filteredCourses = courses
    .filter((course) => {
      if (ageFilter !== "Tutti") {
        const courseRange = parseAgeRange(course.age_range);
        const filterRange = parseAgeRange(ageFilter + " anni");
        if (!courseRange || !filterRange) return false;
        if (!rangesOverlap(courseRange, filterRange)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const rangeA = parseAgeRange(a.age_range);
      const rangeB = parseAgeRange(b.age_range);
      if (!rangeA) return 1;
      if (!rangeB) return -1;
      return rangeA[0] - rangeB[0];
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
    "itemListElement": courses.map((course, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "Course",
        "name": course.title,
        "description": course.description,
        "url": `https://techlanditalia.it/corsi/${course.slug}`,
        "provider": {
          "@type": "EducationalOrganization",
          "name": "TECHLAND"
        }
      }
    }))
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEOHead
        title="Corsi di Programmazione per Bambini e Ragazzi Online | TECHLAND"
        description="Scopri tutti i corsi di coding per bambini e ragazzi 6-18 anni: Scratch, Roblox, Minecraft, Python, Unity, Web Development. Lezioni online in piccoli gruppi."
        canonical="/corsi"
        structuredData={[breadcrumbSchema, coursesListSchema]}
      />
      
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-primary/10 via-tech-green-light to-background dark:from-background dark:via-background dark:to-background">
        <div className="tech-container">
          <SEOBreadcrumb 
            items={[{ label: "Corsi di Programmazione per Bambini" }]} 
            className="mb-8 justify-center"
          />
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
              <span className="text-sm text-muted-foreground mr-2 flex items-center">Età:</span>
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
                to={`/corsi/${course.slug}`}
                className="tech-card tech-card-hover p-6 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
                    {course.emoji}
                  </div>
                  <Badge variant="outline" className={levelColors[course.level]}>
                    {levelLabels[course.level] || course.level}
                  </Badge>
                </div>
                
                <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                  {course.title}
                </h3>
                
                <p className="text-muted-foreground mb-4 line-clamp-2">
                  {course.description}
                </p>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  {course.age_range && (
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{course.age_range}</span>
                    </div>
                  )}
                  {course.duration && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{course.duration}</span>
                    </div>
                  )}
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