import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { Home, BookOpen, Newspaper, Calendar } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <Layout>
      <SEOHead
        title="Pagina non trovata (404) | TECHLAND"
        description="La pagina che stai cercando non esiste o è stata spostata. Esplora i nostri corsi di coding o torna alla home di TECHLAND."
        noIndex
      />
      <section className="tech-section">
        <div className="tech-container">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-sm font-semibold text-primary mb-3">Errore 404</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Pagina non trovata
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              La pagina che cercavi non esiste o è stata spostata. Nessun problema:
              puoi ripartire da qui.
            </p>

            <div className="grid sm:grid-cols-2 gap-3 max-w-md mx-auto">
              <Button asChild size="lg">
                <Link to="/"><Home className="w-4 h-4 mr-2" />Home</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/corsi"><BookOpen className="w-4 h-4 mr-2" />Corsi</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/blog"><Newspaper className="w-4 h-4 mr-2" />Blog</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/prenota"><Calendar className="w-4 h-4 mr-2" />Prenota</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default NotFound;
