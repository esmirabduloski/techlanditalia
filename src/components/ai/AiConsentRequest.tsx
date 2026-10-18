import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AiToolsList } from '@/components/ai/AiToolsList';
import { type AiAccess, aiErrorMessage, setAiConsent } from '@/lib/aiConsents';

interface Props {
  access: AiAccess;
  studentId: string;
  onChange: () => void;
}

/**
 * Cosa vede lo studente senza consenso. Sotto i 14 anni (o senza anno di
 * nascita) può solo chiedere al genitore; dai 14 legge cosa fa lo strumento e
 * decide da solo (L. 132/2025, art. 4 c. 3-4).
 */
export function AiConsentRequest({ access, studentId, onChange }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const activate = async () => {
    setBusy(true);
    const { error } = await setAiConsent(studentId, true, access.version);
    setBusy(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Non è stato possibile attivarli', description: aiErrorMessage(error) });
      return;
    }
    toast({ title: 'Strumenti AI attivati', description: 'Puoi disattivarli quando vuoi dal tuo Profilo.' });
    onChange();
  };

  return (
    <div className="space-y-3 text-sm" data-testid="ai-consent-request">
      {access.status === 'outdated' && (
        <p className="text-muted-foreground">Gli strumenti AI sono cambiati: serve di nuovo il consenso.</p>
      )}
      {access.can_self_consent ? (
        <>
          <p className="text-muted-foreground">
            Alcuni strumenti usano l&apos;intelligenza artificiale. Hai almeno 14 anni, quindi puoi decidere tu se
            usarli. Ecco cosa fanno e dove vanno i tuoi dati:
          </p>
          <AiToolsList />
          <p className="text-xs text-muted-foreground">
            Non sei obbligato: le lezioni le segui lo stesso. Puoi disattivarli quando vuoi dal tuo Profilo, e i tuoi
            genitori vedono la tua scelta.
          </p>
          <Button size="sm" disabled={busy} onClick={activate}>
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Attiva strumenti AI
          </Button>
        </>
      ) : (
        <p className="text-muted-foreground">
          Per usare gli strumenti AI serve il permesso di un genitore: chiedigli di attivarli dal suo Profilo.
        </p>
      )}
    </div>
  );
}
