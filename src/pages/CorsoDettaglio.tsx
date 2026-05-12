import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import NotFound from "./NotFound";
import { useFormAntiSpam } from "@/hooks/useFormAntiSpam";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Layout } from "@/components/layout/Layout";
import { CourseEmoji } from "@/components/ui/CourseEmoji";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Clock, Users, ArrowLeft, CheckCircle2, Calendar, 
  BookOpen, Target, Rocket, GraduationCap, Presentation, Code2, Lightbulb
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead, generateCourseSchema, generateBreadcrumbSchema } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";

// Course data based on Kodland content
const coursesData: Record<string, {
  title: string;
  emoji: string;
  description: string;
  longDescription: string;
  tags: string[];
  age: string;
  level: string;
  duration: string;
  topics: string[];
  projectExamples: { title: string; image?: string }[];
  modules: { title: string; lessons: string[]; result: string }[];
}> = {
  "minecraft-education": {
    title: "Minecraft Education",
    emoji: "⛏️",
    description: "Impara le basi della logica, della programmazione e dell'automazione attraverso l'amato ambiente di gioco di Minecraft Education.",
    longDescription: "Questo corso è perfetto sia per i bambini appassionati di Minecraft che per quelli che stanno appena iniziando a esplorare questo mondo. Offre una nuova prospettiva sul gioco, collegandolo alla programmazione, alla meccanica, al design e al pensiero ingegneristico. Passo dopo passo, gli studenti acquisiranno familiarità con l'ambiente Minecraft Education, automatizzeranno una serie di processi utilizzando redstone, progetteranno fattorie avanzate e svilupperanno le proprie costruzioni e meccanismi. Attraverso la programmazione basata su blocchi in MakeCode, i bambini scriveranno semplici algoritmi, controlleranno i loro agenti e interagiranno con il mondo di gioco tramite il codice.",
    tags: ["Minecraft", "MakeCode", "Programmazione a blocchi", "Automazione", "Redstone"],
    age: "8-9 anni",
    level: "Principiante",
    duration: "40 lezioni",
    topics: [
      "Sviluppare una comprensione degli algoritmi e dei principi essenziali della programmazione",
      "Imparare a utilizzare MakeCode per creare fattorie automatizzate, trappole e meccanismi",
      "Ampliare i propri orizzonti esplorando la logica dei giochi e le interazioni",
      "Sviluppare capacità di lavoro di squadra attraverso la costruzione collaborativa",
      "Padroneggiare le basi della programmazione basata su blocchi",
    ],
    projectExamples: [
      { title: "Fattorie automatizzate" },
      { title: "Mini-giochi personalizzati" },
      { title: "Città intelligente con automazione" },
    ],
    modules: [
      {
        title: "Modulo 1. Il nuovo coraggioso mondo della Pietra Verde",
        lessons: [
          "1. Introduzione al mondo di Minecraft. Esplorazione di Minecraft Education e MakeCode",
          "2. Esplorazione dei comandi di movimento e mini-missione con labirinto",
          "3. Dalle azioni semplici agli algoritmi. Apprendimento del ciclo di ripetizione",
          "4. Costruire in squadra. Pianificare e costruire un edificio semplice",
          "5. Lavorare con redstone per creare porte automatizzate",
          "6. Utilizzare redstone e osservatori per costruire una fattoria complessa",
          "7. Studiare i meccanismi in squadra per lo sviluppo della città",
          "8. Completare la costruzione della città con MakeCode",
        ],
        result: "Il bambino imparerà le basi dell'algoritmizzazione, della logica dei loop e del controllo degli agenti, realizzando le prime costruzioni automatizzate.",
      },
      {
        title: "Modulo 2. La Città della Luce – Costruire il Futuro insieme",
        lessons: [
          "9. Comprensione delle coordinate per la costruzione ad alta precisione",
          "10. Progettazione di costruzioni su larga scala con loop annidati",
          "11. Un progetto Agent – costruzione di un ponte sul fiume",
          "12. Clonare oggetti per costruzioni simmetriche",
          "13. Progettare una casa intelligente con automazione",
          "14. Pianificare la disposizione delle strade e dei quartieri",
          "15. Un progetto collaborativo – sviluppare il centro della città",
          "16. Completamento del progetto finale – il 'Quartiere intelligente'",
        ],
        result: "Il bambino imparerà a utilizzare le coordinate e la clonazione in MakeCode per creare oggetti impressionanti e su larga scala.",
      },
      {
        title: "Modulo 3. Oasi della Logica – Creare Puzzle e giochi Divertenti",
        lessons: [
          "17. Introduzione agli eventi e alle condizioni",
          "18. Variabili e contatori per tenere traccia dei punteggi",
          "19. È ora di intrappolare i mob! Programmare trappole",
          "20. Progettazione del gioco 'Trova il pulsante'",
          "21. Sviluppo del gioco 'Fuggi dalla lava'",
          "22. Aggiunta di una zona di teletrasporto",
          "23. Test e bilanciamento del gioco",
          "24. Completare il progetto finale: 'Il mio gioco'",
        ],
        result: "Il bambino acquisirà comprensione di logica, istruzioni condizionali, variabili ed eventi, creando un gioco personalizzato controllato dal codice.",
      },
      {
        title: "Modulo 4. Una Foresta Meccanica – Automazione dei Sistemi Viventi",
        lessons: [
          "25. Introduzione all'automazione – come funzionano le fattorie automatiche",
          "26. Programmare un agente giardiniere",
          "27. Costruire catene logiche condizionali",
          "28. Progettare un selezionatore di risorse",
          "29. Sviluppare una mob farm",
          "30. Costruire un sistema di stoccaggio automatizzato",
          "31. Manutenzione e ottimizzazione delle fattorie",
          "32. Completamento del progetto finale: la 'fattoria intelligente'",
        ],
        result: "Il bambino capirà come automatizzare i processi, sviluppare un pensiero sistematico e creare circuiti complessi.",
      },
      {
        title: "Modulo 5. La Fortezza del Creator – Dare Vita ai Sogni",
        lessons: [
          "33. Generare idee e selezionare un progetto",
          "34. Creare un piano di progetto e assegnare i ruoli",
          "35. Scrivere le prime righe di codice per i meccanismi base",
          "36. Perfezionare le creazioni aggiungendo logica e automazione",
          "37. Lavorare con le funzioni riutilizzabili",
          "38. Gestire gli eventi per rispondere alle azioni dei giocatori",
          "39. Aggiungere gli ultimi ritocchi e decorazioni",
          "40. Presentare e difendere il progetto davanti alla classe",
        ],
        result: "Il bambino svilupperà un progetto da zero, dall'idea al codice, affinando le capacità di presentazione e la risoluzione creativa dei problemi.",
      },
    ],
  },
  "abc-creativita-digitale": {
    title: "L'ABC della creatività digitale",
    emoji: "🎨",
    description: "Un corso online per bambini dai 5 ai 7 anni, incentrato sulle basi del design digitale e dell'alfabetizzazione informatica.",
    longDescription: "FunTech Creators è un corso online per bambini dai 5 ai 7 anni, incentrato sulle basi del design digitale e dell'alfabetizzazione informatica. In esso, i bambini imparano a utilizzare editor grafici, creare biglietti di auguri, poster e semplici presentazioni. Acquisiscono padronanza di Google Docs e importanti competenze informatiche. Il corso è condotto in un formato ludico e sviluppa il pensiero creativo e logico.",
    tags: ["Design digitale", "Creatività", "Google Docs", "Canva", "Animazione"],
    age: "5-7 anni",
    level: "Principiante",
    duration: "32 lezioni",
    topics: [
      "Sviluppare il pensiero creativo e immaginativo degli studenti",
      "Insegnare ad utilizzare gli strumenti di base del design digitale",
      "Creare progetti interessanti in Canva",
      "Imparare a lavorare con testo e immagini in Google Docs e Google Slides",
      "Apprendere le basi dell'alfabetizzazione informatica e della sicurezza online",
    ],
    projectExamples: [
      { title: "Biglietti di auguri digitali" },
      { title: "Poster e presentazioni" },
      { title: "Animazioni GIF e melodie" },
    ],
    modules: [
      {
        title: "Modulo 1. Scoprire il Mondo Digitale",
        lessons: [
          "1. L'avventura dei tasti: conoscere il mouse e la tastiera",
          "2. I miei primi disegni: introduzione alla grafica computerizzata",
          "3. Imparare l'animazione: creare GIF",
          "4. Lo studio musicale: creare una melodia",
        ],
        result: "I bambini impareranno a conoscere il computer: useranno mouse e tastiera, creeranno i loro primi disegni digitali, animazioni GIF e melodie.",
      },
      {
        title: "Modulo 2. Un'Avventura a Colorville",
        lessons: [
          "5. Alla ricerca di una stella perduta",
          "6. Il festival delle forme magiche a Colorville",
          "7. Salvare la Galleria delle Meraviglie a Colorville",
          "8. Festeggiamenti a Colorville",
        ],
        result: "I bambini impareranno a utilizzare un editor grafico, a disegnare con linee e forme e a creare i loro primi disegni!",
      },
      {
        title: "Modulo 3. Avventure nella valle dei dati",
        lessons: [
          "9. Foto fantastiche nell'Art Studio!",
          "10. La magia del testo e i nostri fumetti!",
          "11. Masterclass di progettazione di poster",
          "12. Una cartolina dalla Valle dei Dati",
        ],
        result: "I bambini acquisiranno familiarità con la struttura dei file, impareranno cos'è Internet e creeranno fumetti, poster e cartoline digitali.",
      },
      {
        title: "Modulo 4. Un'avventura nel mondo della conoscenza",
        lessons: [
          "13. Il viaggio attraverso i mari di Internet",
          "14. La magia delle parole in Google Documenti",
          "15. Un artista del testo",
          "16. I cacciatori di conoscenza",
        ],
        result: "I bambini impareranno a creare e modificare documenti in Google Docs, con conoscenze sulla sicurezza in Internet.",
      },
      {
        title: "Modulo 5. Laboratorio di immaginazione",
        lessons: [
          "17. Stimola la tua creatività con i Droodles!",
          "18. La febbre degli adesivi a Canva",
          "19. La routine quotidiana in immagini",
          "20. I capolavori dei giovani maestri di Canva",
        ],
        result: "I bambini svilupperanno il pensiero creativo creando adesivi e progettando le loro routine in Canva!",
      },
      {
        title: "Modulo 6. Cartoon Studio",
        lessons: [
          "21. I primi passi nel Mondo dell'Animazione",
          "22. Disegni danzanti",
          "23. Andiamo a una festa danzante!",
          "24. Piccoli detective: risolvere enigmi",
        ],
        result: "I bambini impareranno a creare animazioni in Flipanim e a trasformarle in veri video!",
      },
      {
        title: "Modulo 7. Cyber Creator",
        lessons: [
          "25. Primi passi in Google Presentazioni",
          "26. Continuiamo a scrivere la nostra storia in Google Presentazioni",
          "27. Le diapositive prendono vita!",
          "28. Gara a squadre: Salvare TechnoTown",
        ],
        result: "I bambini impareranno a creare presentazioni colorate in Google Slides e rafforzeranno le conoscenze con progetti di gruppo.",
      },
      {
        title: "Modulo 8. Attività creative e Modellazione 3D",
        lessons: [
          "29. Il Potere della Creatività: creare storie e personaggi",
          "30. Odissea nello spazio: avventura nell'universo",
          "31. Dare vita a un giardino con la modellazione 3D",
          "32. Scoprire tesori in 3D",
        ],
        result: "I bambini impareranno a creare storie e a presentarle, con un'introduzione alla modellazione 3D!",
      },
    ],
  },
  "abc-informatica": {
    title: "L'ABC dell'informatica",
    emoji: "💻",
    description: "FunTech Explorers è un corso online interattivo che introduce i bambini alle componenti del computer, alle basi della programmazione a blocchi e all'uso del PC.",
    longDescription: "FunTech Explorers è un corso online divertente e interattivo, pensato per introdurre i bambini alle principali componenti del computer, alle basi della programmazione a blocchi e all'uso del computer. Gli studenti svilupperanno il pensiero logico e critico attraverso giochi, strumenti interattivi e progetti creativi. Il corso affronterà diversi argomenti presentati in modo non lineare, per mantenere alto l'interesse degli studenti. Sono inclusi anche esercizi supplementari di matematica, utili per sviluppare abilità di calcolo e pensiero algoritmico.",
    tags: ["Programmazione", "Matematica", "Creazione", "Informatica di base", "Uso del computer"],
    age: "5-7 anni",
    level: "Principiante",
    duration: "32 lezioni",
    topics: [
      "Sviluppare il pensiero creativo e la creatività",
      "Insegnare le basi dell'alfabetizzazione digitale",
      "Sviluppare competenze di base nella programmazione a blocchi",
      "Padroneggiare strumenti di creatività digitale per la realizzazione di progetti",
    ],
    projectExamples: [
      { title: "Progetto creativo con Scratch Junior" },
      { title: "Gioco interattivo" },
      { title: "Animazione musicale" },
    ],
    modules: [
      {
        title: "Modulo 1. Scoprire il Mondo Digitale",
        lessons: [
          "1. Conoscere il mouse e la tastiera",
          "2. All'avventura! Imparare gli algoritmi",
          "3. Viaggiare con un robot! Giocare con giochi di digitazione e imparare le sequenze",
          "4. La città del futuro: affrontare sfide logiche nel nostro viaggio",
        ],
        result: "Grazie a questo modulo, i bambini impareranno a conoscere il computer: impareranno a usare il mouse e a digitare sulla tastiera. Inoltre, creeranno i loro primi algoritmi e risolveranno molti problemi logici.",
      },
      {
        title: "Modulo 2. Un entusiasmante Viaggio nel Coding",
        lessons: [
          "5. Nozioni di base sulla programmazione: sequenzialità e abilità di digitazione",
          "6. Ripetizioni divertenti e puzzle: una lezione sui cicli e sulla logica",
          "7. Puzzle logici e piattaforma degli avventurieri",
          "8. Il Laboratorio di Giochi. Migliora le tue abilità di digitazione!",
        ],
        result: "Grazie a questo modulo, i bambini continueranno i loro studi di programmazione e problemi logici. Impareranno il concetto di loop e come risolvere sequenze complesse.",
      },
      {
        title: "Modulo 3. Avventure nella Valle dei Dati: la Magia del Computer",
        lessons: [
          "9. Little Bit e la valle dei dati",
          "10. La grande avventura delle cartelle",
          "11. Viaggiando attraverso il World Wide Web",
          "12. Il detective dei dati",
        ],
        result: "Grazie a questo modulo, i bambini acquisiranno familiarità con la struttura dei file di un computer, impareranno cos'è Internet e come esplorarlo con i browser web.",
      },
      {
        title: "Modulo 4. Techno-creators: costruire, cercare, creare!",
        lessons: [
          "13. Una festa da ballo con Scratch Junior",
          "14. Costruire una fattoria!",
          "15. Andare nello spazio con un razzo!",
          "16. Le quattro stagioni",
        ],
        result: "I bambini creano un cartone animato in Scratch Junior imparando la piattaforma. Rafforzeranno le loro abilità di programmazione a blocchi attraverso la creazione di progetti.",
      },
      {
        title: "Modulo 5. Cyber Sorcery: Un'avventura nel Mondo della Tecnologia!",
        lessons: [
          "17. Il mondo sommerso della programmazione",
          "18. Il potere dei messaggi in Scratch Junior",
          "19. Cartoline dal vivo in Scratch Junior",
          "20. Personaggi dei cartoni animati sullo schermo!",
        ],
        result: "Durante questo modulo, i bambini continueranno lo studio di Scratch Junior. Creeranno il loro gioco e impareranno nuovi blocchi per la programmazione dei giochi.",
      },
      {
        title: "Modulo 6. Avventura nel Mondo dei Numeri e della Tecnologia",
        lessons: [
          "21. I maghi della Matematica: Imparare sui numeri",
          "22. Eroi dei Numeri: il Viaggio della Matematica",
          "23. Google Fogli: Un magico mondo di numeri",
          "24. Google Fogli: il festival dei Numeri",
        ],
        result: "Grazie a questo modulo, i bambini impareranno le operazioni matematiche di base e le applicheranno man mano che vengono introdotti a Google Fogli.",
      },
      {
        title: "Modulo 7. Cyber Creators: Storie, musica e magia",
        lessons: [
          "25. Il mio primo gioco: catturare Zippy",
          "26. Le Avventure nel mondo dei Videogiochi",
          "27. Le Meraviglie dei Videogiochi",
          "28. Lancio Stellare: il mio Gioco è pronto!",
        ],
        result: "Grazie a questo modulo, gli studenti continueranno ad apprendere la programmazione a blocchi in Scratch e creeranno nuovi giochi completi!",
      },
      {
        title: "Modulo 8. La Sfida Finale",
        lessons: [
          "29. Cyber-Revision: Tutto sulle Competenze Digitali",
          "30. Maratona di Programmazione: un Viaggio attraverso il Codice",
          "31. Missione Creativa Finale",
          "32. Il fantastico Diploma: celebrare il successo",
        ],
        result: "Grazie a questo modulo, i bambini potranno ripassare in modo divertente tutto il materiale appreso e creare il proprio portfolio digitale che riflette il percorso compiuto!",
      },
    ],
  },
  "scratch": {
    title: "Programmazione visiva con Scratch",
    emoji: "🧩",
    description: "Con Scratch ogni bambino dà vita a giochi e personaggi, imparando la logica della programmazione a blocchi in modo intuitivo e coinvolgente.",
    longDescription: "Questo corso è per bambini della scuola primaria che vogliono approcciarsi alla sfera dell'Information Technology. Con l'aiuto della programmazione visiva in Scratch, gli studenti saranno in grado di sviluppare non solo il loro pensiero logico ma anche le loro abilità creative. Durante il corso, i bambini trasformeranno vari progetti e impareranno come creare giochi e cartoni in modo indipendente.",
    tags: ["Scratch", "Creatività", "Sviluppo di giochi", "Animazione"],
    age: "8-10 anni",
    level: "Principiante",
    duration: "32 lezioni",
    topics: [
      "Crea i tuoi giochi in 2D",
      "Crea i tuoi personaggi",
      "Crea i tuoi progetti su Scratch",
      "Conoscenza dei concetti di base di algoritmi e programmazione",
      "Abilità di applicare variabili, loop e condizioni",
      "Abilità di creare la fisica dei giochi: scrolling, gravità, cambio di velocità",
    ],
    projectExamples: [
      { title: "Gioco 2D completo" },
      { title: "Animazione interattiva" },
      { title: "Storia animata" },
    ],
    modules: [
      {
        title: "М1: I primi progetti con Scratch",
        lessons: [
          "1. Basi di Scratch. Il primo progetto.",
          "2. Movimento degli Sprite su Scratch.",
          "3. Editor grafico magico. Crea il tuo assistente magico personale!",
          "4. Il Debugging dei progetti. Cos'è un bug?",
          "5. Koddich - una competizione di programmazione per i veri maghi!",
        ],
        result: "Il primissimo progetto Scratch alla Scuola di Magia Kodewarts.",
      },
      {
        title: "М2: Animazioni e Suoni in Kodewarts",
        lessons: [
          "6. Scratch-eventi.",
          "7. Principi di animazione.",
          "8. Sfondi e musica.",
          "9. Crea il tuo gruppo musicale personale!",
        ],
        result: "Un'eccezionale app musicale animata.",
      },
      {
        title: "М3: La magia di creare i giochi",
        lessons: [
          "10. Cos'è un gioco?",
          "11. Giochi per Principianti.",
          "12. Segnare il punteggio: imparare a lavorare con le variabili.",
          "13. Interazione nei giochi.",
          "14. Livelli Bonus. Imparare a rendere i giochi più difficili.",
          "15. Creare un gioco puzzle con Scratch!",
          "16. La seconda stagione di Koddich!",
        ],
        result: "Un gioco completo contenente meccaniche di gameplay base.",
      },
      {
        title: "М4: Il ruolo della narrazione nel processo di sviluppo del gioco",
        lessons: [
          "17. Meccaniche di gameplay - gli ingredienti per un gran gioco!",
          "18. Dialoghi e testi nei giochi.",
          "19. Blocchi personalizzati: perché ci servono e come crearli.",
          "20. Lo sviluppo dello scenario del gioco.",
          "21. Imparare come creare personaggi e scene dirette.",
          "22. Cercando bug!",
          "23. Koddich: Finale.",
        ],
        result: "Giochi basati su una storia con Scratch.",
      },
      {
        title: "М5: Scratch avanzato",
        lessons: [
          "24. Estensioni di Scratch.",
          "25. Imparare come riconoscere i video!",
          "26. Creare cloni.",
          "27. Sviluppo del design del programma.",
          "28. Un'altra sessione di debug!",
        ],
        result: "Progetti Scratch con fantastiche possibilità.",
      },
      {
        title: "М6: Hackathon. Creare un progetto per il diploma!",
        lessons: [
          "29. Come la pianificazione attenta può aiutarti a creare i migliori progetti!",
          "30. Sviluppare il nostro miglior progetto in assoluto!",
          "31. Perché i test e i feedback sono così importanti?",
          "32. I segreti dietro una dimostrazione di successo!",
        ],
        result: "Un progetto unico che ha passato tutte le fasi di sviluppo.",
      },
    ],
  },
  "roblox": {
    title: "Sviluppo giochi con Roblox",
    emoji: "🏗️",
    description: "Crea giochi con Roblox Studio: progetta mondi e personaggi, imposta le tue regole e pubblica il tuo primo videogame online.",
    longDescription: "Il corso si concentra sull'apprendimento del linguaggio di programmazione LUA così come sulla modellazione in 3D degli scenari. Il corso insegna le basi della programmazione, utili come punto di partenza per gli studenti che intendono diventare programmatori professionisti. Il corso sviluppa il pensiero creativo e spaziale attraverso la modellazione di diversi oggetti in 3D. Gli studenti creeranno i loro giochi e svilupperanno il pensiero progettuale (design thinking).",
    tags: ["Roblox", "LUA", "Programmazione", "Game design"],
    age: "8+ anni",
    level: "Principiante",
    duration: "32 lezioni",
    topics: [
      "Conoscenza di base del linguaggio LUA",
      "Creazione di giochi su Roblox Studio",
      "Modellazione 3D",
      "Progettazione su livelli",
      "Fondamenti di animazione, effetti sonori e visivi",
    ],
    projectExamples: [
      { title: "Torre nell'Inferno" },
      { title: "Gioco di corse" },
      { title: "Gioco d'avventura" },
    ],
    modules: [
      {
        title: "Modulo 1: Gioco 'Salva il mondo'!",
        lessons: [
          "1. Introduzione a Roblox! Le basi della creazione di giochi. Interfaccia di base di Roblox Studio.",
          "2. Strumenti avanzati di modifica del terreno. Esecuzione di una mappa già pronta.",
          "3. Creare modelli 3D utilizzando blocchi e altri oggetti di base. Modificare colori e materiali.",
          "4. Nozioni di base di programmazione. Impariamo a conoscere le variabili e a modificarne i valori.",
        ],
        result: "Abbiamo imparato a creare un gioco in Roblox Studio partendo da zero. Abbiamo studiato i concetti di base del game design, della modellazione 3D e della programmazione.",
      },
      {
        title: "Modulo 2: Torre nell'Inferno",
        lessons: [
          "5. Iniziare lo sviluppo di un gioco famoso: 'Torre dell'Inferno'. Studio di strumenti avanzati di modellazione 3D.",
          "6. Le basi della programmazione. Funzioni. Conoscere le funzioni nel linguaggio LUA.",
          "7. Imparare la fisica in Roblox Studio. Uso dei motori e della fisica per creare ostacoli.",
          "8. Le basi della programmazione. Operatore condizionale. Imparare a modificare la salute del giocatore.",
        ],
        result: "Abbiamo imparato a conoscere il sistema di fisica di Roblox Studio. Abbiamo imparato le basi della programmazione LUA.",
      },
      {
        title: "Modulo 3: Torre nell'Inferno - Espandere le funzionalità",
        lessons: [
          "9. Le basi della programmazione. I cicli. Uso degli script per creare nuovi ostacoli.",
          "10. Creare oggetti in movimento. Studio dell'animazione degli oggetti.",
          "11. Implementare l'interazione con gli oggetti. Creazione di oggetti interattivi.",
          "12. Creazione di checkpoint. Creazione di boost e di un percorso parkour a tempo limitato.",
        ],
        result: "Abbiamo continuato a imparare di più sulla programmazione. Abbiamo completato il progetto 'Torre dell'Inferno' e lo abbiamo pubblicato su Internet!",
      },
      {
        title: "Modulo 4: Il gioco di corse",
        lessons: [
          "13. Introduzione alle basi del game design. Lavoro avanzato sulle ambientazioni. Creazione di piste da corsa personalizzate.",
          "14. Le basi della scrittura di script nel linguaggio LUA. Apprendimento delle funzioni. Modellazione e impostazione del movimento dell'auto.",
          "15. Imparare a creare effetti visivi. Lavorare con l'interfaccia utente e il linguaggio LUA.",
          "16. Finalizzazione del progetto. Aggiunta di attività per i giocatori: una gara a tempo.",
        ],
        result: "Abbiamo approfondito la nostra conoscenza della programmazione LUA. Abbiamo creato il nostro gioco con una pista da corsa e lo abbiamo pubblicato online!",
      },
      {
        title: "Modulo 5: Gioco d'avventura - Sviluppo di squadra. NPC",
        lessons: [
          "17. Imparare lo sviluppo in gruppo. Lavorare in gruppo per creare un nuovo mondo.",
          "18. Personaggi non giocanti. Creazione e personalizzazione degli NPC.",
          "19. Creazione di animazioni dei personaggi in Roblox Studio.",
          "20. Dialoghi degli NPC. Creazione di una mini-quest. Testare il gioco.",
        ],
        result: "Abbiamo creato personaggi non giocanti e reso i nostri progetti più significativi aggiungendo una mini-quest.",
      },
      {
        title: "Modulo 6: Gioco d'avventura - Creare un sistema di valuta di gioco",
        lessons: [
          "21. Creazione della valuta di gioco. Animare gli oggetti e creare una tabella di cambio valuta.",
          "22. Implementazione dei minerali. Aggiunta di uno strumento di raccolta all'inventario.",
          "23. Lavorare con il sistema GUI di Roblox. Creazione di un negozio in-game.",
          "24. Lavorare sull'atmosfera. Creazione di un oggetto per lo scambio di valuta. Testare il progetto.",
        ],
        result: "Abbiamo imparato a creare una valuta di gioco e un mercato. Abbiamo familiarizzato con il sistema di interfaccia grafica di Roblox.",
      },
      {
        title: "Modulo 7: Gioco d'avventura - Monetizzazione",
        lessons: [
          "25. Distintivi. Implementazione di badge speciali che consentono ai giocatori di ottenere risultati.",
          "26. Implementazione di pass di gioco speciale che i giocatori possono acquistare. Creazione di un animale domestico.",
          "27. Apprendere le basi della monetizzazione di Roblox Studio. Creazione di oggetti in vendita.",
          "28. Finalizzazione del progetto. Studio delle impostazioni del gioco. Implementazione di server privati.",
        ],
        result: "Abbiamo imparato le basi del sistema di monetizzazione di Roblox e come implementarlo nei nostri progetti.",
      },
      {
        title: "Modulo 8: Sviluppare il nostro progetto",
        lessons: [
          "29. Fondamenti di game design. Sviluppo di un'idea per il gioco.",
          "30. Sviluppare il proprio progetto. Imparare a creare meccaniche di gioco.",
          "31. Test finale del proprio progetto. Completamento del progetto del diploma.",
          "32. Presentazione del progetto. Diploma.",
        ],
        result: "Gli studenti hanno sviluppato i propri giochi originali. Hanno combinato diverse meccaniche e scenari di gioco.",
      },
    ],
  },
  "roblox-avanzato": {
    title: "Roblox Avanzato",
    emoji: "🚀",
    description: "Un corso pensato per chi usa già Roblox Studio: affina le tue abilità e crea giochi più complessi, originali e coinvolgenti.",
    longDescription: "Il corso si concentra sull'apprendimento avanzato del linguaggio di programmazione LUA così come sulla modellazione in 3D degli scenari. Il corso sviluppa il pensiero creativo e spaziale attraverso la modellazione di diversi oggetti in 3D. Gli studenti creeranno i loro giochi complessi e svilupperanno il pensiero progettuale (design thinking).",
    tags: ["Script complessi", "Programmazione avanzata", "Meccaniche di gioco"],
    age: "10-14 anni",
    level: "Avanzato",
    duration: "32 lezioni",
    topics: [
      "Game design avanzato con modellazione 3D, creatività e programmazione",
      "Creare giochi propri in Roblox Studio partendo dai tipi più popolari",
      "Sviluppare il potenziale creativo dello studente",
      "Sviluppare le competenze di programmazione avanzate",
      "Trasformare un gruppo di studenti in un team di sviluppatori competente",
    ],
    projectExamples: [
      { title: "Teamwork Puzzle" },
      { title: "Tower Defence" },
      { title: "Pet Simulator" },
    ],
    modules: [
      {
        title: "Modulo 1. Fondamenti di programmazione in LUA",
        lessons: [
          "1. Ripasso del lavoro con le variabili. Avvio dello sviluppo di un nuovo progetto.",
          "2. Lavoro con le funzioni LUA. Apprendimento del debug del codice.",
          "3. Studio dei cicli. Configurazione del teletrasporto e utilizzo del codice per cercare oggetti.",
          "4. Consolidamento degli argomenti appresi tramite esercizi pratici.",
        ],
        result: "Consolidamento delle basi di programmazione LUA e sviluppo di script autonomi.",
      },
      {
        title: "Modulo 2. Gioco 'Teamwork Puzzle'",
        lessons: [
          "5. Inizio sviluppo di un nuovo progetto: nuova versione del popolare gioco Teamwork Puzzle.",
          "6. Studio del ciclo for. Come ottimizzare il codice.",
          "7. Continuiamo lo studio dei cicli. Applicazione del ciclo while nella pratica.",
          "8. Completamento del progetto personale e pubblicazione su Roblox.",
        ],
        result: "Creazione di un gioco puzzle collaborativo completo.",
      },
      {
        title: "Modulo 3. Gioco 'Tower Defence'",
        lessons: [
          "9. Iniziamo a sviluppare un nuovo progetto nel popolare genere Tower Defence.",
          "10. Lavoriamo con le impostazioni della telecamera in Roblox.",
          "11. Lavoriamo con la GUI e gli eventi su LUA. Scambio di messaggi tra server e client.",
          "12. Consolidamento e pubblicazione su Roblox.",
        ],
        result: "Creazione di un Tower Defence completo con gestione telecamera e GUI.",
      },
      {
        title: "Modulo 4. Gioco 'Color Block'",
        lessons: [
          "13. Introduzione al progetto Colour Block. Panoramica delle meccaniche base del gioco.",
          "14. Programmazione della logica base del gioco con operatori condizionali.",
          "15. Lavoro con colori e materiali in Roblox Studio.",
          "16. Creazione di elementi interattivi con eventi e funzioni.",
        ],
        result: "Sviluppo della scena di gioco e degli elementi base.",
      },
      {
        title: "Modulo 5. Gioco 'Color Block' - Estensione delle funzionalità",
        lessons: [
          "17. Sviluppo dell'interfaccia utente (GUI). Creazione e stile degli elementi.",
          "18. Aggiunta di effetti sonori e musica. Gestione audio in Roblox Studio.",
          "19. Script di meccaniche di gioco complesse con tecniche avanzate.",
          "20. Rifiniture finali e pubblicazione del gioco su Roblox.",
        ],
        result: "Completamento del gioco Color Block con audio e meccaniche avanzate.",
      },
      {
        title: "Modulo 6. Gioco 'Pet Simulator' - Programmazione avanzata",
        lessons: [
          "21. Introduzione al progetto Pet Simulator. Concept base e pianificazione.",
          "22. Creazione di modelli base di animali. Modellazione e animazione.",
          "23. Programmazione delle meccaniche di interazione con gli animali.",
          "24. Sviluppo dell'economia di gioco: monete, ricompense e bonus.",
        ],
        result: "Creazione delle basi di un Pet Simulator funzionante.",
      },
      {
        title: "Modulo 7. Gioco 'Pet Simulator' - Nuove funzionalità",
        lessons: [
          "25. Introduzione alla monetizzazione: acquisti in-game e contenuti premium.",
          "26. Creazione di sfide e obiettivi per mantenere l'interesse dei giocatori.",
          "27. Integrazione di elementi social: amici e condivisione degli animali.",
          "28. Rifiniture finali e pubblicazione del gioco su Roblox.",
        ],
        result: "Pet Simulator completo con monetizzazione ed elementi social.",
      },
      {
        title: "Modulo 8. Sviluppo del proprio progetto - Studio dell'IA",
        lessons: [
          "29. Fondamenti di game design. Sviluppo dell'idea per un progetto personale.",
          "30. Sviluppo del progetto personale. Introduzione di un assistente AI.",
          "31. Sviluppo del progetto personale. Implementazione delle meccaniche di gioco.",
          "32. Presentazione del progetto. Conclusione del corso.",
        ],
        result: "Progetto personale originale con meccaniche creative e supporto AI.",
      },
    ],
  },
  "web-development": {
    title: "Web Development",
    emoji: "🌐",
    description: "Immergiti nel mondo dello sviluppo web: impara linguaggi e stili di markup, collega siti a database, crea design e costruisci il tuo sito web.",
    longDescription: "Web Development: questa è un'immersione nel mondo dello sviluppo web. I ragazzi impareranno linguaggi e stili di markup, impareranno a collegare il sito a database, creeranno design e costruiranno il proprio sito web. Il corso copre HTML, CSS, JavaScript, PHP e WordPress.",
    tags: ["HTML", "CSS", "Sviluppo web", "Programmazione"],
    age: "13+ anni",
    level: "Principiante",
    duration: "32 lezioni",
    topics: [
      "Creare layout in Figma",
      "Database e motori di siti",
      "Sviluppo di siti web responsive",
      "Imparare HTML per creare markup di siti",
      "Imparare CSS per applicare stili",
      "Lavorare con le animazioni del sito web",
      "Creazione di database per lavorare con gli utenti",
    ],
    projectExamples: [
      { title: "Portfolio personale" },
      { title: "Landing page professionale" },
      { title: "Sito web completo con WordPress" },
    ],
    modules: [
      {
        title: "Modulo 1. Introduzione a HTML",
        lessons: [
          "1. Gli studenti impareranno cos'è una pagina HTML e proveranno a creare il loro primo layout usando le etiquette più semplici.",
          "2. Multimedia ed embedding. Gli studenti impareranno a usare etiquette multimedia: img, video, audio.",
          "3. Frame e markup di pagina, apprendimento dell'etiquetta iframe e embedding di elementi.",
          "4. Introduzione a CSS. I ragazzi impareranno le basi di CSS e applicheranno i loro primi stili.",
        ],
        result: "Nel primo modulo, gli studenti creeranno pagine web integrando contenuti multimedia e apprenderanno le basi della stilizzazione degli elementi.",
      },
      {
        title: "Modulo 2. Concetti base di CSS",
        lessons: [
          "5. Selettori CSS. Gli studenti impareranno cosa sono i selettori e come impostare stili per elementi specifici.",
          "6. Il modello a blocchi di CSS. Elementi del modello a blocchi e inline, display e proprietà dei blocchi.",
          "7. Link e proprietà di sfondo. Etiquetta <a>, link interni ed esterni, configurazione dello sfondo.",
          "8. Posizionamento. Flusso del documento e posizioni degli elementi, proprietà position.",
        ],
        result: "Nel secondo modulo, gli studenti padroneggeranno temi fondamentali per ottenere un web design professionale.",
      },
      {
        title: "Modulo 3. Prototipazione e basi di UX/UI",
        lessons: [
          "9. Introduzione al design. Cos'è il design UX e UI, qual è la loro differenza?",
          "10. Analisi dei motori di ricerca. Studio dei motori di ricerca e del funzionamento di Internet.",
          "11. Mock-up del progetto finale: introduzione a Figma, basi della prototipazione.",
          "12. Flexbox. I ragazzi impareranno la proprietà più importante di CSS: i Flexbox.",
        ],
        result: "Gli studenti apprenderanno le basi del design di siti web e svilupperanno il design del loro futuro progetto.",
      },
      {
        title: "Modulo 4. Design",
        lessons: [
          "13. Design del sito web, lavoro con VSC. Conoscenza dell'editor e lavoro sul primo progetto.",
          "14. Completamento del progetto. Finalizzazione e completamento del progetto.",
          "15. Pubblicazione di un progetto. Cos'è GitHub e come pubblicare il tuo sito?",
          "16. Presentazione dei progetti. Riepilogo di quanto fatto nei quattro moduli.",
        ],
        result: "Gli studenti creeranno il loro primo sito web, lo pubblicheranno online e raccoglieranno feedback dagli utenti.",
      },
      {
        title: "Modulo 5. CSS Avanzato",
        lessons: [
          "17. Pseudo-classi e pseudo-elementi. Studio di pseudo-classi e pseudo-elementi importanti.",
          "18. Trasformazioni. Esplorazione delle trasformazioni, rendere il sito interattivo.",
          "19. Animazioni. La proprietà animation e come funzionano le animazioni in CSS.",
          "20. Modello a blocchi PRO. Differenza tra margin e padding, applicazione al progetto.",
        ],
        result: "Gli studenti padroneggeranno CSS avanzato e miglioreranno il loro progetto.",
      },
      {
        title: "Modulo 6. Layout adattivo, grid e form",
        lessons: [
          "21. Layout Grid. La seconda proprietà importante di CSS. Differenza con i flex.",
          "22. Variabili in CSS. La variabile root che cambierà molto il nostro sito!",
          "23. Design adattivo e responsive. Come rendere un sito adattabile?",
          "24. Interazione con le informazioni dell'utente. Form, come inviare informazioni al server.",
        ],
        result: "Gli studenti impareranno grid più comode, risolveranno casi reali e apprenderanno a fare adattamenti.",
      },
      {
        title: "Modulo 7. Motori di siti e basi di PHP",
        lessons: [
          "25. Server locale e introduzione a PHP. Apprendimento di PHP per il sito, interazione con HTML.",
          "26. Immersione in PHP. Apprendimento di cicli e array, come costruire il proprio sito PHP.",
          "27. WordPress. Motori di siti e WordPress, come creare un sito da blocchi PHP.",
          "28. Motore del sito ed estensione del progetto sul motore.",
        ],
        result: "Gli studenti apprenderanno hosting e PHP, e come trasferire il loro progetto sul server.",
      },
      {
        title: "Modulo 8. Elaborazione del progetto finale",
        lessons: [
          "29. Elaborazione del progetto finale.",
          "30. Perfezionamento del progetto, lavoro con form, codice pronto per verificare la correttezza dell'input.",
          "31. Perfezionamento del progetto, menu hamburger, carousel, chips JS. Completamento del progetto.",
          "32. Presentazione dei progetti.",
        ],
        result: "Per tutti i moduli, gli studenti lavoreranno al miglioramento del loro progetto, creando un buon prodotto finale.",
      },
    ],
  },
  "unity": {
    title: "Sviluppo giochi con Unity",
    emoji: "🎮",
    description: "Dai vita alle tue idee con Unity: impara a creare ambienti 3D, progettare logiche di gioco e costruire esperienze interattive come un vero sviluppatore.",
    longDescription: "Durante questo corso, gli studenti (dai 13 ai 17 anni) impareranno Unity, uno dei motori più popolari nel settore dei giochi. Gli studenti padroneggeranno il motore in grado di consentire loro di creare giochi, animazioni e progetti software unici e coinvolgenti. Durante il corso, gli studenti impareranno C#, il linguaggio di programmazione che consentirà loro di creare funzioni complesse. Alla fine del corso, gli studenti creeranno i propri giochi 3D che potranno essere giocati sia su PC che su browser web.",
    tags: ["Programmazione", "3D", "C#", "Game Engines", "Sviluppo di giochi"],
    age: "13+ anni",
    level: "Principiante",
    duration: "32 lezioni",
    topics: [
      "Introduzione al linguaggio C#",
      "Fondamenti di sviluppo di giochi sparatutto e fondamenti di intelligenza artificiale",
      "Fondamenti di sviluppo di giochi multiplayer",
      "Utilizzo di GitHub",
      "Sviluppo del tuo primo Unity FPS (sparatutto in prima persona)",
      "Progettazione e implementazione giochi multiplayer",
    ],
    projectExamples: [
      { title: "Runner Game" },
      { title: "Sparatutto FPS" },
      { title: "Gioco Multiplayer" },
    ],
    modules: [
      {
        title: "M1. Sviluppare un gioco Runner - Introduzione a Unity e C#",
        lessons: [
          "1. Finestre di Unity. Creazione di personaggi e luoghi.",
          "2. Introduzione alla programmazione in C#. Configura la fisica del movimento per il giocatore.",
          "3. Imparare l'istruzione condizionale if/else. Insegnare al nostro personaggio a saltare.",
          "4. Scoprire di più sulla telecamera del gioco. Animare il movimento del personaggio.",
        ],
        result: "Gli studenti hanno iniziato a sviluppare il loro primo gioco Unity creando personaggi e luoghi. Hanno imparato le basi del linguaggio C#.",
      },
      {
        title: "M2. Sviluppare un gioco Runner - Creazione di livelli e basi dell'UI",
        lessons: [
          "5. Conoscere gli elenchi C# e la funzione Istance. Costruire un generatore di livelli base.",
          "6. Conoscere il ciclo for C#. Implementare il livellamento continuo.",
          "7. Apprendimento delle basi dell'UI (User Interface). Aggiungi oggetti da collezione e lost status.",
          "8. Unificazione delle basi di C#. Familiarizzare con effetti e suoni. Aggiungi bonus.",
        ],
        result: "Gli studenti hanno completato il loro primo gioco di corsa e lo hanno pubblicato su Kodland HUB.",
      },
      {
        title: "M3. Sviluppare uno sparatutto - Fondamenti FPS e IA",
        lessons: [
          "9. Creazione di un nuovo progetto. Implementazione dei controlli dei personaggi in prima persona.",
          "10. Creare modelli e animazioni per i nemici. Implementazione di un'intelligenza artificiale primitiva.",
          "11. Aggiunta di armi e meccaniche di tiro di base. Implementazione del conteggio delle munizioni.",
          "12. Fondamenti di game design. Implementazione di checkpoint e respawn.",
        ],
        result: "Gli studenti hanno iniziato a sviluppare il loro primo Unity FPS con nemici e IA semplice.",
      },
      {
        title: "M4. Sviluppare uno sparatutto - Introduzione alla OOP",
        lessons: [
          "13. Introduzione all'OOP (programmazione orientata agli oggetti). Principi base, classi e oggetti.",
          "14. OOP avanzato. Utilizzo del polimorfismo per sovrascrivere i metodi della superclasse.",
          "15. Utilizzo dei concetti OOP per implementare diverse classi di personaggi con abilità uniche.",
          "16. Completare il gioco sparatutto. Aggiunta di suoni ed effetti visivi, lavoro sul menu.",
        ],
        result: "Gli studenti hanno imparato le basi dell'OOP e pubblicato i loro progetti su Itch.io.",
      },
      {
        title: "M5. Sviluppo di uno sparatutto multiplayer - Fondamenti multiplayer",
        lessons: [
          "17. Introduzione allo sviluppo di giochi multiplayer. Introduzione a Photon.",
          "18. Connessione al servizio Photon. Crea e unisciti a stanze virtuali.",
          "19. Utilizzo delle funzioni Photon per sincronizzare le azioni e gli stati dei giocatori.",
          "20. Apprendimento delle funzionalità avanzate di Photon per migliorare la sincronizzazione.",
        ],
        result: "Gli studenti hanno strutturato i loro progetti per la funzionalità multiplayer con Photon.",
      },
      {
        title: "M6. Sviluppo di uno sparatutto multiplayer - Funzionalità avanzate",
        lessons: [
          "21. Realizzazione di varie funzionalità di gioco in ambiente multiplayer: IA nemica, bonus, punteggio.",
          "22. Ottimizzare il gioco. Ottimizzazione dei suoni, dell'interfaccia e delle prestazioni.",
          "23. Implementare funzionalità multiplayer avanzate: matchmaking, lobby e gestione dati runtime.",
          "24. Guardare il gioco in streaming e giocare insieme.",
        ],
        result: "Gli studenti hanno completato il loro gioco sparatutto multiplayer e lo hanno pubblicato su Itch.io.",
      },
      {
        title: "M7. Inizio del lavoro per il progetto finale",
        lessons: [
          "25. Fondamenti di game design. Progettare un documento concettuale per un gioco.",
          "26. Comprendere il controllo della versione. Imparare GitHub.",
          "27. Progettazione dei livelli. Lavoro sulla grafica dei propri giochi.",
          "28. Pubblicazione e test delle versioni beta dei propri giochi.",
        ],
        result: "Gli studenti hanno iniziato a progettare i loro progetti finali e imparato a lavorare con GitHub.",
      },
      {
        title: "M8. Completamento del progetto finale - Diploma",
        lessons: [
          "29. Insegnare al giocatore. Sviluppo di un'interfaccia user-friendly.",
          "30. Pubblicare progetti su Itch.io.",
          "31. Percorso evolutivo: dare gli ultimi ritocchi prima della presentazione.",
          "32. Presentazione dei progetti. Diploma di fine corso.",
        ],
        result: "Gli studenti hanno creato i propri giochi con design e storie originali e li hanno pubblicati su Itch.io.",
      },
    ],
  },
  "python-base": {
    title: "Python Base",
    emoji: "🐍",
    description: "Impara Python, il linguaggio scelto dagli sviluppatori di tutto il mondo, e crea giochi, app e siti web trasformando le tue idee in progetti reali.",
    longDescription: "In questo corso per adolescenti imparerai le basi di Python, uno dei linguaggi di programmazione più versatili e richiesti nel mondo del lavoro. Creerai applicazioni come chatbot e programmi interattivi. Acquisirai esperienza pratica con strumenti e tecniche standard, imparando anche a sviluppare e pubblicare i tuoi progetti.",
    tags: ["Python", "Programmazione", "Logica", "Progetti pratici"],
    age: "13+ anni",
    level: "Principiante",
    duration: "32 lezioni",
    topics: [
      "Fondamenti del linguaggio Python",
      "Variabili, funzioni e strutture dati",
      "Programmazione orientata agli oggetti",
      "Creazione di progetti interattivi",
      "Introduzione al debugging e testing",
    ],
    projectExamples: [
      { title: "Chatbot Discord" },
      { title: "Applicazione interattiva" },
      { title: "Gioco testuale" },
    ],
    modules: [
      {
        title: "Modulo 1: Introduzione a Python",
        lessons: [
          "1. Installazione e configurazione dell'ambiente di sviluppo.",
          "2. Primi passi: variabili e tipi di dati.",
          "3. Input/Output e interazione con l'utente.",
          "4. Operatori e espressioni.",
        ],
        result: "Comprensione delle basi di Python e creazione dei primi programmi.",
      },
      {
        title: "Modulo 2: Strutture di controllo",
        lessons: [
          "5. Istruzioni condizionali if/else.",
          "6. Cicli for e iterazione.",
          "7. Cicli while e controllo del flusso.",
          "8. Esercitazione pratica con problemi logici.",
        ],
        result: "Padronanza delle strutture di controllo fondamentali.",
      },
      {
        title: "Modulo 3: Funzioni e modularità",
        lessons: [
          "9. Definizione e chiamata di funzioni.",
          "10. Parametri e valori di ritorno.",
          "11. Scope delle variabili e best practices.",
          "12. Creazione di un mini-progetto con funzioni.",
        ],
        result: "Capacità di organizzare il codice in modo modulare.",
      },
      {
        title: "Modulo 4: Strutture dati",
        lessons: [
          "13. Liste e operazioni su liste.",
          "14. Dizionari e tuple.",
          "15. Comprensione delle liste.",
          "16. Progetto con strutture dati.",
        ],
        result: "Utilizzo efficace delle strutture dati Python.",
      },
      {
        title: "Modulo 5: File e gestione degli errori",
        lessons: [
          "17. Lettura e scrittura di file.",
          "18. Gestione delle eccezioni.",
          "19. Debugging e risoluzione problemi.",
          "20. Progetto con persistenza dati.",
        ],
        result: "Gestione professionale di file ed errori.",
      },
      {
        title: "Modulo 6: Introduzione alla OOP",
        lessons: [
          "21. Classi e oggetti.",
          "22. Metodi e attributi.",
          "23. Ereditarietà base.",
          "24. Progetto con classi.",
        ],
        result: "Comprensione dei fondamenti della programmazione orientata agli oggetti.",
      },
      {
        title: "Modulo 7: Librerie e moduli",
        lessons: [
          "25. Importazione e utilizzo di moduli.",
          "26. Librerie standard utili.",
          "27. Installazione di pacchetti esterni.",
          "28. Creazione di un progetto con librerie.",
        ],
        result: "Utilizzo dell'ecosistema Python per estendere le funzionalità.",
      },
      {
        title: "Modulo 8: Progetto finale",
        lessons: [
          "29. Pianificazione del progetto finale.",
          "30. Sviluppo del progetto.",
          "31. Testing e debugging finale.",
          "32. Presentazione del progetto.",
        ],
        result: "Completamento di un progetto Python completo e funzionante.",
      },
    ],
  },
  "python-ai": {
    title: "Python PRO & AI",
    emoji: "🤖",
    description: "Un percorso avanzato per creare bot, siti web e progetti con IA. Con Python PRO lavori su progetti reali e partecipi a un hackathon sul clima.",
    longDescription: "In questo corso per adolescenti libererai la tua creatività e scoprirai le potenzialità avanzate del linguaggio Python! Creerai applicazioni avanzate come chatbot, siti web e programmi basati sull'intelligenza artificiale. Acquisirai non solo esperienza pratica con strumenti e tecniche standard, ma imparerai anche a sviluppare e pubblicare i tuoi progetti open source. Le competenze acquisite ti permetteranno di fare un passo importante nel mondo della tecnologia!",
    tags: ["API", "HTML", "Estrazione dati", "Intelligenza artificiale"],
    age: "13+ anni",
    level: "Avanzato",
    duration: "32 lezioni",
    topics: [
      "Programmazione back-end",
      "Introduzione allo sviluppo web",
      "Padronanza dell'intelligenza artificiale",
      "Integrazione dell'AI in applicazioni già pronte",
      "Funzioni avanzate di Python come lambda, gestione file ed eccezioni",
      "Sviluppo di bot, siti e AI usando Python, API, framework web e librerie ML",
    ],
    projectExamples: [
      { title: "Bot Discord avanzato" },
      { title: "Sito web con Flask" },
      { title: "Progetto AI con Machine Learning" },
    ],
    modules: [
      {
        title: "Modulo 1: Bot Discord che non si ferma mai",
        lessons: [
          "1. Gli strumenti dei veri programmatori!",
          "2. Gli strumenti dei veri programmatori! VsCode",
          "3. Importiamo la nostra prima libreria!",
          "4. Il bot risponde già alle nostre richieste!",
        ],
        result: "Creazione di un bot Discord funzionante con le basi di Python e Git.",
      },
      {
        title: "Modulo 2: File, cartelle e sviluppo web",
        lessons: [
          "5. File e cartelle",
          "6. Applicare la nostra conoscenza",
          "7. Introduzione allo sviluppo web.",
          "8. HTML e CSS",
        ],
        result: "Comprensione della struttura dei file e introduzione al web development.",
      },
      {
        title: "Modulo 3: Flask e back-end",
        lessons: [
          "9. Flask. Configurazione dell'ambiente.",
          "10. Modelli e strumenti di template",
          "11. Imparare i percorsi web e come non perdere le pagine web.",
          "12. Una lezione segreta! Cambiare le pagine dinamicamente.",
        ],
        result: "Creazione di siti web dinamici con Flask.",
      },
      {
        title: "Modulo 4: Database e Portfolio",
        lessons: [
          "13. Database. Il Diario del programmatore",
          "14. Autorizzazione degli utenti.",
          "15. Distribuzione del progetto. Preparazione del portfolio.",
          "16. Creazione di un sito web Portfolio",
        ],
        result: "Creazione e deployment di un sito web portfolio completo.",
      },
      {
        title: "Modulo 5: Intelligenza Artificiale e Machine Learning",
        lessons: [
          "17. Comprendere l'IA e l'apprendimento automatico.",
          "18. I dati sono la chiave del successo. Estrazione di dati da fonti aperte.",
          "19. Le basi del Natural Language Processing. La libreria NLTK. I generatori di liste di Python.",
          "20. Visione computerizzata? Che cos'è?",
        ],
        result: "Comprensione dei fondamenti dell'AI e del machine learning.",
      },
      {
        title: "Modulo 6: Modelli AI e pratica",
        lessons: [
          "21. Imparare una nuova libreria! Usare i modelli addestrati con il codice!",
          "22. Battaglia di AI! Organizzare una competizione, discutere e testare.",
          "23. Imparare nuove librerie e fissare obiettivi!",
          "24. Mettiamo in pratica la nostra conoscenza!",
        ],
        result: "Utilizzo pratico di modelli AI pre-addestrati.",
      },
      {
        title: "Modulo 7: Integrazione AI nei progetti",
        lessons: [
          "25. Configurazione dell'IDE per il progetto precedentemente creato.",
          "26. Inferenza del modello addestrato nel bot Discord.",
          "27. Creare un traduttore vocale!",
          "28. Aggiungere un pulsante e implementare la logica!",
        ],
        result: "Integrazione di AI in applicazioni esistenti.",
      },
      {
        title: "Modulo 8: Hackathon - Progetto finale",
        lessons: [
          "29. Spiegazione di ciò che vogliamo ottenere. Analisi.",
          "30. Elaborazione di una soluzione.",
          "31. Testare, eseguire il debug e risolvere.",
          "32. Dimostrazione della soluzione.",
        ],
        result: "Partecipazione a un hackathon con progetto finale completo.",
      },
    ],
  },
};

const levelColors: Record<string, string> = {
  Principiante: "bg-tech-green/10 text-tech-green border-tech-green/20",
  Avanzato: "bg-tech-cyan/10 text-tech-cyan border-tech-cyan/20",
};

const howItWorksSteps = [
  {
    icon: GraduationCap,
    title: "Primo Incontro",
    description: "Lo studente si connette alla piattaforma in accordo con le istruzioni fornite, fa conoscenza con l'insegnante e i compagni e le compagne di classe.",
  },
  {
    icon: BookOpen,
    title: "Approccio pratico",
    description: "Ad ogni lezione, lo studente apprenderà un nuovo argomento, che consoliderà praticando, e poi facendo i suoi compiti per casa.",
  },
  {
    icon: Code2,
    title: "Creazione del Progetto",
    description: "A metà corso, lo studente deciderà l'argomento per il suo progetto e inizierà a lavorare per esso.",
  },
  {
    icon: Presentation,
    title: "Presentazione del Progetto",
    description: "Lo studente pubblica il suo progetto online e lo presenta all'esame finale del corso.",
  },
];

// Form schema for trial booking
const trialFormSchema = z.object({
  name: z.string().trim().min(2, "Il nome deve avere almeno 2 caratteri").max(100, "Nome troppo lungo"),
  email: z.string().trim().email("Inserisci un'email valida").max(255, "Email troppo lunga"),
  phone: z.string().trim().min(5, "Inserisci un numero di telefono valido").max(20, "Numero troppo lungo"),
  consent: z.boolean().refine(val => val === true, "Devi accettare i termini per procedere"),
});

type TrialFormData = z.infer<typeof trialFormSchema>;

export default function CorsoDettaglio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [dbContent, setDbContent] = useState<Record<string, any>>({});
  const baseCourse = id ? coursesData[id] : null;
  // Merge DB overrides over hardcoded fallback. Empty/missing fields fall back.
  const course = baseCourse
    ? {
        ...baseCourse,
        ...Object.fromEntries(
          Object.entries(dbContent).filter(([_, v]) =>
            Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== ""
          )
        ),
      } as typeof baseCourse
    : null;
  const seoOverrides = (dbContent?.seo ?? {}) as { title?: string; description?: string; keywords?: string };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("is_visible, detail_content")
        .eq("slug", id)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        if (data.is_visible === false) setIsHidden(true);
        if (data.detail_content && typeof data.detail_content === "object") {
          setDbContent(data.detail_content as Record<string, any>);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const form = useForm<TrialFormData>({
    resolver: zodResolver(trialFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      consent: false,
    },
  });
  const { formOpenedAt, honeypotProps, honeypotValue } = useFormAntiSpam();

  const onSubmit = async (data: TrialFormData) => {
    if (!course) return;
    setIsSubmitting(true);

    try {
      const { data: bookingResult, error: bookingError } = await supabase.functions.invoke("submit-booking", {
        body: {
          parentName: data.name,
          email: data.email,
          phone: data.phone,
          childAge: 10, // Default age
          interest: course.title,
          availability: "qualsiasi",
          message: `Richiesta da pagina corso: ${course.title}`,
          adminEmail: "info@techland.it",
          website: honeypotValue,
          formOpenedAt,
        },
      });

      if (bookingError) {
        throw new Error("Errore nell'invio della richiesta");
      }

      if (!bookingResult?.success) {
        throw new Error(bookingResult?.error || "Errore nell'invio della richiesta");
      }

      toast({
        title: "Richiesta inviata!",
        description: "Ti contatteremo entro 24 ore per confermare la lezione.",
      });

      form.reset();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isHidden) {
    return <NotFound />;
  }

  if (!course) {
    return (
      <Layout>
        <div className="tech-section">
          <div className="tech-container text-center">
            <h1 className="text-4xl font-bold mb-4">Corso non trovato</h1>
            <p className="text-muted-foreground mb-8">Il corso che stai cercando non esiste.</p>
            <Button asChild>
              <Link to="/corsi">Torna ai corsi</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // SEO meta data generation
  const getSEOTitle = () => {
    const titleMap: Record<string, string> = {
      "minecraft-education": "Corso Minecraft per Bambini Online (8-9 anni) | Coding con MakeCode",
      "abc-creativita-digitale": "Corso Creatività Digitale per Bambini Online (5-7 anni)",
      "abc-informatica": "Corso di Informatica per Bambini Online (5-7 anni)",
      "scratch": "Corso Scratch per Bambini Online (8-10 anni) | Programmazione Visiva",
      "roblox-base": "Corso Roblox per Bambini Online (8-12 anni) | Sviluppo Giochi",
      "roblox": "Corso Roblox per Bambini Online (10-14 anni) | Crea Videogiochi con Lua",
      "roblox-avanzato": "Corso Roblox Avanzato per Ragazzi Online (10-14 anni) | Lua Avanzato",
      "web-development": "Corso Web Development per Ragazzi Online (12-16 anni) | HTML CSS JavaScript",
      "unity": "Corso Unity per Ragazzi Online (13-18 anni) | Sviluppo Giochi 3D",
      "python-base": "Corso Python per Ragazzi Online (12-16 anni) | Programmazione Python da Zero",
      "python-pro-ai": "Corso Python Avanzato e AI per Ragazzi Online (14-18 anni)",
      "python-ai": "Corso Python e Intelligenza Artificiale per Ragazzi Online (14-18 anni)"
    };
    return titleMap[id!] || `Corso ${course?.title} per Bambini Online`;
  };

  const getSEODescription = () => {
    const descMap: Record<string, string> = {
      "minecraft-education": "Corso di Minecraft per bambini online (8-9 anni). Impara coding, automazione e programmazione con Minecraft Education e MakeCode. Lezione di prova gratuita!",
      "abc-creativita-digitale": "Corso di creatività digitale per bambini online (5-7 anni). Canva, animazioni e design. Sviluppa pensiero creativo e logico. Prima lezione gratis!",
      "abc-informatica": "Corso di informatica per bambini online (5-7 anni). Programmazione a blocchi, Scratch Junior e uso del PC. Lezione di prova gratuita!",
      "scratch": "Corso di Scratch per bambini online (8-10 anni). Crea giochi e animazioni con la programmazione visiva. Docenti esperti. Prima lezione gratis!",
      "roblox-base": "Corso Roblox Studio per bambini online (8-12 anni). Crea e pubblica i tuoi giochi. Impara Lua e game design. Lezione di prova gratuita!",
      "roblox": "Corso Roblox per bambini online (10-14 anni). Crea videogiochi con Roblox Studio e Lua. Lezioni live in piccoli gruppi. Prima lezione gratis!",
      "roblox-avanzato": "Corso Roblox avanzato per ragazzi online (10-14 anni). Script Lua complessi, multiplayer, monetizzazione. Diventa un pro developer Roblox!",
      "web-development": "Corso di Web Development per ragazzi online (12-16 anni). HTML, CSS, JavaScript da zero. Crea il tuo sito web. Prima lezione gratuita!",
      "unity": "Corso Unity per ragazzi online (13-18 anni). Sviluppo giochi 3D con C#. Crea esperienze interattive. Lezione di prova gratis!",
      "python-base": "Corso di Python per ragazzi online (12-16 anni). Il linguaggio di programmazione più richiesto. Progetti pratici. Prima lezione gratuita!",
      "python-pro-ai": "Corso Python avanzato e AI per ragazzi online (14-18 anni). Machine learning, NumPy, Pandas, deep learning. Lezione di prova gratis!",
      "python-ai": "Corso Python e Intelligenza Artificiale per ragazzi online (14-18 anni). Machine learning con scikit-learn, AI e LLM. Lezione di prova gratis!"
    };
    return descMap[id!] || course?.description || "";
  };

  const courseSchema = course ? generateCourseSchema({
    title: getSEOTitle(),
    description: getSEODescription(),
    age: course.age,
    level: course.level,
    duration: course.duration,
    slug: id!
  }) : null;

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Corsi di Programmazione", url: "/corsi" },
    { name: course?.title || "", url: `/corsi/${id}` }
  ]);

  const getSEOKeywords = () => {
    const keywordsMap: Record<string, string> = {
      "minecraft-education": "corso minecraft, corsi di minecraft, corso minecraft bambini, minecraft education, programmazione minecraft, makecode bambini, coding minecraft, corsi minecraft online",
      "abc-creativita-digitale": "corso creatività digitale bambini, design digitale bambini, canva bambini, animazione bambini, corsi per bambini 5 anni",
      "abc-informatica": "corso informatica bambini, corsi di informatica per bambini, informatica per bambini, scratch junior, programmazione a blocchi, alfabetizzazione digitale bambini",
      "scratch": "corso scratch, corsi di scratch, corso scratch bambini, programmazione visiva bambini, scratch coding, creare giochi scratch, animazioni scratch, scratch online",
      "roblox-base": "corso roblox, corsi di roblox, corso roblox bambini, roblox studio bambini, creare giochi roblox, programmare roblox, lua bambini, roblox online",
      "roblox": "corso roblox, corsi di roblox, corso roblox bambini, roblox studio, creare giochi roblox, lua, roblox online ragazzi",
      "roblox-avanzato": "corso roblox avanzato, roblox scripting, game design ragazzi, lua avanzato, sviluppo giochi roblox, corsi di roblox avanzato",
      "web-development": "corso web development ragazzi, corsi web design bambini, html css javascript per ragazzi, creare siti web, programmazione web ragazzi",
      "unity": "corso unity ragazzi, sviluppo giochi 3d, c# ragazzi, game development unity, creare videogiochi",
      "python-base": "corso python ragazzi, corsi di python per ragazzi, python base, imparare python, programmazione python bambini, corso python online",
      "python-pro-ai": "corso python avanzato, intelligenza artificiale ragazzi, machine learning bambini, python ai corso, corso ai per ragazzi",
      "python-ai": "corso python ai, intelligenza artificiale ragazzi, machine learning ragazzi, python ai corso, corso ai per ragazzi, deep learning ragazzi",
    };
    return keywordsMap[id!] || `corso ${course?.title}, corsi per bambini, corsi di programmazione per bambini, ${course?.title} online`;
  };

  return (
    <Layout>
      <SEOHead
        title={getSEOTitle()}
        description={getSEODescription()}
        canonical={`/corsi/${id}`}
        keywords={getSEOKeywords()}
        structuredData={courseSchema ? [courseSchema, breadcrumbSchema] : [breadcrumbSchema]}
      />
      
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-primary/10 via-tech-green-light to-background dark:from-background dark:via-background dark:to-background">
        <div className="tech-container">
          <SEOBreadcrumb 
            items={[
              { label: "Corsi", href: "/corsi" },
              { label: course.title }
            ]} 
            className="mb-8"
          />

          <div className="tech-card p-8 md:p-12">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-4 mb-6">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <CourseEmoji emoji={course.emoji} size="xl" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2">{getSEOTitle().replace(" | TECHLAND", "")}</h1>
                <p className="text-lg text-muted-foreground">{course.description}</p>
              </div>
            </div>

            {/* Course info */}
            <div className="flex flex-wrap gap-6 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span>Età: {course.age}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={levelColors[course.level]}>
                  {course.level}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>{course.duration}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Long description */}
      <section className="tech-section">
        <div className="tech-container">
          <div className="max-w-4xl">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Informazioni sul corso</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {course.longDescription}
            </p>
          </div>
        </div>
      </section>

      {/* Topics */}
      <section className="tech-section bg-muted/30">
        <div className="tech-container">
          <div className="flex items-center gap-3 mb-8">
            <CheckCircle2 className="w-8 h-8 text-tech-green" />
            <h2 className="text-2xl md:text-3xl font-bold">Argomenti trattati</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {course.topics.map((topic, i) => (
              <div key={i} className="flex items-start gap-3 tech-card p-4">
                <CheckCircle2 className="w-5 h-5 text-tech-green flex-shrink-0 mt-0.5" />
                <span>{topic}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Project examples */}
      <section className="tech-section">
        <div className="tech-container">
          <div className="flex items-center gap-3 mb-8">
            <Rocket className="w-8 h-8 text-secondary" />
            <h2 className="text-2xl md:text-3xl font-bold">Esempi di progetto</h2>
          </div>
          <p className="text-muted-foreground mb-8">
            Durante il corso, gli studenti realizzeranno progetti pratici come questi:
          </p>
          {id === "scratch" ? (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { id: "1304833814", title: "Gioco Scratch #1" },
                  { id: "1310221121", title: "Gioco Scratch #2" },
                  { id: "1308790999", title: "Gioco Scratch #3" },
                ].map((p) => (
                  <div key={p.id} className="tech-card p-4 flex flex-col">
                    <div className="aspect-[485/402] w-full overflow-hidden rounded-lg bg-muted">
                      <iframe
                        src={`https://scratch.mit.edu/projects/${p.id}/embed`}
                        allowTransparency
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        scrolling="no"
                        allowFullScreen
                        loading="lazy"
                        title={p.title}
                        className="w-full h-full"
                      />
                    </div>
                    <p className="font-medium mt-3 text-center">{p.title}</p>
                    <a
                      href={`https://scratch.mit.edu/projects/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline text-center mt-1"
                    >
                      Apri su Scratch ↗
                    </a>
                  </div>
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground mt-6">
                ▶️ Clicca la bandiera verde per giocare. Usa il pulsante fullscreen per ingrandire.
              </p>
            </>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {course.projectExamples.map((project, i) => (
                  <div key={i} className="tech-card p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary/10 flex items-center justify-center">
                      <Target className="w-8 h-8 text-secondary" />
                    </div>
                    <p className="font-medium">{project.title}</p>
                    <p className="text-sm text-muted-foreground mt-2">Esempio di progetto del corso</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 p-5 rounded-xl bg-accent/10 border border-accent/20 text-center">
                <p className="text-muted-foreground text-sm md:text-base">
                  📌 Gli esempi dettagliati dei progetti verranno aggiunti a breve. Se hai bisogno immediato di vedere un esempio di progetto,{" "}
                  <a
                    href="https://wa.me/message/KHFBHZDEY3S7H1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-semibold hover:underline"
                  >
                    contattaci su WhatsApp
                  </a>
                  !
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Curriculum */}
      <section className="tech-section bg-muted/30">
        <div className="tech-container">
          <div className="flex items-center gap-3 mb-8">
            <BookOpen className="w-8 h-8 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold">Curriculum del corso</h2>
          </div>
          <div className="space-y-6">
            {course.modules.map((module, i) => (
              <div key={i} className="tech-card p-4 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary text-sm sm:text-base">{i + 1}</span>
                  </div>
                  <h3 className="text-base sm:text-xl font-semibold">{module.title}</h3>
                </div>
                <ul className="space-y-2 ml-10 sm:ml-14 mb-4">
                  {module.lessons.map((lesson, j) => (
                    <li key={j} className="text-muted-foreground text-sm">
                      • {lesson}
                    </li>
                  ))}
                </ul>
                <div className="ml-10 sm:ml-14 p-3 sm:p-4 bg-tech-green/5 rounded-lg border border-tech-green/20">
                  <p className="text-sm">
                    <strong className="text-tech-green">Risultato:</strong> {module.result}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="tech-section">
        <div className="tech-container">
          <div className="flex items-center gap-3 mb-8">
            <Lightbulb className="w-8 h-8 text-tech-teal" />
            <h2 className="text-2xl md:text-3xl font-bold">Come funzionano le lezioni con Techland</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorksSteps.map((step, i) => (
              <div key={i} className="tech-card p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-tech-teal/10 flex items-center justify-center">
                  <step.icon className="w-8 h-8 text-tech-teal" />
                </div>
                <div className="w-8 h-8 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="font-bold text-primary text-sm">{i + 1}</span>
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA with Form */}
      <section className="py-20 md:py-32 bg-gradient-hero">
        <div className="tech-container">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-4">
              Prenota una lezione di prova gratuita!
            </h2>
            <p className="text-lg text-primary-foreground/80">
              Inizia il tuo viaggio nel mondo del coding con {course.title}. Compila il form e ti contatteremo entro 24 ore.
            </p>
          </div>

          <div className="max-w-xl mx-auto">
            <div className="bg-card rounded-2xl p-8 shadow-xl">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <input {...honeypotProps} />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Il tuo nome" 
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
                            placeholder="La tua email" 
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
                            placeholder="+39 333 1234567" 
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
                    name="consent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal">
                            Confermo che userò un computer con connessione internet stabile per la lezione d'introduzione. Acconsento alla trasmissione dei miei dati a Techland, che li tratterà in conformità alla propria{" "}
                            <Link to="/privacy" className="text-primary hover:underline">
                              informativa sulla privacy
                            </Link>
                            .
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
