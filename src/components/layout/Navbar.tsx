import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useHasEnrollments } from "@/hooks/useHasEnrollments";
import { useStudentRole } from "@/hooks/useStudentRole";
import { useTeacherRole } from "@/hooks/useTeacherRole";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FontSizeWidget } from "@/components/accessibility/FontSizeWidget";

const navLinks = [
  { href: "/corsi", label: "Corsi", title: "Corsi di programmazione per bambini e ragazzi" },
  { href: "/chi-siamo", label: "Chi Siamo", title: "Scopri la scuola di coding TECHLAND" },
  { href: "/faq", label: "FAQ", title: "Domande frequenti sui corsi di programmazione" },
  { href: "/blog", label: "Blog", title: "Articoli e guide sul coding per bambini" },
  { href: "/contatti", label: "Contatti", title: "Contattaci per informazioni sui corsi" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { hasEnrollments } = useHasEnrollments();
  const { isStudent } = useStudentRole();
  const { isTeacher } = useTeacherRole();
  const isInAreaRiservata = location.pathname.startsWith('/area-riservata');
  const isInTeacherArea = location.pathname.startsWith('/insegnante');
  
  // Mostra bottone lezione gratuita solo se non loggato o senza iscrizioni, e non è uno studente né un insegnante
  const showTrialButton = !user || (!hasEnrollments && !isStudent && !isTeacher);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50" role="navigation" aria-label="Navigazione principale del sito">
      <div className="tech-container">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2" aria-label="TECHLAND - Torna alla homepage">
            <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">T</span>
            </div>
            <span className="text-2xl font-bold">
              <span className="text-primary">TECH</span>
              <span className="text-tech-cyan">LAND</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6" aria-label="Navigazione principale">
            <ul className="flex items-center gap-6 list-none m-0 p-0">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    title={link.title}
                    className={cn(
                      "text-sm font-medium transition-colors hover:text-primary",
                      location.pathname === link.href ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <FontSizeWidget />
            <ThemeToggle />
            {!user ? (
              <Button variant="ghost" asChild>
                <Link to="/auth">Accedi</Link>
              </Button>
            ) : isTeacher && !isInTeacherArea ? (
              <Button variant="ghost" asChild>
                <Link to="/insegnante" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Dashboard
                </Link>
              </Button>
            ) : !isTeacher && !isInAreaRiservata ? (
              <Button variant="ghost" asChild>
                <Link to="/area-riservata" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Dashboard
                </Link>
              </Button>
            ) : null}
            {showTrialButton && (
              <Button variant="cta" asChild>
                <Link to="/prenota">Lezione gratuita</Link>
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-muted min-w-[44px] min-h-[44px] flex items-center justify-center"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "Chiudi menu di navigazione" : "Apri menu di navigazione"}
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
          >
            {isOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <nav id="mobile-menu" className="lg:hidden py-4 border-t border-border/50 animate-fade-in" aria-label="Menu di navigazione mobile">
            <ul className="flex flex-col gap-2 list-none m-0 p-0">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "block px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      location.pathname === link.href
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="mt-4 px-4 flex flex-col gap-2">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Dimensione testo</span>
                  <FontSizeWidget />
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Tema</span>
                  <ThemeToggle />
                </div>
                {!user ? (
                  <Button variant="outline" asChild>
                    <Link to="/auth" onClick={() => setIsOpen(false)}>Accedi</Link>
                  </Button>
                ) : isTeacher && !isInTeacherArea ? (
                  <Button variant="outline" asChild>
                    <Link to="/insegnante" onClick={() => setIsOpen(false)} className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Dashboard
                    </Link>
                  </Button>
                ) : !isTeacher && !isInAreaRiservata ? (
                  <Button variant="outline" asChild>
                    <Link to="/area-riservata" onClick={() => setIsOpen(false)} className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Dashboard
                    </Link>
                  </Button>
                ) : null}
                {showTrialButton && (
                  <Button variant="cta" asChild>
                    <Link to="/prenota" onClick={() => setIsOpen(false)}>Lezione gratuita</Link>
                  </Button>
                )}
              </li>
            </ul>
          </nav>
        )}
      </div>
    </nav>
  );
}
