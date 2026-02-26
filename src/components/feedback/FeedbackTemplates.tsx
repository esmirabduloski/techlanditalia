import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquarePlus } from "lucide-react";

export interface FeedbackTemplate {
  label: string;
  text: string;
  category: 'positivo' | 'miglioramento' | 'generico';
}

const COMMENT_TEMPLATES: FeedbackTemplate[] = [
  { label: "Ottimo lavoro!", text: "Ottimo lavoro! Continua così, stai facendo grandi progressi! 🎉", category: "positivo" },
  { label: "Bravo/a!", text: "Bravo/a! Hai dimostrato di aver capito bene l'argomento.", category: "positivo" },
  { label: "Eccellente impegno", text: "Eccellente impegno durante la lezione. Si vede che ti stai applicando con costanza.", category: "positivo" },
  { label: "Creativo/a", text: "Hai mostrato grande creatività nella risoluzione del problema. Complimenti!", category: "positivo" },
  { label: "Serve più pratica", text: "Serve più pratica su questo argomento. Ti consiglio di rivedere gli esercizi e riprovare.", category: "miglioramento" },
  { label: "Attenzione ai dettagli", text: "Il lavoro è buono, ma fai più attenzione ai dettagli. Ricontrolla il codice prima di consegnare.", category: "miglioramento" },
  { label: "Rivedi la lezione", text: "Ti consiglio di rivedere la lezione e riprovare l'esercizio. Se hai dubbi, chiedi pure!", category: "miglioramento" },
  { label: "Partecipazione", text: "Dovresti partecipare di più durante la lezione. Non aver paura di fare domande!", category: "miglioramento" },
  { label: "Buon inizio", text: "Buon inizio! Hai capito le basi, ora prova ad approfondire.", category: "generico" },
  { label: "Compito corretto", text: "Compito corretto e ben strutturato. Niente da segnalare.", category: "generico" },
];

const GRADING_TEMPLATES: FeedbackTemplate[] = [
  { label: "Perfetto!", text: "Perfetto! Codice corretto e ben organizzato. 🎉", category: "positivo" },
  { label: "Ottimo lavoro", text: "Ottimo lavoro! Hai risolto l'esercizio correttamente.", category: "positivo" },
  { label: "Quasi perfetto", text: "Quasi perfetto! Solo un piccolo errore, ma l'approccio è corretto.", category: "positivo" },
  { label: "Errori nel codice", text: "Ci sono alcuni errori nel codice. Rivedi la logica e riprova.", category: "miglioramento" },
  { label: "Incompleto", text: "Il compito è incompleto. Completa le parti mancanti e riconsegna.", category: "miglioramento" },
  { label: "Copia non originale", text: "Il lavoro sembra non essere originale. Prova a risolvere l'esercizio da solo.", category: "miglioramento" },
  { label: "Buon tentativo", text: "Buon tentativo! L'idea è giusta ma l'implementazione ha bisogno di qualche correzione.", category: "generico" },
];

const categoryColors: Record<string, string> = {
  positivo: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50",
  miglioramento: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50",
  generico: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50",
};

interface FeedbackTemplatesProps {
  onSelect: (text: string) => void;
  mode?: 'comment' | 'grading';
}

export function FeedbackTemplates({ onSelect, mode = 'comment' }: FeedbackTemplatesProps) {
  const templates = mode === 'grading' ? GRADING_TEMPLATES : COMMENT_TEMPLATES;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <MessageSquarePlus className="w-3 h-3" />
        Template rapidi (clicca per inserire)
      </p>
      <div className="flex flex-wrap gap-1.5">
        {templates.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(t.text)}
            className={`text-xs px-2.5 py-1 rounded-full cursor-pointer transition-colors ${categoryColors[t.category]}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
