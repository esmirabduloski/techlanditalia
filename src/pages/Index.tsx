import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/sections/HeroSection";
import { WhyTechlandSection } from "@/components/sections/WhyTechlandSection";
import { CoursesPreviewSection } from "@/components/sections/CoursesPreviewSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { ParentsSection } from "@/components/sections/ParentsSection";
import { FAQSection } from "@/components/sections/FAQSection";
import { CTASection } from "@/components/sections/CTASection";
import { SEOHead, organizationSchema, websiteSchema, generateFAQSchema } from "@/components/seo/SEOHead";

const homepageFaqs = [
  { question: "Qual è l'età minima per iniziare?", answer: "I nostri corsi partono dai 5 anni. Per i bambini più piccoli (5-8 anni) utilizziamo strumenti visivi come Scratch, che permettono di imparare la logica della programmazione senza dover scrivere codice complesso." },
  { question: "Quanto costano i corsi?", answer: "I prezzi variano in base al tipo di corso e alla durata. Offriamo piani mensili a partire da €99/mese con lezioni settimanali. La prima lezione è sempre gratuita e senza impegno." },
  { question: "Come funzionano le lezioni?", answer: "Le lezioni si svolgono online in diretta, in piccoli gruppi di massimo 6 studenti. Ogni lezione dura 60-90 minuti a seconda dell'età. I docenti interagiscono costantemente con gli studenti." },
  { question: "Di cosa ha bisogno mio figlio per partecipare?", answer: "Serve un computer (PC o Mac) con una connessione internet stabile e una webcam. Per alcuni corsi avanzati potrebbero esserci requisiti specifici che comunicheremo prima dell'iscrizione." },
  { question: "Posso recuperare le lezioni perse?", answer: "Assolutamente sì! Tutte le lezioni vengono registrate e sono disponibili nella tua area riservata. Inoltre, puoi concordare lezioni di recupero con il tuo tutor di riferimento." },
  { question: "Come monitoro i progressi di mio figlio?", answer: "Avrai accesso a una dashboard genitori con report settimanali, feedback dei docenti, registrazioni delle lezioni e i progetti realizzati dal tuo bambino." },
  { question: "I docenti sono qualificati?", answer: "Tutti i nostri docenti sono professionisti del settore tech con esperienza nell'insegnamento ai giovani. Seguono una formazione specifica sulla didattica per bambini e ragazzi." },
  { question: "Posso disdire in qualsiasi momento?", answer: "Sì, non ci sono vincoli di durata. Puoi mettere in pausa o disdire l'abbonamento in qualsiasi momento dalla tua area riservata." },
];

const homepageFaqSchema = generateFAQSchema(homepageFaqs);

const howItWorksSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Come iniziare un corso di programmazione per bambini con TECHLAND",
  "description": "Guida passo passo per iscrivere il tuo bambino ai corsi di coding TECHLAND",
  "step": [
    { "@type": "HowToStep", "position": 1, "name": "Scegli il corso", "text": "Esplora i nostri percorsi e trova quello più adatto all'età e agli interessi del tuo bambino." },
    { "@type": "HowToStep", "position": 2, "name": "Prenota la prova gratuita", "text": "Prenota una lezione gratuita di prova per far conoscere TECHLAND al tuo bambino." },
    { "@type": "HowToStep", "position": 3, "name": "Segui le lezioni live", "text": "Lezioni online in piccoli gruppi con docenti esperti. Interazione e divertimento garantiti." },
    { "@type": "HowToStep", "position": 4, "name": "Monitora i progressi", "text": "Ricevi report dettagliati, accedi alle registrazioni e vedi i progetti realizzati." },
  ],
};

const Index = () => {
  return (
    <Layout>
      <SEOHead
        title="TECHLAND | Corsi di Programmazione e Coding per Bambini e Ragazzi Online"
        description="TECHLAND è la scuola di coding online per bambini e ragazzi 6-18 anni. Corsi di Scratch, Roblox, Minecraft, Python, Unity in piccoli gruppi. Prima lezione gratis!"
        canonical="/"
        keywords="TECHLAND, Techland corsi, Techland coding, Techland Italia, Techland programmazione bambini, corsi programmazione bambini, corsi coding bambini online, scuola coding bambini Italia, corso Scratch bambini, corso Roblox bambini, corso Python ragazzi, corso Minecraft bambini, imparare a programmare"
        structuredData={[organizationSchema, websiteSchema, homepageFaqSchema, howItWorksSchema]}
      />
      <HeroSection />
      <WhyTechlandSection />
      <CoursesPreviewSection />
      <HowItWorksSection />
      <ParentsSection />
      <FAQSection />
      <CTASection />
    </Layout>
  );
};

export default Index;
