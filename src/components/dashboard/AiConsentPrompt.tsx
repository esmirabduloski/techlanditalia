import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AiToolsList } from '@/components/ai/AiToolsList';
import { type ChildAiState, aiConsentStatus, aiErrorMessage, fetchChildrenAiState, setAiConsent } from '@/lib/aiConsents';

interface Props {
  userId: string;
  /** Admin che impersona: vede l'avviso ma non può decidere al posto del genitore */
  readOnly?: boolean;
}

/**
 * Chiede al genitore, in evidenza nella dashboard, il consenso agli strumenti AI
 * per i figli su cui non ha ancora deciso o il cui consenso riguarda una
 * versione superata. Opt-in; "No, grazie" registra il rifiuto così l'avviso
 * non torna. Anno di nascita e scelta per figlio sono nel Profilo (AiConsentCard).
 */
export function AiConsentPrompt({ userId, readOnly }: Props) {
  const { toast } = useToast();
  const [version, setVersion] = useState<string | null>(null);
  const [pending, setPending] = useState<ChildAiState[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const state = await fetchChildrenAiState(userId);
    if (!state) return;
    setVersion(state.version);
    setPending(
      state.children.filter((c) => ['none', 'outdated'].includes(aiConsentStatus(c.consent, state.version))),
    );
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!version || pending.length === 0) return null;

  const decide = async (granted: boolean) => {
    setBusy(true);
    const results = await Promise.all(pending.map((c) => setAiConsent(c.id, granted, version)));
    setBusy(false);
    const failed = results.find((r) => r.error);
    if (failed) {
      toast({ variant: 'destructive', title: 'Non è stato possibile salvare', description: aiErrorMessage(failed.error) });
      return;
    }
    toast({
      title: granted ? 'Strumenti AI attivati' : 'Va bene, niente strumenti AI',
      description: 'Puoi cambiare idea quando vuoi dal tuo Profilo.',
    });
    setPending([]);
  };

  const names = pending.map((c) => c.full_name?.split(' ')[0] ?? 'tuo figlio').join(' e ');
  const renewal = pending.some((c) => aiConsentStatus(c.consent, version) === 'outdated');

  return (
    <Card className="mb-8 border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-tech-teal/10" data-testid="ai-consent-prompt">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 shrink-0"><Sparkles className="w-6 h-6 text-primary" /></div>
          <div className="space-y-2 text-sm">
            <h2 className="text-lg font-bold text-foreground">Vuoi attivare gli strumenti AI per {names}?</h2>
            {renewal && (
              <p className="text-muted-foreground">Gli strumenti AI sono cambiati: serve di nuovo il tuo consenso.</p>
            )}
            <p className="text-muted-foreground">
              Alcune attività usano strumenti di intelligenza artificiale. Sotto i 14 anni, per legge, decide il genitore.
            </p>
            <AiToolsList compact />
            <p className="text-xs text-muted-foreground">
              È facoltativo: se non li attivi, partecipa normalmente alle lezioni.{' '}
              <Link to="/area-riservata/profilo" className="underline hover:text-foreground">
                Dettagli e scelta per ogni figlio nel Profilo
              </Link>
            </p>
          </div>
        </div>
        {!readOnly && (
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button variant="ghost" disabled={busy} onClick={() => decide(false)}>No, grazie</Button>
            <Button disabled={busy} onClick={() => decide(true)}>
              {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Attiva strumenti AI
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
