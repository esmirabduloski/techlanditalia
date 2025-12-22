import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useHasEnrollments } from "@/hooks/useHasEnrollments";
const navLinks = [
  { href: "/corsi", label: "Corsi" },
  { href: "/chi-siamo", label: "Chi siamo" },
  { href: "/faq", label: "FAQ" },
  { href: "/blog", label: "Blog" },
  { href: "/contatti", label: "Contatti" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { hasEnrollments } = useHasEnrollments();
  const isInAreaRiservata = location.pathname.startsWith('/area-riservata');
  
  // Mostra bottone lezione gratuita solo se non loggato o senza iscrizioni
  const showTrialButton = !user || !hasEnrollments;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="tech-container">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">T</span>
            </div>
            <span className="text-2xl font-bold">
              <span className="text-primary">TECH</span>
              <span className="text-tech-cyan">LAND</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  location.pathname === link.href ? "text-primary" : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {!user ? (
              <Button variant="ghost" asChild>
                <Link to="/auth">Accedi</Link>
              </Button>
            ) : !isInAreaRiservata ? (
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
            className="md:hidden p-2 rounded-lg hover:bg-muted"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border/50 animate-fade-in">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    location.pathname === link.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 mt-4 px-4">
                {!user ? (
                  <Button variant="outline" asChild>
                    <Link to="/auth" onClick={() => setIsOpen(false)}>Accedi</Link>
                  </Button>
                ) : !isInAreaRiservata ? (
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
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
