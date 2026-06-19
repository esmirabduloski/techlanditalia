import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Briefcase, Heart, Rocket, Users, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const benefits = [
  {
    icon: Rocket,
    title: "Crescita professionale",
    description: "Opportunità di sviluppo e formazione continua nel settore EdTech"
  },
  {
    icon: Heart,
    title: "Lavoro significativo",
    description: "Contribuisci a formare la prossima generazione di talenti tech"
  },
  {
    icon: Users,
    title: "Team dinamico",
    description: "Lavora con persone appassionate di tecnologia e educazione"
  },
  {
    icon: Briefcase,
    title: "Flessibilità",
    description: "Lavoro remoto e orari flessibili per un perfetto work-life balance"
  }
];

const positions = [
  {
    title: "Insegnante di Scratch",
    type: "Part-time / Remoto",
    description: "Cerchiamo insegnanti appassionati per tenere corsi di programmazione visiva con Scratch per bambini 7-10 anni."
  },
  {
    title: "Insegnante di Python",
    type: "Part-time / Remoto",
    description: "Insegna Python e introduci i ragazzi al mondo dell'intelligenza artificiale e dello sviluppo software."
  },
  {
    title: "Insegnante di Roblox Studio",
    type: "Part-time / Remoto",
    description: "Guida i giovani sviluppatori nella creazione di giochi e mondi virtuali con Roblox Studio."
  },
  {
    title: "Insegnante di Unity",
    type: "Part-time / Remoto",
    description: "Insegna lo sviluppo di videogiochi 3D con Unity a ragazzi dai 12 anni in su."
  }
];

export default function LavoraConNoi() {
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefono: "",
    posizione: "",
    messaggio: "",
    website: "", // honeypot
  });
  const [formOpenedAt] = useState(() => Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { data, error } = await supabase.functions.invoke('submit-job-application', {
      body: {
        nome: formData.nome,
        email: formData.email,
        telefono: formData.telefono || "",
        posizione: formData.posizione,
        messaggio: formData.messaggio,
        website: formData.website,
        formOpenedAt,
      },
    });

    if (error || (data && (data as any).error)) {
      toast.error("Errore nell'invio della candidatura. Riprova.");
      setIsSubmitting(false);
      return;
    }

    toast.success("Candidatura inviata con successo! Ti contatteremo presto.");
    setFormData({ nome: "", email: "", telefono: "", posizione: "", messaggio: "", website: "" });
    setIsSubmitting(false);
  };

  return (
    <Layout>
      <SEOHead
        title="Lavora Con Noi - Insegnanti Coding per Bambini | TECHLAND"
        description="Unisciti al team TECHLAND! Cerchiamo insegnanti di programmazione per bambini e ragazzi. Lavoro remoto, orari flessibili, formazione continua."
        canonical="/lavora-con-noi"
        keywords="lavora con noi techland, insegnante coding bambini, lavoro insegnante programmazione, docente scratch python roblox, lavoro remoto insegnante"
        structuredData={[
          ...positions.map((pos, i) => ({
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": pos.title,
            "description": `<p>${pos.description}</p><p>Posizione part-time in modalità remota presso TECHLAND, scuola di coding online per alunni dai 5 ai 20 anni.</p>`,
            "identifier": {
              "@type": "PropertyValue",
              "name": "TECHLAND",
              "value": `techland-job-${i + 1}`,
            },
            "employmentType": "PART_TIME",
            "datePosted": "2026-01-15",
            "validThrough": "2026-12-31T23:59:00+01:00",
            "hiringOrganization": {
              "@type": "Organization",
              "name": "TECHLAND",
              "sameAs": "https://techlanditalia.it",
              "logo": "https://techlanditalia.it/logo.png",
            },
            "jobLocationType": "TELECOMMUTE",
            "applicantLocationRequirements": {
              "@type": "Country",
              "name": "IT",
            },
            "jobLocation": {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "IT",
              },
            },
          })),
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://techlanditalia.it/" },
              { "@type": "ListItem", "position": 2, "name": "Lavora Con Noi", "item": "https://techlanditalia.it/lavora-con-noi" }
            ]
          }
        ]}
      />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-primary/10 via-tech-cyan/5 to-background dark:from-background dark:via-background dark:to-background">
        <div className="tech-container">
          <SEOBreadcrumb 
            items={[{ label: "Lavora Con Noi" }]} 
            className="mb-8 justify-center"
          />
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Briefcase className="w-4 h-4" />
              Unisciti al team
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Lavora con <span className="text-gradient">TECHLAND</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Cerchiamo persone appassionate di tecnologia e educazione per ispirare la prossima generazione di innovatori.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16">
        <div className="tech-container">
          <h2 className="text-3xl font-bold text-center mb-12">Perché lavorare con noi</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <benefit.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-16 bg-muted/30">
        <div className="tech-container">
          <h2 className="text-3xl font-bold text-center mb-4">Posizioni aperte</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Stiamo cercando insegnanti appassionati per i nostri corsi online. Tutte le posizioni sono in remoto.
          </p>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {positions.map((position, index) => (
              <div key={index} className="p-6 rounded-2xl bg-card border border-border">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold">{position.title}</h3>
                  <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary whitespace-nowrap">
                    {position.type}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm">{position.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section className="py-16">
        <div className="tech-container">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4">Candidati ora</h2>
            <p className="text-center text-muted-foreground mb-8">
              Compila il form per inviare la tua candidatura. Ti ricontatteremo il prima possibile.
            </p>
            
            <form onSubmit={handleSubmit} className="space-y-6 p-8 rounded-2xl bg-card border border-border">
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                aria-hidden="true"
              />
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                    autoComplete="name"
                    placeholder="Mario Rossi"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    autoComplete="email"
                    placeholder="mario@esempio.it"
                  />
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefono">Telefono</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    autoComplete="tel"
                    placeholder="+39 123 456 7890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="posizione">Posizione di interesse *</Label>
                  <Input
                    id="posizione"
                    value={formData.posizione}
                    onChange={(e) => setFormData({ ...formData, posizione: e.target.value })}
                    required
                    placeholder="es. Insegnante di Python"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="messaggio">Parlaci di te *</Label>
                <Textarea
                  id="messaggio"
                  value={formData.messaggio}
                  onChange={(e) => setFormData({ ...formData, messaggio: e.target.value })}
                  required
                  placeholder="Raccontaci la tua esperienza e perché vorresti unirti a TECHLAND..."
                  rows={5}
                />
              </div>
              
              <Button type="submit" variant="cta" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Invio in corso..." : "Invia candidatura"}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </Layout>
  );
}
