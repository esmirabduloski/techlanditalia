/**
 * Risposte rapide per la chat live dell'admin (/admin/chat-live).
 *
 * Cliccando un messaggio il testo viene inserito nella casella di risposta,
 * dove l'operatore può ancora modificarlo prima di inviarlo: non parte nulla in automatico.
 *
 * Struttura ispirata agli script usati dai team di assistenza clienti
 * (saluto + presentazione, attesa, approfondimento, scuse, chiusura con offerta di ulteriore aiuto).
 * Per aggiungere o cambiare un messaggio basta modificare questo file.
 */

export type QuickReply = {
  id: string;
  /** Etichetta breve mostrata sul pulsante. */
  label: string;
  /** Testo completo inserito nella casella di risposta. */
  text: string;
};

export type QuickReplyCategory = {
  id: string;
  label: string;
  emoji: string;
  replies: QuickReply[];
};

export const QUICK_REPLY_CATEGORIES: QuickReplyCategory[] = [
  {
    id: 'welcome',
    label: 'Benvenuto',
    emoji: '👋',
    replies: [
      {
        id: 'welcome-short',
        label: 'Ciao, sono qui',
        text: 'Ciao! 👋 Sono un operatore di TECHLAND, da questo momento risponderò io. Come posso aiutarti?',
      },
      {
        id: 'welcome-name',
        label: 'Presentazione',
        text: 'Buongiorno e grazie per averci contattato! Mi chiamo Esmir e sono qui per aiutarti. Ho letto la tua richiesta e me ne occupo subito.',
      },
      {
        id: 'welcome-thanks-wait',
        label: 'Grazie per l\'attesa',
        text: 'Ciao! Grazie per aver atteso 🙏 Sono un operatore di TECHLAND: ho letto i messaggi che hai scritto all\'assistente e riprendo da lì. Dimmi pure.',
      },
      {
        id: 'welcome-back',
        label: 'Bentornato',
        text: 'Bentornato su TECHLAND! Sono felice di risentirti. In cosa posso esserti utile oggi?',
      },
    ],
  },
  {
    id: 'wait',
    label: 'Attesa',
    emoji: '⏳',
    replies: [
      {
        id: 'wait-moment',
        label: 'Un momento',
        text: 'Dammi solo un momento per verificare, torno subito da te.',
      },
      {
        id: 'wait-checking',
        label: 'Sto controllando',
        text: 'Sto controllando le informazioni che mi servono per risponderti con precisione: ci vorranno un paio di minuti, resta pure in chat.',
      },
      {
        id: 'wait-thanks-patience',
        label: 'Grazie per la pazienza',
        text: 'Grazie per la pazienza! Ho recuperato quello che mi serviva, ecco la risposta:',
      },
      {
        id: 'wait-still-there',
        label: 'Ci sei ancora?',
        text: 'Ci sei ancora? 🙂 Se hai bisogno di altro tempo nessun problema, resto in chat ancora qualche minuto.',
      },
    ],
  },
  {
    id: 'discovery',
    label: 'Approfondimento',
    emoji: '❓',
    replies: [
      {
        id: 'discovery-age',
        label: 'Età e esperienza',
        text: 'Per consigliarti il percorso più adatto: quanti anni ha tuo figlio/a e ha già provato qualcosa di coding (Scratch, Roblox, Minecraft, Python…)?',
      },
      {
        id: 'discovery-goal',
        label: 'Obiettivo',
        text: 'Cosa vi piacerebbe ottenere dal corso? Ad esempio creare videogiochi, fare siti web, prepararsi alla scuola superiore o semplicemente scoprire se il coding gli piace.',
      },
      {
        id: 'discovery-more-details',
        label: 'Più dettagli',
        text: 'Puoi darmi qualche dettaglio in più? Così riesco a darti una risposta precisa e non farti perdere tempo.',
      },
      {
        id: 'discovery-availability',
        label: 'Disponibilità',
        text: 'Quali giorni e fasce orarie vi sono più comode per le lezioni? Così verifico subito i posti disponibili.',
      },
    ],
  },
  {
    id: 'info',
    label: 'Info corsi',
    emoji: '📚',
    replies: [
      {
        id: 'info-trial',
        label: 'Lezione di prova',
        text: 'La prima lezione è gratuita e senza impegno: serve a conoscere l\'insegnante e capire il livello di partenza. Puoi prenotarla qui: https://techlanditalia.it/prenota',
      },
      {
        id: 'info-courses',
        label: 'Catalogo corsi',
        text: 'Trovi tutti i corsi divisi per età (5-8, 9-12, 13-18 anni) su https://techlanditalia.it/corsi — se mi dici l\'età ti indico io i 2-3 più adatti.',
      },
      {
        id: 'info-online',
        label: 'Come funzionano',
        text: 'Le lezioni sono online, dal vivo con un insegnante (non video registrati), in piccoli gruppi o individuali. Serve solo un computer con webcam e connessione internet.',
      },
      {
        id: 'info-prices',
        label: 'Prezzi',
        text: 'I prezzi dipendono dal corso e dalla formula (gruppo o individuale). Per darti la cifra esatta preferisco fare due chiacchiere o farti provare la lezione gratuita: così ti propongo solo quello che serve davvero.',
      },
      {
        id: 'info-contacts',
        label: 'Contatti diretti',
        text: 'Se preferisci, puoi scriverci anche su WhatsApp al +39 350 581 3140 oppure via email a info@techlanditalia.it — rispondiamo in giornata.',
      },
    ],
  },
  {
    id: 'apology',
    label: 'Scuse',
    emoji: '🙏',
    replies: [
      {
        id: 'apology-generic',
        label: 'Ci dispiace',
        text: 'Mi dispiace davvero per l\'inconveniente. Capisco il fastidio e me ne occupo personalmente per risolverlo il prima possibile.',
      },
      {
        id: 'apology-delay',
        label: 'Scuse per il ritardo',
        text: 'Scusa per l\'attesa più lunga del solito! Sono qui adesso e ti dedico tutta la mia attenzione.',
      },
      {
        id: 'apology-misunderstanding',
        label: 'Chiarimento',
        text: 'Forse mi sono spiegato male, chiedo scusa. Provo a riformulare in modo più chiaro:',
      },
    ],
  },
  {
    id: 'closing',
    label: 'Chiusura',
    emoji: '✅',
    replies: [
      {
        id: 'closing-anything-else',
        label: 'Posso aiutarti in altro?',
        text: 'Posso aiutarti con qualcos\'altro? Se hai altre domande sono qui 🙂',
      },
      {
        id: 'closing-resolved',
        label: 'Risolto + saluto',
        text: 'Sono contento di essere riuscito ad aiutarti! Grazie per averci contattato e buona giornata da tutto il team TECHLAND 👋',
      },
      {
        id: 'closing-trial-cta',
        label: 'Saluto + prova gratuita',
        text: 'Grazie per la chiacchierata! Se vuoi, il passo successivo è la lezione di prova gratuita: https://techlanditalia.it/prenota — ci vediamo presto! 👋',
      },
      {
        id: 'closing-goodbye-short',
        label: 'Arrivederci',
        text: 'Grazie a te, a presto e buona giornata! 👋',
      },
      {
        id: 'closing-inactive',
        label: 'Chiudo per inattività',
        text: 'Non ricevendo risposta chiudo la chat per ora. Se hai bisogno puoi riscriverci in qualsiasi momento: saremo felici di aiutarti. A presto! 👋',
      },
    ],
  },
  {
    id: 'followup',
    label: 'Follow-up',
    emoji: '📞',
    replies: [
      {
        id: 'followup-email',
        label: 'Ti ricontattiamo',
        text: 'Per darti una risposta completa devo verificare un paio di cose con il team. Se mi lasci un\'email o un numero WhatsApp ti ricontatto io entro oggi.',
      },
      {
        id: 'followup-call',
        label: 'Proponi chiamata',
        text: 'Se ti fa comodo possiamo sentirci 10 minuti al telefono per capire insieme il percorso migliore: quando saresti disponibile?',
      },
      {
        id: 'followup-offline',
        label: 'Fuori orario',
        text: 'In questo momento il team non è operativo, ma ho letto il tuo messaggio: ti risponderemo appena possibile. Se preferisci, scrivici su WhatsApp al +39 350 581 3140.',
      },
    ],
  },
];

/** Tutte le risposte in un unico elenco (utile per ricerca/filtri). */
export const ALL_QUICK_REPLIES: (QuickReply & { categoryId: string })[] = QUICK_REPLY_CATEGORIES.flatMap((c) =>
  c.replies.map((r) => ({ ...r, categoryId: c.id }))
);
