import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, Sparkles, Users, Award, Shield } from "lucide-react";
const heroImage = "/images/home_page_techland.jpeg";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-tech-green-light via-background to-background dark:from-background dark:via-background dark:to-background">
      {/* Background decoration - hidden in dark mode for better contrast */}
      <div className="absolute inset-0 overflow-hidden dark:hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-tech-green/10 rounded-full blur-3xl" />
        <div className="absolute top-20 -left-20 w-72 h-72 bg-tech-teal/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-tech-cyan/10 rounded-full blur-3xl" />
      </div>

      <div className="tech-container relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-5rem)] pt-8 md:pt-2 pb-12">
          {/* Content */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-tech-teal/10 text-tech-teal text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              <span>La scuola di coding #1 per bambini in Italia</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              Corsi di programmazione per bambini e ragazzi,{" "}
              <span className="tech-gradient-text">online e divertenti</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl">
              Scopri i nostri corsi di coding per bambini e ragazzi dai 6 ai 18 anni: Scratch, Roblox, Minecraft,
              Python, Unity e molto altro. Lezioni online in piccoli gruppi con docenti esperti.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="hero" size="xl" asChild data-track-cta="hero_booking_primary">
                <Link to="/prenota">Prenota lezione gratuita</Link>
              </Button>
              <Button variant="outline" size="xl" asChild data-track-cta="hero_courses_secondary">
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
                  <Users className="w-5 h-5 shrink-0" />
                  <span className="text-2xl font-bold">1.200+</span>
                </div>
                <p className="text-sm text-muted-foreground">Studenti formati</p>
              </div>
              <div className="text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 text-tech-teal mb-1">
                  <Award className="w-5 h-5 shrink-0" />
                  <span className="text-2xl font-bold">Qualità</span>
                </div>
                <p className="text-sm text-muted-foreground">Lezioni professionali e divertenti</p>
              </div>
              <div className="text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 text-tech-cyan mb-1">
                  <Shield className="w-5 h-5 shrink-0" />
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
                    src={heroImage}
                    alt="Corsi di Roblox, Minecraft, Scratch, Python e Web per bambini e ragazzi"
                    className="w-full h-full object-cover"
                    width={504}
                    height={504}
                    loading="eager"
                    fetchPriority="high"
                  />
                </div>
              </div>
            </div>

            {/* Floating elements - positioned in front, away from main image */}
            {/* Roblox - top right corner */}
            <div
              className="absolute -top-4 right-8 z-20 p-3 rounded-2xl bg-card/95 backdrop-blur-sm shadow-tech-lg animate-bounce-slow border border-border/50"
              style={{ animationDelay: "0.2s" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <img src="/images/roblox-logo.png" alt="Roblox" className="w-7 h-7 object-contain" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Roblox</p>
                  <p className="text-xs text-muted-foreground">Crea giochi 3D</p>
                </div>
              </div>
            </div>

            {/* Scratch - top left corner */}
            <div
              className="absolute -top-2 -left-8 z-20 p-3 rounded-2xl bg-card/95 backdrop-blur-sm shadow-tech-lg animate-bounce-slow border border-border/50"
              style={{ animationDelay: "0.5s" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <span className="text-3xl">🐱</span>
                </div>
                <div>
                  <p className="font-semibold text-sm">Scratch</p>
                  <p className="text-xs text-muted-foreground">Primi passi nel coding</p>
                </div>
              </div>
            </div>

            {/* Python - middle right */}
            <div
              className="absolute bottom-8 right-2 z-20 p-3 rounded-2xl bg-card/95 backdrop-blur-sm shadow-tech-lg animate-bounce-slow border border-border/50"
              style={{ animationDelay: "1s" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <img src="/images/python-logo.png" alt="Python" className="w-7 h-7 object-contain" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Python</p>
                  <p className="text-xs text-muted-foreground">Crea giochi 2D</p>
                </div>
              </div>
            </div>

            {/* Web Dev - bottom left corner */}
            <div
              className="absolute bottom-16 -left-4 z-20 p-3 rounded-2xl bg-card/95 backdrop-blur-sm shadow-tech-lg animate-bounce-slow border border-border/50"
              style={{ animationDelay: "1.5s" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-tech-cyan/20 flex items-center justify-center">
                  <span className="text-xl">🌐</span>
                </div>
                <div>
                  <p className="font-semibold text-sm">Web Dev</p>
                  <p className="text-xs text-muted-foreground">Crea siti web</p>
                </div>
              </div>
            </div>

            {/* Minecraft - bottom left, near Web Dev */}
            <div
              className="absolute -bottom-6 left-24 z-20 p-3 rounded-2xl bg-card/95 backdrop-blur-sm shadow-tech-lg animate-bounce-slow border border-border/50"
              style={{ animationDelay: "0.7s" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-green-600/20 flex items-center justify-center">
                  <img src="/images/minecraft-logo.png" alt="Minecraft" className="w-7 h-7 object-contain" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Minecraft</p>
                  <p className="text-xs text-muted-foreground">Programma con i blocchi</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
