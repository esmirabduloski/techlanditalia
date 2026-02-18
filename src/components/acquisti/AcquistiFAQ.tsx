import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Come funziona il pagamento?",
    a: "Il pagamento avviene in modo sicuro tramite Stripe. Accettiamo carte di credito, debito e altri metodi di pagamento elettronici.",
  },
  {
    q: "Posso ottenere un rimborso?",
    a: "Sì, offriamo una garanzia soddisfatti o rimborsati entro 14 giorni dall'acquisto. Contattaci e ti rimborseremo senza domande.",
  },
  {
    q: "Cosa succede dopo l'acquisto?",
    a: "Riceverai una conferma via email con tutte le istruzioni per iniziare. Ti contatteremo per organizzare le lezioni nel giorno e orario più comodo.",
  },
  {
    q: "Le lezioni sono individuali o di gruppo?",
    a: "Le lezioni si svolgono in piccoli gruppi di massimo 4 studenti, per garantire attenzione personalizzata a ogni ragazzo.",
  },
];

export function AcquistiFAQ() {
  return (
    <div className="mt-12 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-foreground mb-4 text-center">
        Domande frequenti sull'acquisto
      </h2>
      <Accordion type="single" collapsible className="w-full">
        {faqs.map((faq, i) => (
          <AccordionItem key={i} value={`faq-${i}`}>
            <AccordionTrigger className="text-left text-sm">
              {faq.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
