import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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

const levelLabels: Record<string, string> = {
  base: "Principiante",
  intermedio: "Intermedio",
  avanzato: "Avanzato",
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

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Corso di Coding per Bambini e Ragazzi", url: "/corsi" }
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
        title="Corsi di Coding per Bambini e Ragazzi 6-18 | TECHLAND"
        description="Corso di coding per bambini e ragazzi online: Scratch, Roblox, Minecraft, Python, Web Development, AI. Piccoli gruppi, docenti esperti. Prima lezione gratuita!"
        canonical="/corsi"
        keywords="corso coding, coding per bambini, corsi di coding, corsi di programmazione per bambini, corsi coding online, scuola coding bambini, lezioni programmazione online ragazzi, corsi online per bambini, corsi di informatica per bambini, corsi di scratch, corsi di roblox, corsi di python per ragazzi, corsi web development bambini, coding bambini, corso coding online"
        structuredData={[breadcrumbSchema, coursesListSchema]}
      />
      
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-primary/10 via-tech-green-light to-background dark:from-background dark:via-background dark:to-background">
        <div className="tech-container">
          <SEOBreadcrumb
            items={[{ label: "Corso di Coding per Bambini e Ragazzi" }]}
            className="mb-8 justify-center"
          />
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Corso di <span className="tech-gradient-text">Coding per Bambini</span> e Ragazzi Online
            </h1>
            <p className="text-lg text-muted-foreground">
              Tutti i nostri <strong>corsi di coding online per bambini e ragazzi</strong> dai 6 ai 18 anni:
              <strong> Scratch</strong>, <strong>Roblox</strong>, <strong>Minecraft</strong>,
              <strong> Python</strong>, <strong>Web Development</strong> e <strong>informatica</strong>.
              Trova il corso perfetto e prenota la prima lezione gratuita.
            </p>
          </div>
        </div>
      </section>

      {/* Learning Roadmap */}
      <LearningRoadmap />

      {/* Course Grid */}
      <section className="tech-section">
        <div className="tech-container">
          <p className="text-muted-foreground mb-8">
            {courses.length} {courses.length === 1 ? "corso trovato" : "corsi trovati"}
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Link
                key={course.id}
                to={`/corsi/${course.slug}`}
                className="tech-card tech-card-hover p-6 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <CourseEmoji emoji={course.emoji} size="lg" />
                  </div>
                  <Badge variant="outline" className={levelColors[course.level]}>
                    {levelLabels[course.level] || course.level}
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
    </Layout>
  );
}
