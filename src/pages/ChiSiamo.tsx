import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Link } from "react-router-dom";
import {
  Users,
  Award,
  Heart,
  GraduationCap,
  Target,
  Globe,
  Gamepad2,
  Brain,
  Sprout,
  Handshake,
  Home,
} from "lucide-react";

const stats = [
  { value: "1.200+", label: "Studenti formati", icon: Users },
  { value: "5", label: "Anni di esperienza", icon: Award },
  { value: "98%", label: "Genitori soddisfatti", icon: Heart },
];

const values = [
  {
    emoji: "👦",
    title: "Il ragazzo al centro",
    description: "Percorsi pensati sulle esigenze, l'età e i talenti di ogni bambino e ragazzo.",
  },
  {
    emoji: "🎮",
    title: "Imparare divertendosi",
    description: "Lezioni coinvolgenti che trasformano il coding in un'esperienza stimolante e mai noiosa.",
  },
  {
    emoji: "🧠",
    title: "Educazione prima del codice",
    description: "Il coding come strumento per sviluppare logica, creatività e pensiero critico.",
  },
  {
    emoji: "👩‍🏫",
    title: "Docenti qualificati",
    description: "Insegnanti esperti nel lavorare con bambini e ragazzi, in piccoli gruppi.",
  },
  {
    emoji: "🌱",
    title: "Crescita graduale",
    description: "Progressi passo dopo passo, nel rispetto dei tempi di apprendimento di ciascuno.",
  },
  {
    emoji: "🤝",
    title: "Inclusione e rispetto",
    description: "Un ambiente sicuro, positivo e accessibile, dove tutti possono sentirsi a proprio agio.",
  },
  {
    emoji: "🏠",
    title: "Famiglie coinvolte",
    description: "Trasparenza e dialogo costante con i genitori durante tutto il percorso.",
  },
];

const team = [
  { name: "Esmir", role: "Fondatore & CEO", initials: "ES" },
  { name: "Alessia", role: "Insegnante", initials: "AL" },
  { name: "Vittorio", role: "Insegnante", initials: "VI" },
  { name: "Adele", role: "Insegnante", initials: "AD" },
];

// Schema.org per Organization
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "TECHLAND",
  description:
    "Scuola di programmazione e coding per bambini e ragazzi dai 6 ai 18 anni. Corsi online di Roblox, Minecraft, Python, Scratch e sviluppo web.",
  url: "https://techlanditalia.it",
  logo: "https://techlanditalia.it/favicon.ico",
  foundingDate: "2021",
  numberOfEmployees: "50+",
  areaServed: "IT",
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+39-351-250-8851",
    contactType: "customer service",
    availableLanguage: "Italian",
  },
  sameAs: [
    "https://www.facebook.com/profile.php?id=61573749912297",
    "https://www.instagram.com/techlanditalia/",
    "https://www.linkedin.com/in/techlanditalia/",
  ],
};

export default function ChiSiamo() {
  return (
    <Layout>
      <SEOHead
        title="Chi Siamo - Scuola di Coding per Bambini | TECHLAND"
        description="Scopri TECHLAND: la scuola italiana leader nei corsi di programmazione per bambini e ragazzi 6-18 anni. 15.000+ studenti formati, 50+ docenti esperti. La nostra missione."
        canonical="https://techlanditalia.it/chi-siamo"
        keywords="chi siamo techland, scuola coding bambini italia, corsi programmazione ragazzi, insegnanti coding, formazione digitale giovani"
        schemaData={organizationSchema}
      />

      {/* Hero */}
      <section className="tech-section bg-gradient-to-b from-tech-green-light to-background">
        <div className="tech-container">
          <SEOBreadcrumb items={[{ label: "Chi Siamo" }]} className="mb-8 justify-center" />
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Chi Siamo: La Scuola di Coding per Bambini in Italia
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              TECHLAND nasce dalla passione per la tecnologia e l'educazione. Siamo un team di professionisti del tech e
              dell'insegnamento che crede nel potenziale di ogni bambino.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-b border-border/50">
        <div className="tech-container">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <stat.icon className="w-8 h-8 text-primary" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="tech-section">
        <div className="tech-container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <span className="text-5xl mb-4 block">🎯</span>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Missione</h2>
            </div>
            <div className="space-y-6 text-lg text-muted-foreground">
              <p className="text-xl text-foreground font-medium text-center">
                La nostra missione è accompagnare bambini e ragazzi dai 6 ai 18 anni a diventare protagonisti del
                proprio futuro digitale.
              </p>
              <p>
                In Techland Italia trasformiamo la tecnologia in uno strumento di crescita personale: attraverso corsi
                di coding online, pratici e divertenti, aiutiamo ogni ragazzo a scoprire il proprio talento, sviluppare
                pensiero critico, creatività e sicurezza in sé stesso.
              </p>
              <p className="font-medium text-foreground">Non insegniamo solo a programmare.</p>
              <p>
                Alleniamo competenze fondamentali per la vita e per la scuola di oggi: problem solving, disciplina,
                collaborazione, autonomia e resilienza.
              </p>
              <p>Così i ragazzi non imparano solo cosa fare con il computer, ma come affrontare il mondo che cambia.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="tech-section bg-muted/30">
        <div className="tech-container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <span className="text-5xl mb-4 block">🌍</span>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Visione</h2>
            </div>
            <div className="space-y-6 text-lg text-muted-foreground">
              <p className="text-xl text-foreground font-medium text-center">
                Immaginiamo un futuro in cui ogni bambino e ragazzo abbia le competenze per creare, non subire, la
                tecnologia.
              </p>
              <p>
                Vogliamo contribuire a una generazione consapevole, capace di usare il codice per esprimere idee,
                risolvere problemi reali e costruire progetti con impatto positivo sulla propria vita e sulla società.
              </p>
              <p>
                Sogniamo un'educazione digitale accessibile, inclusiva e di qualità, che riduca il divario educativo e
                prepari i ragazzi non solo alle professioni di domani, ma a diventare cittadini competenti, curiosi e
                responsabili del mondo digitale.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="tech-section">
        <div className="tech-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">I nostri valori</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              I principi che guidano ogni nostra scelta e ogni nostra azione.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {values.map((value) => (
              <div key={value.title} className="tech-card tech-card-hover p-6 text-center">
                <span className="text-4xl mb-4 block">{value.emoji}</span>
                <h3 className="text-xl font-semibold mb-3">{value.title}</h3>
                <p className="text-muted-foreground text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="tech-section bg-muted/30">
        <div className="tech-container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">La nostra storia</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  TECHLAND è nata nel 2021 da un'idea semplice: rendere la programmazione accessibile ai bambini
                  italiani. I nostri fondatori, professionisti del settore tech con figli, hanno visto la difficoltà nel
                  trovare corsi di qualità per i più giovani.
                </p>
                <p>
                  Abbiamo iniziato con una piccola classe di 5 bambini. Ad oggi abbiamo formato oltre 1.200 studenti, ma
                  la nostra missione resta la stessa: trasformare la curiosità per la tecnologia in competenze concrete
                  per il futuro.
                </p>
                <p>
                  Ogni corso è progettato con attenzione pedagogica, ogni docente è formato per insegnare ai giovani,
                  ogni ambiente è sicuro e monitorato. Perché crediamo che imparare a programmare sia importante, ma
                  farlo nel modo giusto lo è ancora di più.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-video rounded-3xl bg-gradient-hero p-1">
                <div className="w-full h-full rounded-3xl bg-card flex items-center justify-center overflow-hidden">
                  <OptimizedImage
                    src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f"
                    alt="Team TECHLAND - docenti esperti di programmazione per bambini"
                    className="w-full h-full object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    aspectRatio="video"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="tech-section">
        <div className="tech-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Il nostro team</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Un team di professionisti appassionati che lavorano ogni giorno per offrire la migliore esperienza
              educativa.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {team.map((member) => (
              <div key={member.name} className="tech-card tech-card-hover p-6 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-hero flex items-center justify-center text-primary-foreground font-bold text-xl">
                  {member.initials}
                </div>
                <h4 className="font-semibold text-lg">{member.name}</h4>
                <p className="text-muted-foreground text-sm">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Educators */}
      <section className="tech-section bg-gradient-to-br from-tech-purple-light to-tech-orange-light">
        <div className="tech-container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">I nostri docenti</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Ogni docente TECHLAND è un professionista del settore tech con esperienza comprovata e passione per
                  l'insegnamento ai giovani.
                </p>
                <p>
                  Prima di entrare nel nostro team, ogni docente segue un percorso di formazione specifico sulla
                  didattica per bambini e ragazzi, sulla gestione delle classi online e sulla sicurezza digitale.
                </p>
                <p>I nostri standard sono elevati: solo il 15% dei candidati supera il processo di selezione.</p>
              </div>
              <Button variant="cta" size="lg" className="mt-6" asChild>
                <Link to="/prenota">Conosci i nostri docenti</Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {["Sviluppatori senior", "Formazione pedagogica", "Background check", "Valutazioni continue"].map(
                (item, i) => (
                  <div key={i} className="tech-card p-6 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-primary/10 flex items-center justify-center">
                      <GraduationCap className="w-6 h-6 text-primary" />
                    </div>
                    <p className="font-medium text-sm">{item}</p>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="tech-section bg-gradient-hero">
        <div className="tech-container text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            Unisciti alla famiglia TECHLAND
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Scopri come possiamo aiutare il tuo bambino a sviluppare le competenze del futuro.
          </p>
          <Button variant="secondary" size="xl" asChild>
            <Link to="/prenota">Prenota lezione gratuita</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
