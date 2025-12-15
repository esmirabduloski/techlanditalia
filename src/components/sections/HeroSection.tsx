import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, Sparkles, Users, Award, Shield } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-tech-green-light via-background to-background">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-tech-green/10 rounded-full blur-3xl" />
        <div className="absolute top-20 -left-20 w-72 h-72 bg-tech-teal/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-tech-cyan/10 rounded-full blur-3xl" />
      </div>

      <div className="tech-container relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-5rem)] py-12">
          {/* Content */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-tech-teal/10 text-tech-teal text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              <span>La scuola di coding #1 per bambini in Italia</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              Coding per bambini e ragazzi,{" "}
              <span className="tech-gradient-text">divertente e sicuro</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl">
              Insegniamo ai giovani dai 6 ai 18 anni le competenze digitali del futuro attraverso progetti creativi: giochi, app, siti web e molto altro.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="hero" size="xl" asChild>
                <Link to="/prenota">
                  Prenota lezione gratuita
                </Link>
              </Button>
              <Button variant="outline" size="xl" asChild>
                <Link to="/corsi" className="gap-2">
                  <Play className="w-5 h-5" />
                  Scopri i corsi
                </Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-border/50">
              <div className="text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 text-tech-green mb-1">
                  <Users className="w-5 h-5" />
                  <span className="text-2xl font-bold">15.000+</span>
                </div>
                <p className="text-sm text-muted-foreground">Studenti formati</p>
              </div>
              <div className="text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 text-tech-teal mb-1">
                  <Award className="w-5 h-5" />
                  <span className="text-2xl font-bold">98%</span>
                </div>
                <p className="text-sm text-muted-foreground">Genitori soddisfatti</p>
              </div>
              <div className="text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 text-tech-cyan mb-1">
                  <Shield className="w-5 h-5" />
                  <span className="text-2xl font-bold">100%</span>
                </div>
                <p className="text-sm text-muted-foreground">Ambiente sicuro</p>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative hidden lg:block">
            <div className="relative z-10 animate-float">
              <div className="aspect-square max-w-lg mx-auto rounded-3xl bg-gradient-hero p-1">
                <div className="w-full h-full rounded-3xl bg-card flex items-center justify-center overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&w=800&q=80" 
                    alt="Bambini che imparano a programmare"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
            
            {/* Floating elements */}
            <div className="absolute top-10 -left-10 p-4 rounded-2xl bg-card shadow-tech-lg animate-bounce-slow" style={{ animationDelay: "0.5s" }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-tech-teal/20 flex items-center justify-center">
                  <span className="text-2xl">🎮</span>
                </div>
                <div>
                  <p className="font-semibold text-sm">Game Dev</p>
                  <p className="text-xs text-muted-foreground">Crea i tuoi giochi</p>
                </div>
              </div>
            </div>
            
            <div className="absolute bottom-20 -right-5 p-4 rounded-2xl bg-card shadow-tech-lg animate-bounce-slow" style={{ animationDelay: "1s" }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-tech-cyan/20 flex items-center justify-center">
                  <span className="text-2xl">🌐</span>
                </div>
                <div>
                  <p className="font-semibold text-sm">Web Dev</p>
                  <p className="text-xs text-muted-foreground">Costruisci siti web</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
