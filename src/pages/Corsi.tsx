import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { publicCourseSlug } from "@/lib/courseCatalog";
import { levelLabel } from "@/lib/courseFacts";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, ArrowRight, Loader2 } from "lucide-react";
import { CourseEmoji } from "@/components/ui/CourseEmoji";
import { SEOHead, generateBreadcrumbSchema } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";
import { LearningRoadmap } from "@/components/corsi/LearningRoadmap";
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

const levelColors: Record<string, string> = {
  Principiante: "bg-tech-green/10 text-tech-green",
  Avanzato: "bg-tech-cyan/10 text-tech-cyan",
  base: "bg-tech-green/10 text-tech-green",
  intermedio: "bg-tech-blue/10 text-tech-blue",
  avanzato: "bg-tech-cyan/10 text-tech-cyan",
};


const parseAgeRange = (ageRange: string | null): [number, number] | null => {
  if (!ageRange) return null;
  const rangeMatch = ageRange.match(/(\d+)-(\d+)/);
  if (rangeMatch) return [parseInt(rangeMatch[1]), parseInt(rangeMatch[2])];
  const plusMatch = ageRange.match(/(\d+)\+/);
  if (plusMatch) return [parseInt(plusMatch[1]), 99];
  return null;
};

export default function Corsi() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const sortedCourses = [...courses].sort((a, b) => {
    const rangeA = parseAgeRange(a.age_range);
    const rangeB = parseAgeRange(b.age_range);
    if (!rangeA) return 1;
    if (!rangeB) return -1;
    return rangeA[0] - rangeB[0];
  });


  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Corso di Coding per Bambini e Ragazzi", url: "/corsi" }
  ]);

  const coursesListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Corsi di Programmazione per Bambini e Ragazzi TECHLAND",
    "description": "Tutti i corsi di coding e programmazione per bambini e ragazzi dai 5 ai 18 anni",
    "itemListElement": courses.map((course, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "Course",
        "name": course.title,
        "description": course.description,
        "url": `https://techlanditalia.it/corsi/${publicCourseSlug(course.slug)}`,
        "provider": {
          "@type": "EducationalOrganization",
          "name": "TECHLAND"
        }
      }
    }))
  };

  // Fuori dall'early-return di loading: l'head deve essere emesso anche nell'HTML
  // statico generato a build-time, quando il fetch client-side non è ancora partito.
  const seoHead = (
    <SEOHead
      title="TECHLAND | Corsi di Coding per Bambini e Ragazzi 5-18"
      description="Tutti i corsi di coding per bambini e ragazzi online: Scratch, Roblox, Minecraft, Python, Web e AI. Piccoli gruppi, docenti esperti. Prima lezione gratis!"
      canonical="/corsi"
      structuredData={[breadcrumbSchema, coursesListSchema]}
    />
  );

  if (isLoading) {
    return (
      <Layout>
        {seoHead}
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {seoHead}

      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-primary/10 via-tech-green-light to-background dark:from-background dark:via-background dark:to-background">
        <div className="tech-container">
          <SEOBreadcrumb
            items={[{ label: "Corso di Coding per Bambini e Ragazzi" }]}
            className="mb-8 justify-center"
          />
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              TECHLAND: corsi di <span className="tech-gradient-text">coding per bambini</span> e ragazzi online
            </h1>
            <p className="text-lg text-muted-foreground">
              Tutti i nostri <strong>corsi di coding online per bambini e ragazzi</strong> dai 5 ai 18 anni:
              <strong> Scratch</strong>, <strong>Roblox</strong>, <strong>Minecraft</strong>,
              <strong> Python</strong>, <strong>Web Development</strong> e <strong>informatica</strong>.
              Trova il corso perfetto e prenota la prima lezione gratuita.
            </p>
            <div className="mt-8 grid sm:grid-cols-3 gap-4 text-left">
              <div className="rounded-xl border border-border/50 bg-background p-4">
                <p className="font-semibold mb-1">Piccoli gruppi</p>
                <p className="text-sm text-muted-foreground">Lezioni online dal vivo in piccoli gruppi, con attenzione a ogni alunno.</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background p-4">
                <p className="font-semibold mb-1">Docenti esperti</p>
                <p className="text-sm text-muted-foreground">Insegnanti che seguono l'alunno passo dopo passo, dal primo codice al progetto finale.</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background p-4">
                <p className="font-semibold mb-1">Prima lezione gratuita</p>
                <p className="text-sm text-muted-foreground">Prova il corso senza impegno e scopri se è quello giusto.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Learning Roadmap */}
      <LearningRoadmap />

      {/* Course Grid */}
      <section className="tech-section">
        <div className="tech-container">
          <p className="text-muted-foreground mb-8">
            {sortedCourses.length} {sortedCourses.length === 1 ? "corso trovato" : "corsi trovati"}
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedCourses.map((course) => (
              <Link
                key={course.id}
                to={`/corsi/${publicCourseSlug(course.slug)}`}
                className="tech-card tech-card-hover p-6 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <CourseEmoji emoji={course.emoji} size="lg" />
                  </div>
                  <Badge variant="outline" className={levelColors[course.level]}>
                    {levelLabel(course.level)}
                  </Badge>
                </div>
                
                <h2 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                  {course.title}
                </h2>
                
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
        </div>
      </section>

      {/* Call to action finale */}
      <section className="tech-section bg-muted/30 border-t border-border/50">
        <div className="tech-container text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Non sai quale corso scegliere?</h2>
          <p className="text-muted-foreground mb-6">
            Prenota una lezione di prova gratuita: ti aiutiamo a trovare il percorso
            più adatto all'età e agli interessi dell'alunno.
          </p>
          <Link
            to="/prenota"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Prenota la lezione gratuita
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </Layout>
  );
}

