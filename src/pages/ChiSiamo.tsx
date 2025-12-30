import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Users, Award, Target, Heart, Sparkles, GraduationCap } from "lucide-react";

const stats = [
  { value: "15.000+", label: "Studenti formati", icon: Users },
  { value: "5", label: "Anni di esperienza", icon: Award },
  { value: "98%", label: "Genitori soddisfatti", icon: Heart },
  { value: "50+", label: "Docenti esperti", icon: GraduationCap },
];

const values = [
  {
    icon: Target,
    title: "Missione",
    description: "Preparare i giovani alle competenze digitali del futuro, rendendo la programmazione accessibile, divertente e sicura per tutti.",
  },
  {
    icon: Sparkles,
    title: "Visione",
    description: "Un mondo dove ogni bambino ha la possibilità di diventare creatore di tecnologia, non solo consumatore.",
  },
  {
    icon: Heart,
    title: "Valori",
    description: "Creatività, inclusività, sicurezza e divertimento. Crediamo che imparare debba essere un'avventura entusiasmante.",
  },
];

const team = [
  { name: "Marco Rossi", role: "Fondatore & CEO", avatar: "MR" },
  { name: "Laura Bianchi", role: "Direttrice Didattica", avatar: "LB" },
  { name: "Alessandro Verdi", role: "Head of Technology", avatar: "AV" },
  { name: "Chiara Neri", role: "Head of Operations", avatar: "CN" },
];

// Schema.org per Organization
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "name": "TECHLAND",
  "description": "Scuola di programmazione e coding per bambini e ragazzi dai 6 ai 18 anni. Corsi online di Roblox, Minecraft, Python, Scratch e sviluppo web.",
  "url": "https://techlanditalia.it",
  "logo": "https://techlanditalia.it/favicon.ico",
  "foundingDate": "2019",
  "numberOfEmployees": "50+",
  "areaServed": "IT",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+39-351-250-8851",
    "contactType": "customer service",
    "availableLanguage": "Italian"
  },
  "sameAs": [
    "https://www.facebook.com/profile.php?id=61573749912297",
    "https://www.instagram.com/techlanditalia/",
    "https://www.linkedin.com/in/techlanditalia/"
  ]
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
          <SEOBreadcrumb 
            items={[{ label: "Chi Siamo" }]} 
            className="mb-8 justify-center"
          />
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Chi Siamo: La Scuola di Coding per Bambini in Italia
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              TECHLAND nasce dalla passione per la tecnologia e l'educazione. Siamo un team di professionisti del tech e dell'insegnamento che crede nel potenziale di ogni bambino.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-b border-border/50">
        <div className="tech-container">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
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

      {/* Story */}
      <section className="tech-section">
        <div className="tech-container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">La nostra storia</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  TECHLAND è nata nel 2019 da un'idea semplice: rendere la programmazione accessibile ai bambini italiani. I nostri fondatori, professionisti del settore tech con figli, hanno visto la difficoltà nel trovare corsi di qualità per i più giovani.
                </p>
                <p>
                  Abbiamo iniziato con una piccola classe di 5 bambini. Oggi formiamo oltre 15.000 studenti ogni anno, ma la nostra missione resta la stessa: trasformare la curiosità per la tecnologia in competenze concrete per il futuro.
                </p>
                <p>
                  Ogni corso è progettato con attenzione pedagogica, ogni docente è formato per insegnare ai giovani, ogni ambiente è sicuro e monitorato. Perché crediamo che imparare a programmare sia importante, ma farlo nel modo giusto lo è ancora di più.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-video rounded-3xl bg-gradient-hero p-1">
                <div className="w-full h-full rounded-3xl bg-card flex items-center justify-center overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80" 
                    alt="Team TECHLAND"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission, Vision, Values */}
      <section className="tech-section bg-muted/30">
        <div className="tech-container">
          <div className="grid md:grid-cols-3 gap-8">
            {values.map((value) => (
              <div key={value.title} className="tech-card p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <value.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">{value.title}</h3>
                <p className="text-muted-foreground">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="tech-section">
        <div className="tech-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Il nostro team</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Un team di professionisti appassionati che lavorano ogni giorno per offrire la migliore esperienza educativa.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((member) => (
              <div key={member.name} className="tech-card tech-card-hover p-6 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-hero flex items-center justify-center text-primary-foreground font-bold text-xl">
                  {member.avatar}
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
                  Ogni docente TECHLAND è un professionista del settore tech con esperienza comprovata e passione per l'insegnamento ai giovani.
                </p>
                <p>
                  Prima di entrare nel nostro team, ogni docente segue un percorso di formazione specifico sulla didattica per bambini e ragazzi, sulla gestione delle classi online e sulla sicurezza digitale.
                </p>
                <p>
                  I nostri standard sono elevati: solo il 15% dei candidati supera il processo di selezione.
                </p>
              </div>
              <Button variant="cta" size="lg" className="mt-6" asChild>
                <Link to="/prenota">Conosci i nostri docenti</Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {["Sviluppatori senior", "Formazione pedagogica", "Background check", "Valutazioni continue"].map((item, i) => (
                <div key={i} className="tech-card p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-primary/10 flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-primary" />
                  </div>
                  <p className="font-medium text-sm">{item}</p>
                </div>
              ))}
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
