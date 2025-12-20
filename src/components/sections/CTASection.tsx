import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, BookOpen } from "lucide-react";
import { useHasEnrollments } from "@/hooks/useHasEnrollments";
import { useAuth } from "@/hooks/useAuth";

export function CTASection() {
  const { user } = useAuth();
  const { hasEnrollments } = useHasEnrollments();
  const showTrialButton = !user || !hasEnrollments;
  return (
    <section className="tech-section bg-gradient-hero relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-10 left-10 w-32 h-32 bg-primary-foreground/10 rounded-full blur-2xl" />
        <div className="absolute bottom-10 right-10 w-48 h-48 bg-primary-foreground/10 rounded-full blur-2xl" />
      </div>

      <div className="tech-container relative z-10">
        <div className="text-center max-w-3xl mx-auto">
          {showTrialButton ? (
            <>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/20 text-primary-foreground text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                <span>Prima lezione gratuita</span>
              </div>

              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
                Il futuro di tuo figlio inizia oggi
              </h2>

              <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl mx-auto">
                Prenota una lezione di prova gratuita e scopri come TECHLAND può trasformare la curiosità del tuo bambino in competenze reali.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="secondary" size="xl" asChild>
                  <Link to="/prenota" className="gap-2">
                    Prenota lezione gratuita
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </Button>
                <Button variant="hero-outline" size="xl" asChild>
                  <Link to="/corsi">Esplora i corsi</Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/20 text-primary-foreground text-sm font-medium mb-6">
                <BookOpen className="w-4 h-4" />
                <span>Continua a imparare</span>
              </div>

              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
                Continua il tuo percorso di apprendimento
              </h2>

              <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl mx-auto">
                Accedi alla tua area riservata per continuare i tuoi corsi e scoprire nuovi contenuti.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="secondary" size="xl" asChild>
                  <Link to="/area-riservata" className="gap-2">
                    Vai ai tuoi corsi
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </Button>
                <Button variant="hero-outline" size="xl" asChild>
                  <Link to="/corsi">Scopri altri corsi</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
