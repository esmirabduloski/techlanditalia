import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { CheckCircle2, Calendar, Video, Shield, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const interests = [
  { value: "coding-base", label: "Coding Base (6-8 anni)" },
  { value: "game-dev", label: "Game Development" },
  { value: "roblox", label: "Roblox Studio" },
  { value: "web", label: "Web Development" },
  { value: "python-ai", label: "Python & AI" },
  { value: "non-so", label: "Non sono sicuro, vorrei consigli" },
];

const weekDays = [
  { value: "lunedi", label: "Lunedì" },
  { value: "martedi", label: "Martedì" },
  { value: "mercoledi", label: "Mercoledì" },
  { value: "giovedi", label: "Giovedì" },
  { value: "venerdi", label: "Venerdì" },
  { value: "sabato", label: "Sabato" },
];

const timeSlots = Array.from({ length: 12 }, (_, i) => {
  const hour = i + 9;
  return { value: `${hour}:00`, label: `${hour}:00` };
});

const benefits = [
  { icon: Calendar, text: "Ti contatteremo entro 24h" },
  { icon: Video, text: "Lezione 1:1 con un docente" },
  { icon: Shield, text: "Nessun impegno, zero costi" },
  { icon: Clock, text: "Durata: 30-45 minuti" },
];

const bookingSchema = z.object({
  parentName: z.string().trim().min(2, "Il nome deve avere almeno 2 caratteri").max(100, "Nome troppo lungo"),
  email: z.string().trim().email("Inserisci un'email valida").max(255, "Email troppo lunga"),
  phone: z.string().trim().max(20, "Numero troppo lungo").optional().or(z.literal("")),
  childAge: z.string().min(1, "Seleziona l'età del bambino"),
  interest: z.string().min(1, "Seleziona un'area di interesse"),
  preferredDay: z.string().optional(),
  preferredTime: z.string().optional(),
  message: z.string().trim().max(1000, "Messaggio troppo lungo").optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

// Admin email - change this to your actual email
const ADMIN_EMAIL = "info@techland.it";

export default function Prenota() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      parentName: "",
      email: "",
      phone: "",
      childAge: "",
      interest: "",
      availability: "",
      message: "",
    },
  });

  const onSubmit = async (data: BookingFormData) => {
    setIsSubmitting(true);

    try {
      // Submit booking through secure Edge Function with rate limiting
      const { data: bookingResult, error: bookingError } = await supabase.functions.invoke("submit-booking", {
        body: {
          parentName: data.parentName,
          email: data.email,
          phone: data.phone,
          childAge: parseInt(data.childAge),
          interest: data.interest,
          availability: data.availability,
          message: data.message,
          adminEmail: ADMIN_EMAIL,
        },
      });

      if (bookingError) {
        console.error("Booking error:", bookingError);
        throw new Error("Errore nell'invio della richiesta");
      }

      if (!bookingResult?.success) {
        throw new Error(bookingResult?.error || "Errore nell'invio della richiesta");
      }

      // Send email notification separately
      const emailData = bookingResult.sendEmailNotification;
      if (emailData) {
        const { error: emailError } = await supabase.functions.invoke("send-booking-notification", {
          body: emailData,
        });

        if (emailError) {
          console.error("Email error:", emailError);
          // Don't throw - booking was saved, email failed
          toast({
            title: "Richiesta inviata!",
            description: "Ti contatteremo presto. (Nota: potrebbe esserci un ritardo nell'invio dell'email di conferma)",
          });
        } else {
          toast({
            title: "Richiesta inviata!",
            description: "Ti contatteremo entro 24 ore per confermare la lezione.",
          });
        }
      }

      setIsSubmitted(true);
    } catch (error: any) {
      console.error("Submission error:", error);
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="parentName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome del genitore *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Es. Maria Rossi" 
                            className="h-12"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="Es. maria.rossi@email.com" 
                            className="h-12"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefono (opzionale)</FormLabel>
                        <FormControl>
                          <Input 
                            type="tel" 
                            placeholder="Es. +39 333 1234567" 
                            className="h-12"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="childAge"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Età del bambino *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12">
                              <SelectValue placeholder="Seleziona l'età" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.from({ length: 13 }, (_, i) => i + 6).map((age) => (
                              <SelectItem key={age} value={String(age)}>
                                {age} anni
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="interest"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interesse principale *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12">
                              <SelectValue placeholder="Seleziona un'area di interesse" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {interests.map((interest) => (
                              <SelectItem key={interest.value} value={interest.value}>
                                {interest.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="availability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Disponibilità preferita</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12">
                              <SelectValue placeholder="Quando preferisci essere contattato?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="mattina">Mattina (9-12)</SelectItem>
                            <SelectItem value="pomeriggio">Pomeriggio (14-18)</SelectItem>
                            <SelectItem value="sera">Sera (18-20)</SelectItem>
                            <SelectItem value="weekend">Weekend</SelectItem>
                            <SelectItem value="qualsiasi">Qualsiasi orario</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Messaggio (opzionale)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Raccontaci qualcosa sul tuo bambino o facci delle domande..."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
              </Form>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
