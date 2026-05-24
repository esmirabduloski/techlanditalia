import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollReveal } from "@/components/animations/ScrollReveal";

const faqs = [
  {
    question: "Qual è l'età minima per iniziare?",
    answer: "I nostri corsi partono dai 5 anni. Per i bambini più piccoli (5-8 anni) utilizziamo strumenti visivi come Scratch, che permettono di imparare la logica della programmazione senza dover scrivere codice complesso.",
  },
  {
    question: "Quanto costano i corsi?",
    answer: "I prezzi variano in base al tipo di corso e alla durata. Offriamo piani mensili a partire da €99/mese con lezioni settimanali. La prima lezione è sempre gratuita e senza impegno.",
  },
  {
    question: "Di cosa ha bisogno mio figlio per partecipare?",
    answer: "Serve un computer (PC o Mac) con una connessione internet stabile e una webcam. Per alcuni corsi avanzati potrebbero esserci requisiti specifici che comunicheremo prima dell'iscrizione.",
  },
  {
    question: "Come funzionano le lezioni?",
    answer: "Le lezioni si svolgono online in diretta, in piccoli gruppi di massimo 6 studenti. Ogni lezione dura 60-90 minuti a seconda dell'età. I docenti interagiscono costantemente con gli studenti.",
  },
  {
    question: "Posso recuperare le lezioni perse?",
    answer: "Assolutamente sì! Tutte le lezioni vengono registrate e sono disponibili nella tua area riservata. Inoltre, puoi concordare lezioni di recupero con il tuo tutor di riferimento.",
  },
  {
    question: "Come monitoro i progressi di mio figlio?",
    answer: "Avrai accesso a una dashboard genitori con report settimanali, feedback dei docenti, registrazioni delle lezioni e i progetti realizzati dal tuo bambino.",
  },
  {
    question: "Posso disdire in qualsiasi momento?",
    answer: "Sì, non ci sono vincoli di durata. Puoi mettere in pausa o disdire l'abbonamento in qualsiasi momento dalla tua area riservata.",
  },
  {
    question: "I docenti sono qualificati?",
    answer: "Tutti i nostri docenti sono professionisti del settore tech con esperienza nell'insegnamento ai giovani. Seguono una formazione specifica sulla didattica per bambini e ragazzi.",
  },
];

export function FAQSection() {
  return (
    <section className="tech-section bg-muted/30 dark:border-t dark:border-border/40" id="faq">
      <div className="tech-container">
        <ScrollReveal className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Domande frequenti
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Hai dubbi? Ecco le risposte alle domande più comuni dei genitori.
          </p>
        </ScrollReveal>

        <ScrollReveal className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card rounded-2xl border border-border/50 px-6 data-[state=open]:shadow-tech-md transition-shadow"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline py-6">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
