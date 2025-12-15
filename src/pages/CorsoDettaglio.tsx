import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, Users, ArrowLeft, CheckCircle2, Calendar, 
  Monitor, Wifi, BookOpen, Target, Rocket 
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const coursesData: Record<string, {
  title: string;
  description: string;
  longDescription: string;
  age: string;
  level: string;
  duration: string;
  emoji: string;
  learnings: string[];
  projects: string[];
  requirements: string[];
  modules: { title: string; description: string }[];
  faqs: { question: string; answer: string }[];
}> = {
  "coding-base": {
    title: "Coding Base",
    description: "Primi passi nella programmazione con Scratch e logica computazionale.",
    longDescription: "Un percorso pensato per i più piccoli che vogliono scoprire il mondo della programmazione. Attraverso Scratch, il linguaggio visuale sviluppato dal MIT, i bambini imparano i fondamenti della logica computazionale divertendosi.",
    age: "6-8 anni",
    level: "Beginner",
    duration: "12 settimane",
    emoji: "🎨",
    learnings: [
      "Pensiero computazionale e problem solving",
      "Concetti base di programmazione (sequenze, cicli, condizioni)",
      "Creazione di storie interattive",
      "Design di personaggi e sfondi",
      "Logica e ragionamento",
    ],
    projects: [
      "Gioco di labirinto interattivo",
      "Storia animata con personaggi parlanti",
      "Quiz a risposta multipla",
      "Animazione musicale",
    ],
    requirements: [
      "Computer (PC o Mac)",
      "Connessione internet stabile",
      "Mouse (consigliato)",
      "Nessuna esperienza precedente richiesta",
    ],
    modules: [
      { title: "Settimana 1-2: Scopriamo Scratch", description: "Introduzione all'ambiente Scratch, primi blocchi e movimenti base." },
      { title: "Settimana 3-4: Le sequenze", description: "Impariamo a dare istruzioni ordinate ai nostri personaggi." },
      { title: "Settimana 5-6: I cicli", description: "Ripetiamo azioni e creiamo animazioni fluide." },
      { title: "Settimana 7-8: Le condizioni", description: "Se...allora: il personaggio prende decisioni!" },
      { title: "Settimana 9-10: Interattività", description: "Aggiungiamo controlli da tastiera e mouse." },
      { title: "Settimana 11-12: Progetto finale", description: "Creiamo un gioco completo da condividere con amici e famiglia." },
    ],
    faqs: [
      { question: "Mio figlio è troppo piccolo?", answer: "Il corso è pensato per bambini dai 6 anni. Utilizziamo un approccio visuale che non richiede di saper leggere o scrivere fluentemente." },
      { question: "Quanto durano le lezioni?", answer: "Ogni lezione dura 60 minuti, una volta a settimana. La durata è ottimizzata per l'attenzione dei bambini di questa età." },
      { question: "Mio figlio deve saper usare il computer?", answer: "No, insegniamo anche le basi dell'uso del computer nelle prime lezioni." },
    ],
  },
  "game-development": {
    title: "Game Development",
    description: "Crea i tuoi videogiochi 2D e 3D con Unity.",
    longDescription: "Un percorso entusiasmante per chi sogna di creare videogiochi. Impareremo a usare Unity, uno dei motori di gioco più utilizzati al mondo, e le basi di C# per dare vita a giochi professionali.",
    age: "9-12 anni",
    level: "Intermediate",
    duration: "16 settimane",
    emoji: "🎮",
    learnings: [
      "Fondamenti di Unity e il suo editor",
      "Programmazione base in C#",
      "Game design e meccaniche di gioco",
      "Fisica e collisioni nei giochi",
      "Audio e effetti sonori",
      "Pubblicazione del gioco",
    ],
    projects: [
      "Platform game 2D",
      "Runner game infinito",
      "Puzzle game con fisica",
      "Gioco di avventura 3D semplice",
    ],
    requirements: [
      "Computer (PC o Mac con almeno 8GB RAM)",
      "Connessione internet stabile",
      "Esperienza base con il computer",
      "Passione per i videogiochi",
    ],
    modules: [
      { title: "Settimana 1-4: Introduzione a Unity", description: "Ambiente di sviluppo, scene, oggetti e componenti." },
      { title: "Settimana 5-8: C# per giochi", description: "Variabili, funzioni, input del giocatore." },
      { title: "Settimana 9-12: Meccaniche avanzate", description: "Fisica, collisioni, nemici e punteggi." },
      { title: "Settimana 13-16: Progetto finale", description: "Sviluppo completo di un gioco da pubblicare." },
    ],
    faqs: [
      { question: "Serve sapere già programmare?", answer: "No, partiamo dalle basi. Tuttavia è consigliato aver completato un corso introduttivo o avere familiarità con la logica base." },
      { question: "Che tipo di computer serve?", answer: "Unity funziona su PC e Mac. Consigliamo almeno 8GB di RAM e una scheda grafica dedicata per una migliore esperienza." },
    ],
  },
  "roblox-studio": {
    title: "Roblox Studio",
    description: "Progetta e pubblica mondi Roblox, impara Lua scripting.",
    longDescription: "Trasforma la passione per Roblox in competenze reali! Impara a creare i tuoi giochi su Roblox Studio, programma in Lua e scopri come pubblicare e condividere le tue creazioni con milioni di giocatori.",
    age: "9-14 anni",
    level: "Beginner",
    duration: "12 settimane",
    emoji: "🏗️",
    learnings: [
      "Roblox Studio e i suoi strumenti",
      "Costruzione di mondi 3D",
      "Scripting base in Lua",
      "Game design per Roblox",
      "Pubblicazione sulla piattaforma",
    ],
    projects: [
      "Obby (percorso a ostacoli)",
      "Tycoon semplice",
      "Gioco di simulazione",
      "Mondo esplorabile",
    ],
    requirements: [
      "Computer (PC o Mac)",
      "Account Roblox (gratuito)",
      "Connessione internet stabile",
    ],
    modules: [
      { title: "Settimana 1-3: Roblox Studio basics", description: "Interfaccia, strumenti di costruzione, parti e modelli." },
      { title: "Settimana 4-6: Costruzione avanzata", description: "Terreni, illuminazione, effetti speciali." },
      { title: "Settimana 7-9: Lua scripting", description: "Prime linee di codice, eventi, interazioni." },
      { title: "Settimana 10-12: Pubblicazione", description: "Game design, test e pubblicazione." },
    ],
    faqs: [
      { question: "Serve già giocare a Roblox?", answer: "No, ma aiuta ad avere familiarità con la piattaforma. Insegniamo tutto da zero." },
      { question: "I giochi creati si possono pubblicare?", answer: "Assolutamente sì! Alla fine del corso pubblicherai il tuo gioco sulla piattaforma Roblox." },
    ],
  },
  "web-development": {
    title: "Web Development",
    description: "HTML, CSS e JavaScript per creare siti web interattivi.",
    longDescription: "Impara a costruire siti web professionali da zero. Questo corso copre HTML, CSS e JavaScript, le tre tecnologie fondamentali del web, attraverso progetti pratici e creativi.",
    age: "12-16 anni",
    level: "Intermediate",
    duration: "20 settimane",
    emoji: "🌐",
    learnings: [
      "HTML5 semantico e accessibile",
      "CSS3 e design responsive",
      "JavaScript moderno",
      "Interattività e animazioni",
      "Hosting e pubblicazione",
    ],
    projects: [
      "Portfolio personale",
      "Landing page professionale",
      "Web app interattiva",
      "Clone di un sito famoso",
    ],
    requirements: [
      "Computer (PC o Mac)",
      "Connessione internet stabile",
      "Editor di codice (fornito gratuitamente)",
    ],
    modules: [
      { title: "Settimana 1-5: HTML fondamentali", description: "Struttura, tag, form, media." },
      { title: "Settimana 6-10: CSS e design", description: "Styling, layout, responsive design." },
      { title: "Settimana 11-16: JavaScript", description: "Variabili, funzioni, DOM, eventi." },
      { title: "Settimana 17-20: Progetto finale", description: "Sito web completo da pubblicare online." },
    ],
    faqs: [
      { question: "Potrò creare siti veri?", answer: "Sì! Alla fine del corso avrai tutti gli strumenti per creare siti web professionali e pubblicarli online." },
    ],
  },
  "python-ai": {
    title: "Python & AI per Teen",
    description: "Programmazione avanzata con Python e introduzione all'intelligenza artificiale.",
    longDescription: "Un percorso avanzato per teenager appassionati di tecnologia. Impara Python, il linguaggio più richiesto nel mondo del lavoro, e scopri le basi dell'intelligenza artificiale e del machine learning.",
    age: "14-18 anni",
    level: "Advanced",
    duration: "24 settimane",
    emoji: "🤖",
    learnings: [
      "Python avanzato",
      "Strutture dati e algoritmi",
      "Librerie per data science",
      "Machine learning base",
      "Progetti AI pratici",
    ],
    projects: [
      "Chatbot intelligente",
      "Sistema di raccomandazione",
      "Analisi dati reali",
      "Riconoscimento immagini",
    ],
    requirements: [
      "Computer (PC o Mac con almeno 8GB RAM)",
      "Connessione internet stabile",
      "Esperienza base di programmazione consigliata",
    ],
    modules: [
      { title: "Settimana 1-6: Python solido", description: "Sintassi avanzata, OOP, librerie standard." },
      { title: "Settimana 7-12: Data Science", description: "NumPy, Pandas, visualizzazione dati." },
      { title: "Settimana 13-18: Machine Learning", description: "Scikit-learn, modelli base, training." },
      { title: "Settimana 19-24: Progetto AI", description: "Sviluppo completo di un progetto di AI." },
    ],
    faqs: [
      { question: "Serve sapere già Python?", answer: "Consigliamo di avere basi di programmazione. Se parti da zero, suggeriamo prima il corso Python Base." },
      { question: "Questo corso prepara per l'università?", answer: "Sì! I contenuti sono allineati con i primi corsi universitari di informatica e AI." },
    ],
  },
};

const levelColors: Record<string, string> = {
  Beginner: "bg-tech-green/10 text-tech-green border-tech-green/20",
  Intermediate: "bg-tech-orange/10 text-tech-orange border-tech-orange/20",
  Advanced: "bg-tech-purple/10 text-tech-purple border-tech-purple/20",
};

export default function CorsoDettaglio() {
  const { id } = useParams<{ id: string }>();
  const course = id ? coursesData[id] : null;

  if (!course) {
    return (
      <Layout>
        <div className="tech-section">
          <div className="tech-container text-center">
            <h1 className="text-4xl font-bold mb-4">Corso non trovato</h1>
            <p className="text-muted-foreground mb-8">Il corso che stai cercando non esiste.</p>
            <Button asChild>
              <Link to="/corsi">Torna ai corsi</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Hero */}
      <section className="tech-section bg-gradient-to-b from-tech-purple-light to-background">
        <div className="tech-container">
          <Link 
            to="/corsi" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Torna ai corsi
          </Link>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl">
                  {course.emoji}
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className={levelColors[course.level]}>
                    {course.level}
                  </Badge>
                  <Badge variant="secondary">{course.age}</Badge>
                </div>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold mb-4">{course.title}</h1>
              <p className="text-lg text-muted-foreground mb-6">{course.longDescription}</p>

              <div className="flex flex-wrap gap-4 mb-8">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-5 h-5" />
                  <span>{course.duration}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-5 h-5" />
                  <span>Max 6 studenti per classe</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-5 h-5" />
                  <span>1 lezione/settimana</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button variant="hero" size="xl" asChild>
                  <Link to="/prenota">Prenota lezione gratuita</Link>
                </Button>
                <Button variant="outline" size="lg">
                  Scarica programma PDF
                </Button>
              </div>
            </div>

            {/* Side card */}
            <div className="tech-card p-8">
              <h3 className="text-xl font-semibold mb-6">Cosa imparerà</h3>
              <ul className="space-y-3">
                {course.learnings.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-tech-green flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Projects */}
      <section className="tech-section bg-muted/30">
        <div className="tech-container">
          <div className="flex items-center gap-3 mb-8">
            <Rocket className="w-8 h-8 text-secondary" />
            <h2 className="text-3xl font-bold">Progetti che realizzerà</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {course.projects.map((project, i) => (
              <div key={i} className="tech-card p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-secondary/10 flex items-center justify-center">
                  <Target className="w-6 h-6 text-secondary" />
                </div>
                <p className="font-medium">{project}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Syllabus */}
      <section className="tech-section">
        <div className="tech-container">
          <div className="flex items-center gap-3 mb-8">
            <BookOpen className="w-8 h-8 text-primary" />
            <h2 className="text-3xl font-bold">Programma del corso</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {course.modules.map((module, i) => (
              <div key={i} className="tech-card p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary">{i + 1}</span>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">{module.title}</h4>
                    <p className="text-muted-foreground text-sm">{module.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="tech-section bg-muted/30">
        <div className="tech-container">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Monitor className="w-8 h-8 text-tech-cyan" />
                <h2 className="text-2xl font-bold">Requisiti tecnici</h2>
              </div>
              <ul className="space-y-3">
                {course.requirements.map((req, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Wifi className="w-5 h-5 text-tech-cyan" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-6">FAQ del corso</h2>
              <Accordion type="single" collapsible className="space-y-3">
                {course.faqs.map((faq, i) => (
                  <AccordionItem
                    key={i}
                    value={`faq-${i}`}
                    className="bg-card rounded-xl border border-border/50 px-4"
                  >
                    <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="tech-section bg-gradient-hero">
        <div className="tech-container text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            Pronto a iniziare?
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Prenota una lezione di prova gratuita per {course.title} e scopri se è il corso giusto per il tuo bambino.
          </p>
          <Button variant="secondary" size="xl" asChild>
            <Link to="/prenota">Prenota lezione gratuita</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
