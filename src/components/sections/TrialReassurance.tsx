import { CheckCircle2 } from "lucide-react";

/**
 * Cosa succede dopo il click su "Prenota lezione gratuita": i tre fatti che
 * tolgono i dubbi a un genitore (costo/impegno, formato, tempi). Unica fonte
 * del testo, così è identico sotto ogni CTA del sito.
 */
const TRIAL_FACTS = [
  "Gratuita e senza impegno",
  "Fino a 60 minuti online con un insegnante",
  "Ti ricontattiamo entro 24 ore",
] as const;

interface TrialReassuranceProps {
  className?: string;
  /** Su sfondi scuri/gradient (sezioni CTA) usa i colori primary-foreground. */
  onDark?: boolean;
  /** Frase introduttiva rivolta al genitore, es. "Scopri se il coding piace a tuo figlio:". */
  lead?: string;
  align?: "left" | "center";
}

export function TrialReassurance({ className = "", onDark = false, lead, align = "left" }: TrialReassuranceProps) {
  const text = onDark ? "text-primary-foreground/85" : "text-muted-foreground";
  const icon = onDark ? "text-primary-foreground" : "text-tech-green";
  const justify = align === "center" ? "justify-center text-center" : "";
  return (
    <div className={`text-sm ${text} ${className}`}>
      {lead && <p className={`mb-1.5 font-medium ${onDark ? "text-primary-foreground" : "text-foreground"} ${align === "center" ? "text-center" : ""}`}>{lead}</p>}
      <ul className={`flex flex-wrap gap-x-4 gap-y-1.5 ${justify}`}>
        {TRIAL_FACTS.map((fact) => (
          <li key={fact} className="inline-flex items-center gap-1.5">
            <CheckCircle2 className={`w-4 h-4 shrink-0 ${icon}`} aria-hidden="true" />
            <span>{fact}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
