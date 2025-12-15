import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Calendar, Video, Shield, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const interests = [
  { value: "coding-base", label: "Coding Base (6-8 anni)" },
  { value: "game-dev", label: "Game Development" },
  { value: "roblox", label: "Roblox Studio" },
  { value: "web", label: "Web Development" },
  { value: "python-ai", label: "Python & AI" },
  { value: "non-so", label: "Non sono sicuro, vorrei consigli" },
];

const benefits = [
  { icon: Calendar, text: "Ti contatteremo entro 24h" },
  { icon: Video, text: "Lezione 1:1 con un docente" },
  { icon: Shield, text: "Nessun impegno, zero costi" },
  { icon: Clock, text: "Durata: 30-45 minuti" },
];

export default function Prenota() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setIsSubmitted(true);
    
    toast({
      title: "Richiesta inviata!",
      description: "Ti contatteremo entro 24 ore per confermare la lezione.",
    });
  };

  if (isSubmitted) {
    return (
      <Layout>
        <section className="tech-section min-h-[70vh] flex items-center">
          <div className="tech-container">
            <div className="max-w-xl mx-auto text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-tech-green/20 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-tech-green" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                Richiesta ricevuta!
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Grazie per aver scelto TECHLAND. Ti contatteremo entro 24 ore per confermare la lezione di prova gratuita e rispondere a tutte le tue domande.
              </p>
              <div className="tech-card p-6 text-left">
                <h3 className="font-semibold mb-4">Cosa succede ora?</h3>
                <ol className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">1</span>
                    <span>Riceverai un'email di conferma</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">2</span>
                    <span>Un nostro consulente ti contatterà per fissare l'appuntamento</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">3</span>
                    <span>Parteciperai alla lezione di prova con il tuo bambino</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="tech-section bg-gradient-to-b from-tech-green-light to-background">
        <div className="tech-container">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Info Column */}
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Prenota una lezione{" "}
                <span className="tech-gradient-text">gratuita</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Scopri TECHLAND con una lezione di prova senza impegno. Valuteremo insieme il percorso migliore per il tuo bambino.
              </p>

              <div className="space-y-4 mb-8">
                {benefits.map((benefit, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <benefit.icon className="w-6 h-6 text-primary" />
                    </div>
                    <span className="font-medium">{benefit.text}</span>
                  </div>
                ))}
              </div>

              <div className="tech-card p-6 bg-secondary/10 border-secondary/20">
                <p className="text-sm">
                  <strong>💡 Suggerimento:</strong> Fai partecipare il tuo bambino alla chiamata! Così potrà conoscere l'ambiente e fare domande direttamente al docente.
                </p>
              </div>
            </div>

            {/* Form Column */}
            <div className="tech-card p-8">
              <h2 className="text-2xl font-semibold mb-6">Compila il form</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="parentName">Nome del genitore *</Label>
                  <Input 
                    id="parentName" 
                    placeholder="Es. Maria Rossi" 
                    required 
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="Es. maria.rossi@email.com" 
                    required 
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefono (opzionale)</Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    placeholder="Es. +39 333 1234567" 
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="childAge">Età del bambino *</Label>
                  <Select required>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Seleziona l'età" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 13 }, (_, i) => i + 6).map((age) => (
                        <SelectItem key={age} value={String(age)}>
                          {age} anni
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interest">Interesse principale *</Label>
                  <Select required>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Seleziona un'area di interesse" />
                    </SelectTrigger>
                    <SelectContent>
                      {interests.map((interest) => (
                        <SelectItem key={interest.value} value={interest.value}>
                          {interest.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="availability">Disponibilità preferita</Label>
                  <Select>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Quando preferisci essere contattato?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mattina">Mattina (9-12)</SelectItem>
                      <SelectItem value="pomeriggio">Pomeriggio (14-18)</SelectItem>
                      <SelectItem value="sera">Sera (18-20)</SelectItem>
                      <SelectItem value="weekend">Weekend</SelectItem>
                      <SelectItem value="qualsiasi">Qualsiasi orario</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Messaggio (opzionale)</Label>
                  <Textarea 
                    id="message" 
                    placeholder="Raccontaci qualcosa sul tuo bambino o facci delle domande..."
                    rows={4}
                  />
                </div>

                <Button 
                  type="submit" 
                  variant="hero" 
                  size="xl" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Invio in corso..." : "Prenota lezione gratuita"}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Inviando questo form accetti la nostra{" "}
                  <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
                  {" "}e acconsenti a essere contattato da TECHLAND.
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
