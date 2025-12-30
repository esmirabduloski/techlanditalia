import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, ArrowRight } from "lucide-react";
import { SEOHead, generateFAQSchema } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";

const faqCategories = [
  {
    title: "Informazioni sui corsi",
    faqs: [
      {
        question: "A quali fasce d'età si riferisce il corso?",
        answer: "I nostri corsi sono pensati per bambini e ragazzi dai 6 ai 17 anni. Abbiamo programmi specifici per ogni fascia d'età: 6-9 anni (corsi base con Scratch), 10-12 anni (programmazione visuale avanzata e Roblox), 13-17 anni (Python, sviluppo web e game design)."
      },
      {
        question: "Quali competenze otterrà mio/a figlio/a?",
        answer: "Al termine del corso, tuo figlio avrà acquisito competenze di programmazione, problem solving, pensiero computazionale e logica. A seconda del corso scelto, saprà creare giochi, animazioni, siti web o applicazioni. Svilupperà anche soft skills come la creatività, la collaborazione e la capacità di presentare i propri progetti."
      },
      {
        question: "Qual è la frequenza delle lezioni? Quale sarà il formato delle lezioni?",
        answer: "Le lezioni si svolgono una volta a settimana, ogni sessione dura 90 minuti. Le lezioni sono live, in diretta con un insegnante, in piccoli gruppi di massimo 6 studenti per garantire attenzione personalizzata. Gli orari sono flessibili e concordati in base alle esigenze della famiglia."
      },
      {
        question: "Come sono tenute le lezioni?",
        answer: "Le lezioni si svolgono online tramite una piattaforma video interattiva. L'insegnante condivide lo schermo, spiega i concetti e guida gli studenti passo dopo passo. Gli studenti possono fare domande in tempo reale e condividere il proprio schermo per ricevere feedback immediato."
      },
      {
        question: "Mio figlio otterrà un certificato alla fine di questo corso?",
        answer: "Sì! Al completamento di ogni corso, lo studente riceverà un certificato Techland che attesta le competenze acquisite. Inoltre, avrà un portfolio con tutti i progetti realizzati durante il corso."
      }
    ]
  },
  {
    title: "Lezione di prova e iscrizione",
    faqs: [
      {
        question: "Come funziona la lezione di prova?",
        answer: "La lezione di prova è completamente gratuita e senza impegno. Durante questa sessione, lo studente incontra l'insegnante, conosce i compagni di classe e prova un'attività pratica del corso scelto. È l'occasione perfetta per capire se il corso è adatto alle esigenze di tuo figlio."
      },
      {
        question: "Quanto costa?",
        answer: "I prezzi variano in base al tipo di corso e alla durata. Offriamo piani mensili flessibili e la possibilità di acquistare pacchetti di lezioni a prezzi vantaggiosi. Contattaci per ricevere un preventivo personalizzato in base alle tue esigenze."
      },
      {
        question: "Quanto costa una lezione? Avete un piano di rateizzazione o un programma di referral?",
        answer: "Sì, offriamo piani di rateizzazione per rendere i nostri corsi accessibili a tutti. Abbiamo anche un programma referral: se inviti un amico, entrambi riceverete uno sconto sulla prossima iscrizione!"
      }
    ]
  },
  {
    title: "Requisiti tecnici",
    faqs: [
      {
        question: "Quali sono i requisiti tecnici per seguire le lezioni?",
        answer: "Per partecipare alle lezioni è necessario un computer (PC o Mac) con una connessione internet stabile (almeno 10 Mbps), webcam e microfono. Per alcuni corsi specifici come Roblox Studio o Unity potrebbero esserci requisiti hardware aggiuntivi che comunicheremo prima dell'iscrizione."
      },
      {
        question: "Possiamo unirci alle lezioni usando dispositivi mobili: telefoni o tablet?",
        answer: "Purtroppo no. Per programmare e seguire correttamente le lezioni è necessario un computer. Telefoni e tablet non permettono di utilizzare gli strumenti di programmazione in modo efficace. Se non hai un computer disponibile, contattaci: cercheremo insieme una soluzione."
      }
    ]
  },
  {
    title: "Supporto e flessibilità",
    faqs: [
      {
        question: "Avremo dei supervisori? Ci sarà una chat di supporto?",
        answer: "Sì! Ogni studente è seguito da un tutor di riferimento che monitora i progressi e risponde alle domande. I genitori hanno accesso a una dashboard dedicata e possono contattare il supporto via email o chat per qualsiasi necessità."
      },
      {
        question: "Che succede se mio figlio/a salta una lezione o se le lezioni vengono cancellate?",
        answer: "Tutte le lezioni vengono registrate e sono disponibili nella tua area riservata. Se il tuo bambino perde una lezione, può recuperarla guardando la registrazione. Inoltre, offriamo la possibilità di prenotare lezioni di recupero con il tutor."
      },
      {
        question: "Possiamo cambiare insegnante/corso/orari?",
        answer: "Certo! Siamo flessibili e vogliamo che ogni studente abbia la migliore esperienza possibile. Se hai bisogno di cambiare orario, corso o insegnante, contatta il nostro supporto e troveremo insieme la soluzione migliore."
      },
      {
        question: "Possiamo richiedere un rimborso se cambiamo idea?",
        answer: "Sì, offriamo una garanzia soddisfatti o rimborsati. Se non sei soddisfatto del corso entro le prime due lezioni, puoi richiedere un rimborso completo. Consulta i nostri Termini e Condizioni per maggiori dettagli."
      }
    ]
  },
  {
    title: "Insegnanti e progressi",
    faqs: [
      {
        question: "Chi saranno i tuoi tutor?",
        answer: "I nostri insegnanti sono professionisti del settore tech con esperienza nell'insegnamento ai giovani. Tutti hanno una formazione specifica sulla didattica per bambini e ragazzi, e vengono selezionati non solo per le competenze tecniche ma anche per la capacità di coinvolgere e motivare gli studenti."
      },
      {
        question: "Come possono tenere traccia dei progressi di mio/a figlio/a?",
        answer: "Ogni genitore ha accesso a una dashboard personale dove può visualizzare: i report settimanali dell'insegnante, i voti e i feedback sui compiti, le registrazioni delle lezioni, i progetti completati e i punti/badge guadagnati dal proprio figlio."
      }
    ]
  },
  {
    title: "Sicurezza e affidabilità",
    faqs: [
      {
        question: "Come potete provare che l'azienda è reale? Siete una truffa?",
        answer: "Techland è un'azienda regolarmente registrata in Italia. Siamo partner di importanti realtà nel settore dell'educazione tecnologica. Puoi leggere le recensioni dei nostri studenti, visitare i nostri social media e contattarci in qualsiasi momento. Offriamo una lezione di prova gratuita proprio per permetterti di valutare la qualità del nostro servizio senza rischi."
      }
    ]
  }
];

export default function FAQ() {
  // Flatten all FAQs for schema
  const allFaqs = faqCategories.flatMap(cat => cat.faqs);
  const faqSchema = generateFAQSchema(allFaqs);

  return (
    <Layout>
      <SEOHead
        title="FAQ Corsi di Programmazione per Bambini | TECHLAND"
        description="Domande frequenti sui corsi di coding per bambini e ragazzi TECHLAND. Prezzi, requisiti, lezioni di prova, certificati e molto altro."
        canonical="/faq"
        structuredData={faqSchema}
      />
      
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-br from-tech-purple/10 via-tech-cyan/5 to-background overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="tech-container relative">
          <SEOBreadcrumb 
            items={[{ label: "FAQ" }]} 
            className="mb-8 justify-center"
          />
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
              <HelpCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Centro assistenza</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Domande frequenti sui <span className="text-gradient">corsi di coding per bambini</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              Trova le risposte alle domande più frequenti sui nostri corsi di programmazione per bambini e ragazzi.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-16 md:py-24">
        <div className="tech-container">
          <div className="max-w-4xl mx-auto space-y-12">
            {faqCategories.map((category, categoryIndex) => (
              <div key={categoryIndex}>
                <h2 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-3">
                  <span className="w-2 h-8 bg-gradient-hero rounded-full" />
                  {category.title}
                </h2>
                <Accordion type="single" collapsible className="space-y-3">
                  {category.faqs.map((faq, faqIndex) => (
                    <AccordionItem
                      key={faqIndex}
                      value={`${categoryIndex}-${faqIndex}`}
                      className="bg-card rounded-2xl border border-border/50 px-6 data-[state=open]:shadow-tech-md transition-shadow"
                    >
                      <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground pb-5">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-primary/5 via-tech-cyan/5 to-background">
        <div className="tech-container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Non hai trovato la risposta che cercavi?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Il nostro team è sempre pronto ad aiutarti. Prenota una lezione di prova gratuita e parlaci delle tue esigenze.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="cta" size="lg" asChild>
                <Link to="/prenota">
                  Prenota lezione gratuita
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/chi-siamo">
                  Scopri chi siamo
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
