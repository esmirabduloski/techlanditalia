import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

const WHATSAPP_NUMBER = "393505813140"; // +39 350 581 3140, lo stesso del footer

/**
 * Canale alternativo al form per chi non vuole compilare moduli: link diretto
 * a WhatsApp con messaggio precompilato (menziona il corso se noto).
 * Tracciato come le altre CTA tramite data-track-cta.
 */
interface WhatsAppCtaProps {
  trackId: string;
  courseTitle?: string;
  className?: string;
  onDark?: boolean;
}

function whatsappUrl(courseTitle?: string): string {
  const text = courseTitle
    ? `Ciao! Vorrei informazioni sulla lezione di prova gratuita del corso ${courseTitle}.`
    : "Ciao! Vorrei informazioni sulla lezione di prova gratuita di TECHLAND.";
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export function WhatsAppCta({ trackId, courseTitle, className = "", onDark = false }: WhatsAppCtaProps) {
  const color = onDark ? "text-primary-foreground/85 hover:text-primary-foreground" : "text-muted-foreground hover:text-foreground";
  return (
    <p className={`text-sm ${color} ${className}`}>
      Preferisci WhatsApp?{" "}
      <a
        href={whatsappUrl(courseTitle)}
        target="_blank"
        rel="noopener noreferrer"
        data-track-cta={trackId}
        data-track-label="WhatsApp"
        className="inline-flex items-center gap-1.5 font-medium underline underline-offset-4 decoration-current/40 hover:decoration-current"
      >
        <WhatsAppIcon className="w-4 h-4" />
        Scrivici un messaggio
        <span className="sr-only"> (si apre in una nuova finestra)</span>
      </a>
    </p>
  );
}
