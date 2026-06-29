import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, BookOpen, Loader2 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SEOHead, generateBreadcrumbSchema } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";
import { supabase } from "@/integrations/supabase/client";

interface Term {
  id: string;
  term: string;
  slug: string;
  definition: string;
  short_definition: string | null;
  category: string;
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: "all", label: "Tutti" },
  { value: "general", label: "Generale" },
  { value: "scratch", label: "Scratch" },
  { value: "python", label: "Python" },
  { value: "roblox", label: "Roblox" },
  { value: "ai", label: "AI" },
  { value: "web", label: "Web" },
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function Glossario() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [letter, setLetter] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("glossary_terms")
      .select("id, term, slug, definition, short_definition, category")
      .eq("is_published", true)
      .order("term", { ascending: true })
      .then(({ data }) => {
        setTerms((data || []) as Term[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    return terms.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (letter && t.term[0].toUpperCase() !== letter) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !t.term.toLowerCase().includes(q) &&
          !t.definition.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [terms, category, letter, query]);

  const availableLetters = useMemo(
    () => new Set(terms.map((t) => t.term[0].toUpperCase())),
    [terms]
  );

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Glossario", url: "/glossario" },
  ]);

  const definedTermSchema = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "Glossario TECHLAND di programmazione e AI",
    hasDefinedTerm: terms.map((t) => ({
      "@type": "DefinedTerm",
      "@id": `https://techlanditalia.it/glossario#${t.slug}`,
      name: t.term,
      description: t.short_definition || t.definition.slice(0, 200),
      inDefinedTermSet: "https://techlanditalia.it/glossario",
    })),
  };

  return (
    <Layout>
      <SEOHead
        title="Glossario Coding e AI per Bambini e Ragazzi | TECHLAND"
        description="Glossario completo dei termini di programmazione, coding, Scratch, Python, Roblox e intelligenza artificiale spiegati semplicemente per bambini e ragazzi."
        canonical="/glossario"
        structuredData={[breadcrumbSchema, definedTermSchema]}
      />

      <section className="py-12 md:py-16 bg-gradient-to-b from-primary/10 to-background dark:from-background dark:to-background">
        <div className="tech-container">
          <SEOBreadcrumb items={[{ label: "Glossario" }]} className="mb-6" />
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
              <BookOpen className="w-4 h-4" /> {terms.length} termini spiegati
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Glossario <span className="tech-gradient-text">Coding & AI</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Tutti i termini del mondo della programmazione spiegati in modo semplice per bambini e ragazzi.
            </p>
          </div>

          <div className="mt-8 max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca un termine..."
                className="pl-10"
                aria-label="Cerca un termine"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-6 border-b border-border/50 sticky top-20 bg-background/95 backdrop-blur-sm z-30">
        <div className="tech-container space-y-3">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Button
                key={c.value}
                size="sm"
                variant={category === c.value ? "default" : "outline"}
                onClick={() => setCategory(c.value)}
              >
                {c.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={letter === null ? "secondary" : "ghost"}
              onClick={() => setLetter(null)}
              className="h-7 px-2 text-xs"
            >
              Tutte
            </Button>
            {ALPHABET.map((l) => {
              const has = availableLetters.has(l);
              return (
                <Button
                  key={l}
                  size="sm"
                  variant={letter === l ? "secondary" : "ghost"}
                  disabled={!has}
                  onClick={() => setLetter(l)}
                  className="h-7 w-7 p-0 text-xs"
                >
                  {l}
                </Button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="tech-section">
        <div className="tech-container">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">Nessun termine trovato.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((t) => (
                <article
                  key={t.id}
                  id={t.slug}
                  className="tech-card p-5 scroll-mt-32"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="text-lg font-semibold">{t.term}</h2>
                    <Badge variant="outline" className="text-xs capitalize">
                      {t.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {t.definition}
                  </p>
                </article>
              ))}
            </div>
          )}

          <div className="mt-12 text-center text-sm text-muted-foreground">
            Manca un termine?{" "}
            <Link to="/contatti" className="text-primary hover:underline">
              Scrivici
            </Link>
            .
          </div>
        </div>
      </section>
    </Layout>
  );
}
