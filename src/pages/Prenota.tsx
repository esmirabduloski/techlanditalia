import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
import { CheckCircle2, Calendar, Video, Shield } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";
import { useAnalytics } from "@/hooks/useAnalytics";

const fallbackInterests = [
  { value: "non-so", label: "Non sono sicuro, vorrei consigli" },
];


const benefits = [
  { icon: Calendar, text: "Ti contatteremo entro 24h" },
  { icon: Video, text: "Lezione 1:1 con un docente" },
  { icon: Shield, text: "Nessun impegno, zero costi" },
  { icon: Clock, text: "Durata: 30-45 minuti" },
];

const bookingSchema = z.object({
  parentName: z.string().trim().min(2, "Il nome deve avere almeno 2 caratteri").max(100, "Nome troppo lungo"),
  email: z.string().trim().email("Inserisci un'email valida").max(255, "Email troppo lunga"),
  phone: z.string().trim().min(1, "Inserisci il numero di telefono").max(20, "Numero troppo lungo"),
  childAge: z.string().optional().or(z.literal("")),
  interest: z.string().optional().or(z.literal("")),
  privacyAccepted: z.literal(true, { errorMap: () => ({ message: "Devi accettare la Privacy Policy" }) }),
});

type BookingFormData = z.infer<typeof bookingSchema>;

// Admin email - change this to your actual email
const ADMIN_EMAIL = "info@techland.it";

export default function Prenota() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [interests, setInterests] = useState(fallbackInterests);
  const { trackFormStart, trackFormSubmit, trackFormError, trackBookingConversion, trackFunnelStep } = useAnalytics();
  const formStartTracked = useRef(false);

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      parentName: "",
      email: "",
      phone: "",
      childAge: "",
      interest: "",
      privacyAccepted: undefined as unknown as true,
    },
  });

  // Fetch courses from DB to populate interests dropdown
  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('slug, title, emoji, age_range')
        .eq('is_visible', true)
        .order('title');

      if (!error && data && data.length > 0) {
        const courseInterests = data.map(c => ({
          value: c.slug,
          label: `${c.emoji} ${c.title}${c.age_range ? ` (${c.age_range})` : ''}`,
        }));
        setInterests([...courseInterests, { value: "non-so", label: "Non sono sicuro, vorrei consigli" }]);
      }
    };
    fetchCourses();
  }, []);

  // Track funnel step: page visit
  useEffect(() => {
    trackFunnelStep('booking_funnel', 1, 'page_visit');
  }, [trackFunnelStep]);

  // Track form start when user first interacts
  const handleFormFocus = () => {
    if (!formStartTracked.current) {
      formStartTracked.current = true;
      trackFormStart('booking_form');
      trackFunnelStep('booking_funnel', 2, 'form_start');
    }
  };

  const onSubmit = async (data: BookingFormData) => {
    setIsSubmitting(true);
    
    // Track funnel step: form submit attempt
    trackFunnelStep('booking_funnel', 3, 'form_submit_attempt');

    try {
      // Submit booking through secure Edge Function with rate limiting
      const { data: bookingResult, error: bookingError } = await supabase.functions.invoke("submit-booking", {
        body: {
          parentName: data.parentName,
          email: data.email,
          phone: data.phone,
          childAge: data.childAge ? parseInt(data.childAge) : null,
          interest: data.interest || null,
          availability: null,
          message: null,
          adminEmail: ADMIN_EMAIL,
        },
      });

      if (bookingError) {
        console.error("Booking error:", bookingError);
        trackFormError('booking_form', bookingError.message || 'Booking error');
        throw new Error("Errore nell'invio della richiesta");
      }

      if (!bookingResult?.success) {
        trackFormError('booking_form', bookingResult?.error || 'Unknown error');
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

      // Track successful conversion
      trackFormSubmit('booking_form', {
        interest: data.interest,
        child_age: data.childAge,
        has_phone: !!data.phone,
      });
      
      trackBookingConversion({
        interest: data.interest,
        child_age: data.childAge,
      });

      setIsSubmitted(true);
    } catch (error: any) {
      console.error("Submission error:", error);
      trackFormError('booking_form', error.message || 'Submission error');
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
      <SEOHead
        title="Prenota Lezione di Prova Gratuita | Corsi Coding Bambini | TECHLAND"
        description="Prenota una lezione di prova gratuita per il tuo bambino. Scopri i nostri corsi di programmazione per bambini e ragazzi 6-18 anni. Nessun impegno!"
        canonical="/prenota"
      />
      <section className="tech-section bg-gradient-to-b from-tech-green-light to-background dark:from-background dark:to-background">
        <div className="tech-container">
          <SEOBreadcrumb 
            items={[{ label: "Prenota Lezione Gratuita" }]} 
            className="mb-8"
          />
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Info Column */}
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Prenota una lezione di coding{" "}
                <span className="tech-gradient-text">gratuita</span> per il tuo bambino
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Scopri TECHLAND con una lezione di prova senza impegno. Valuteremo insieme il percorso di programmazione migliore per il tuo bambino.
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
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" onFocus={handleFormFocus}>
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
                        <FormLabel>Telefono *</FormLabel>
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

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="childAge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Età dell'alunno (opzionale)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-12">
                                <SelectValue placeholder="Seleziona" />
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
                          <FormLabel>Interesse (opzionale)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} defaultValue="non-so">
                            <FormControl>
                              <SelectTrigger className="h-12">
                                <SelectValue placeholder="Non sono sicuro" />
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
                  </div>

                  <FormField
                    control={form.control}
                    name="privacyAccepted"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value === true}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal cursor-pointer">
                            Accetto la{" "}
                            <Link to="/privacy" className="text-primary hover:underline" target="_blank">
                              Privacy Policy
                            </Link>{" "}
                            di TECHLAND e acconsento a essere contattato. *
                          </FormLabel>
                          <FormMessage />
                        </div>
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
                </form>
              </Form>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
