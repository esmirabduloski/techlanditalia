import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, MessageCircle, MapPin, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

// Validation schema
const contactSchema = z.object({
  nome: z.string()
    .trim()
    .min(1, "Il nome è obbligatorio")
    .max(100, "Il nome non può superare i 100 caratteri"),
  email: z.string()
    .trim()
    .email("Formato email non valido")
    .max(254, "L'email non può superare i 254 caratteri"),
  oggetto: z.string()
    .trim()
    .min(1, "L'oggetto è obbligatorio")
    .max(200, "L'oggetto non può superare i 200 caratteri"),
  messaggio: z.string()
    .trim()
    .min(1, "Il messaggio è obbligatorio")
    .max(5000, "Il messaggio non può superare i 5000 caratteri"),
});

const contactInfo = [
  {
    icon: Mail,
    title: "Email",
    value: "info@techlanditalia.it",
    href: "mailto:info@techlanditalia.it",
    description: "Scrivici per qualsiasi domanda"
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    value: "+39 351 250 8851",
    href: "https://wa.me/393512508851",
    description: "Contattaci su WhatsApp"
  },
  {
    icon: Clock,
    title: "Orari",
    value: "Lun-Ven 9:00-18:00",
    href: null,
    description: "Siamo disponibili per te"
  },
  {
    icon: MapPin,
    title: "Sede",
    value: "Italia",
    href: null,
    description: "Lezioni 100% online"
  }
];

export default function Contatti() {
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    oggetto: "",
    messaggio: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate form data
    const result = contactSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      toast.error("Correggi gli errori nel form");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-contact-email', {
        body: result.data
      });

      if (error) {
        console.error("Error sending contact email:", error);
        toast.error("Errore nell'invio del messaggio. Riprova più tardi.");
        return;
      }

      toast.success("Messaggio inviato con successo! Ti risponderemo presto.");
      setFormData({ nome: "", email: "", oggetto: "", messaggio: "" });
    } catch (error) {
      console.error("Error sending contact email:", error);
      toast.error("Errore nell'invio del messaggio. Riprova più tardi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <SEOHead
        title="Contattaci - Corsi Coding per Bambini | TECHLAND"
        description="Hai domande sui nostri corsi di programmazione per bambini? Contattaci via email, WhatsApp o compila il form. Ti rispondiamo entro 24 ore!"
        canonical="/contatti"
        keywords="contatti techland, info corsi coding bambini, assistenza corsi programmazione"
      />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-tech-cyan/10 via-primary/5 to-background">
        <div className="tech-container">
          <SEOBreadcrumb 
            items={[{ label: "Contatti" }]} 
            className="mb-8 justify-center"
          />
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-tech-cyan/10 text-tech-cyan text-sm font-medium mb-6">
              <MessageCircle className="w-4 h-4" />
              Siamo qui per te
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-gradient">Contattaci</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Hai domande sui nostri corsi? Vuoi prenotare una lezione di prova? Siamo qui per aiutarti!
            </p>
          </div>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-16">
        <div className="tech-container">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {contactInfo.map((info, index) => (
              <div key={index} className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors text-center">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <info.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">{info.title}</h3>
                {info.href ? (
                  <a 
                    href={info.href} 
                    target={info.href.startsWith("https") ? "_blank" : undefined}
                    rel={info.href.startsWith("https") ? "noopener noreferrer" : undefined}
                    className="text-primary hover:underline font-medium"
                  >
                    {info.value}
                  </a>
                ) : (
                  <p className="text-foreground font-medium">{info.value}</p>
                )}
                <p className="text-muted-foreground text-sm mt-1">{info.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-16 bg-muted/30">
        <div className="tech-container">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4">Scrivici un messaggio</h2>
            <p className="text-center text-muted-foreground mb-8">
              Compila il form e ti risponderemo il prima possibile.
            </p>
            
            <form onSubmit={handleSubmit} className="space-y-6 p-8 rounded-2xl bg-card border border-border">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                    maxLength={100}
                    placeholder="Il tuo nome"
                    className={errors.nome ? "border-destructive" : ""}
                  />
                  {errors.nome && <p className="text-sm text-destructive">{errors.nome}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    maxLength={254}
                    placeholder="la-tua@email.it"
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="oggetto">Oggetto *</Label>
                <Input
                  id="oggetto"
                  value={formData.oggetto}
                  onChange={(e) => setFormData({ ...formData, oggetto: e.target.value })}
                  required
                  maxLength={200}
                  placeholder="Di cosa vuoi parlarci?"
                  className={errors.oggetto ? "border-destructive" : ""}
                />
                {errors.oggetto && <p className="text-sm text-destructive">{errors.oggetto}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="messaggio">Messaggio *</Label>
                <Textarea
                  id="messaggio"
                  value={formData.messaggio}
                  onChange={(e) => setFormData({ ...formData, messaggio: e.target.value })}
                  required
                  maxLength={5000}
                  placeholder="Scrivi qui il tuo messaggio..."
                  rows={5}
                  className={errors.messaggio ? "border-destructive" : ""}
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  {errors.messaggio && <p className="text-destructive">{errors.messaggio}</p>}
                  <span className="ml-auto">{formData.messaggio.length}/5000</span>
                </div>
              </div>
              
              <Button type="submit" variant="cta" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Invio in corso..." : "Invia messaggio"}
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="tech-container">
          <div className="text-center max-w-2xl mx-auto p-8 rounded-3xl bg-gradient-to-r from-primary/10 via-tech-cyan/10 to-tech-purple/10 border border-border">
            <h2 className="text-2xl font-bold mb-4">Preferisci parlare con noi?</h2>
            <p className="text-muted-foreground mb-6">
              Contattaci su WhatsApp per una risposta immediata!
            </p>
            <Button variant="cta" size="lg" asChild>
              <a href="https://wa.me/393512508851" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Chatta su WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
