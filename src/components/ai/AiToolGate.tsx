import { ReactNode } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useAiAccess } from '@/hooks/useAiAccess';
import { AiConsentRequest } from '@/components/ai/AiConsentRequest';

/**
 * Da mettere intorno a ogni strumento AI per gli studenti (L. 132/2025, art. 4
 * c. 4): lo mostra solo con il consenso valido, altrimenti spiega come averlo.
 * Solo interfaccia: l'edge function dello strumento deve chiamare anche
 * requireAiConsent() (supabase/functions/_shared/aiconsent.ts).
 */
export function AiToolGate({ children }: { children: ReactNode }) {
  const { access, loading, reload, userId } = useAiAccess();

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
  if (access?.allowed) return <>{children}</>;
  // Nessuno strumento AI in vigore, o errore: lo strumento non si mostra affatto
  if (!access || !userId || access.status === 'no_tools' || access.status === 'adult') return null;

  return (
    <div className="rounded-lg border border-dashed p-4" data-testid="ai-tool-gate">
      <p className="mb-2 flex items-center gap-2 font-medium text-foreground">
        <Sparkles className="w-4 h-4 text-primary" /> Strumenti AI non attivi
      </p>
      <AiConsentRequest access={access} studentId={userId} onChange={reload} />
    </div>
  );
}
