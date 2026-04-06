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
import { CheckCircle2, Calendar, Video, Shield, Instagram } from "lucide-react";
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
];

const bookingSchema = z.object({
  parentName: z.string().trim().min(2, "Il nome deve avere almeno 2 caratteri").max(100, "Nome troppo lungo"),
  email: z.string().trim().email("Inserisci un'email valida").max(255, "Email troppo lunga"),
  phone: z.string().trim().min(1, "Inserisci il numero di telefono").max(20, "Numero troppo lungo").regex(/^[\d\s+\-()]{6,}$/, "Inserisci un numero di telefono valido (almeno 6 cifre)"),
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
        const courseInterests = data.map(c => {
          // Extract the first number from age_range to show as "X+"
          const ageMatch = c.age_range?.match(/(\d+)/);
          const ageLabel = ageMatch ? ` (${ageMatch[1]}+)` : '';
          return {
            value: c.slug,
            label: `${c.emoji} ${c.title}${ageLabel}`,
          };
        });
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
        // Try to extract the actual error message from the edge function response
        let errorMessage = "Errore nell'invio della richiesta";
        try {
          const errorContext = bookingError?.context;
          if (errorContext && typeof errorContext === 'object') {
            const body = await errorContext.json?.();
            if (body?.error) errorMessage = body.error;
          } else if (bookingError.message?.includes('429')) {
            errorMessage = "Hai già inviato una richiesta di recente. Ti contatteremo presto!";
          }
        } catch {}
        trackFormError('booking_form', errorMessage);
        throw new Error(errorMessage);
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
        <section className="tech-section min-h-[60vh] flex items-center px-2 sm:px-4 overflow-hidden">
          <div className="tech-container">
            <div className="max-w-xl mx-auto text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 rounded-full bg-tech-green/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-tech-green" />
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
                Richiesta ricevuta!
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8">
                Grazie per aver scelto TECHLAND. Ti contatteremo entro 24 ore per confermare la lezione di prova gratuita e rispondere a tutte le tue domande.
              </p>
              <div className="tech-card p-4 sm:p-6 text-left">
                <h3 className="font-semibold mb-3 sm:mb-4">Cosa succede ora?</h3>
                <ol className="space-y-3 text-sm sm:text-base text-muted-foreground">
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

              <div className="flex flex-col gap-3 sm:gap-4 mt-6 sm:mt-8">
                <Button
                  asChild
                  variant="hero"
                  size="lg"
                  className="w-full"
                >
                  <a
                    href="https://wa.me/message/KHFBHZDEY3S7H1"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg className="w-5 h-5 mr-2 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Scrivici su WhatsApp
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  <a
                    href="https://www.instagram.com/techlanditalia/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center"
                  >
                    <Instagram className="w-5 h-5 mr-2 flex-shrink-0" />
                    <span className="text-sm sm:text-base">Seguici e supportaci su Instagram!</span>
                  </a>
                </Button>
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
        keywords="lezione prova gratuita coding bambini, prenotare corso programmazione, lezione gratuita coding, prova gratis corso bambini, iscrizione corso programmazione"
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "Offer",
            "name": "Lezione di Prova Gratuita di Coding per Bambini",
            "description": "Prenota una lezione di prova completamente gratuita e senza impegno per il tuo bambino",
            "price": "0",
            "priceCurrency": "EUR",
            "availability": "https://schema.org/InStock",
            "url": "https://techlanditalia.it/prenota",
            "seller": {
              "@type": "EducationalOrganization",
              "name": "TECHLAND",
              "url": "https://techlanditalia.it"
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://techlanditalia.it/" },
              { "@type": "ListItem", "position": 2, "name": "Prenota Lezione Gratuita", "item": "https://techlanditalia.it/prenota" }
            ]
          }
        ]}
      />
      <section className="tech-section bg-gradient-to-b from-tech-green-light to-background dark:from-background dark:to-background px-2 sm:px-4 overflow-hidden">
        <div className="tech-container">
          <SEOBreadcrumb 
            items={[{ label: "Prenota Lezione Gratuita" }]} 
            className="mb-6 sm:mb-8"
          />
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
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

              <div className="tech-card p-4 sm:p-6 bg-secondary/10 border-secondary/20 overflow-hidden">
                <p className="text-sm">
                  <strong>💡 Suggerimento:</strong> Fai partecipare il tuo bambino alla chiamata! Così potrà conoscere l'ambiente e fare domande direttamente al docente.
                </p>
              </div>
            </div>

            {/* Form Column */}
            <div className="tech-card p-4 sm:p-6 lg:p-8 overflow-hidden">
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
                            autoComplete="name"
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
                            autoComplete="email"
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
                            autoComplete="tel"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                              {Array.from({ length: 16 }, (_, i) => i + 5).map((age) => (
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
                          <FormLabel>Corso d'interesse (opzionale)</FormLabel>
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
