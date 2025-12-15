import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, ArrowRight, Filter } from "lucide-react";

const allCourses = [
  {
    id: "coding-base",
    title: "Coding Base",
    description: "Primi passi nella programmazione con Scratch e logica computazionale. Il bambino impara a pensare come un programmatore.",
    age: "6-8",
    ageLabel: "6-8 anni",
    level: "Beginner",
    type: "Coding base",
    duration: "12 settimane",
    emoji: "🎨",
  },
  {
    id: "scratch-avanzato",
    title: "Scratch Avanzato",
    description: "Progetti più complessi con Scratch: giochi multiplayer, animazioni interattive e storie animate.",
    age: "9-12",
    ageLabel: "9-12 anni",
    level: "Intermediate",
    type: "Coding base",
    duration: "12 settimane",
    emoji: "🧩",
  },
  {
    id: "game-development",
    title: "Game Development",
    description: "Crea i tuoi videogiochi 2D e 3D con Unity. Impara C# e le basi del game design professionale.",
    age: "9-12",
    ageLabel: "9-12 anni",
    level: "Intermediate",
    type: "Game dev",
    duration: "16 settimane",
    emoji: "🎮",
  },
  {
    id: "roblox-studio",
    title: "Roblox Studio",
    description: "Progetta e pubblica mondi Roblox, impara Lua scripting e monetizza le tue creazioni.",
    age: "9-12",
    ageLabel: "9-14 anni",
    level: "Beginner",
    type: "Roblox",
    duration: "12 settimane",
    emoji: "🏗️",
  },
  {
    id: "roblox-avanzato",
    title: "Roblox Avanzato",
    description: "Scripting avanzato in Lua, sistemi di gioco complessi e ottimizzazione per pubblicazione.",
    age: "13-18",
    ageLabel: "13-18 anni",
    level: "Advanced",
    type: "Roblox",
    duration: "16 settimane",
    emoji: "🚀",
  },
  {
    id: "web-development",
    title: "Web Development",
    description: "HTML, CSS e JavaScript per creare siti web interattivi e moderni. Dal design al deploy.",
    age: "13-18",
    ageLabel: "12-16 anni",
    level: "Intermediate",
    type: "Web",
    duration: "20 settimane",
    emoji: "🌐",
  },
  {
    id: "web-fullstack",
    title: "Web Fullstack",
    description: "React, Node.js e database. Crea applicazioni web complete come un professionista.",
    age: "13-18",
    ageLabel: "15-18 anni",
    level: "Advanced",
    type: "Web",
    duration: "24 settimane",
    emoji: "💻",
  },
  {
    id: "python-base",
    title: "Python Base",
    description: "Introduzione a Python, il linguaggio più richiesto. Logica, variabili, funzioni e progetti pratici.",
    age: "13-18",
    ageLabel: "12-15 anni",
    level: "Beginner",
    type: "Python/AI",
    duration: "12 settimane",
    emoji: "🐍",
  },
  {
    id: "python-ai",
    title: "Python & AI per Teen",
    description: "Programmazione avanzata con Python, machine learning e introduzione all'intelligenza artificiale.",
    age: "13-18",
    ageLabel: "14-18 anni",
    level: "Advanced",
    type: "Python/AI",
    duration: "24 settimane",
    emoji: "🤖",
  },
];

const ageFilters = ["Tutti", "6-8", "9-12", "13-18"];
const levelFilters = ["Tutti", "Beginner", "Intermediate", "Advanced"];
const typeFilters = ["Tutti", "Coding base", "Game dev", "Roblox", "Web", "Python/AI"];

const levelColors: Record<string, string> = {
  Beginner: "bg-tech-green/10 text-tech-green",
  Intermediate: "bg-tech-orange/10 text-tech-orange",
  Advanced: "bg-tech-purple/10 text-tech-purple",
};

export default function Corsi() {
  const [ageFilter, setAgeFilter] = useState("Tutti");
  const [levelFilter, setLevelFilter] = useState("Tutti");
  const [typeFilter, setTypeFilter] = useState("Tutti");

  const filteredCourses = allCourses.filter((course) => {
    if (ageFilter !== "Tutti" && course.age !== ageFilter) return false;
    if (levelFilter !== "Tutti" && course.level !== levelFilter) return false;
    if (typeFilter !== "Tutti" && course.type !== typeFilter) return false;
    return true;
  });

  return (
    <Layout>
      {/* Hero */}
      <section className="tech-section bg-gradient-to-b from-tech-purple-light to-background">
        <div className="tech-container">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              I nostri <span className="tech-gradient-text">corsi</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Percorsi studiati per ogni età e livello. Trova il corso perfetto per il tuo bambino e inizia il viaggio nel mondo del coding.
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
              <span className="text-sm font-medium">Filtra per:</span>
            </div>
            
            {/* Age Filter */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2">Età:</span>
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

            {/* Level Filter */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2">Livello:</span>
              {levelFilters.map((filter) => (
                <Button
                  key={filter}
                  variant={levelFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLevelFilter(filter)}
                >
                  {filter}
                </Button>
              ))}
            </div>

            {/* Type Filter */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2">Tipo:</span>
              {typeFilters.map((filter) => (
                <Button
                  key={filter}
                  variant={typeFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTypeFilter(filter)}
                >
                  {filter}
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
                to={`/corsi/${course.id}`}
                className="tech-card tech-card-hover p-6 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
                    {course.emoji}
                  </div>
                  <Badge variant="outline" className={levelColors[course.level]}>
                    {course.level}
                  </Badge>
                </div>
                
                <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                  {course.title}
                </h3>
                
                <p className="text-muted-foreground mb-4 line-clamp-2">
                  {course.description}
                </p>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{course.ageLabel}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{course.duration}</span>
                  </div>
                </div>

                <Badge variant="secondary" className="mb-4">{course.type}</Badge>
                
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
              <Button variant="outline" onClick={() => {
                setAgeFilter("Tutti");
                setLevelFilter("Tutti");
                setTypeFilter("Tutti");
              }}>
                Rimuovi filtri
              </Button>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
