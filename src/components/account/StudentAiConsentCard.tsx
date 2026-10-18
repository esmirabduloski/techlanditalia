import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAiAccess } from '@/hooks/useAiAccess';
import { AiConsentRequest } from '@/components/ai/AiConsentRequest';
import { aiErrorMessage, setAiConsent } from '@/lib/aiConsents';

/**
 * Nel Profilo dello studente: se gli strumenti AI sono attivi e come
 * disattivarli. Lo studente può sempre disattivarli per sé; attivarli da solo
 * solo dai 14 anni. Compare quando esiste il primo strumento AI.
 */
export function StudentAiConsentCard() {
  const { toast } = useToast();
  const { access, reload, userId } = useAiAccess();
  const [busy, setBusy] = useState(false);

  if (!access || !userId || access.status === 'no_tools' || access.status === 'adult') return null;

  const deactivate = async () => {
    setBusy(true);
    const { error } = await setAiConsent(userId, false, access.version);
    setBusy(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Non è stato possibile disattivarli', description: aiErrorMessage(error) });
      return;
    }
    toast({ title: 'Strumenti AI disattivati' });
    reload();
  };

  return (
    <Card data-testid="student-ai-consent-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5 text-primary" /> Strumenti di intelligenza artificiale
        </CardTitle>
        {access.allowed && <CardDescription>Sono attivi: puoi usarli nelle attività che li prevedono.</CardDescription>}
      </CardHeader>
      <CardContent>
        {access.allowed ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={deactivate}>
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Disattiva strumenti AI
          </Button>
        ) : (
          <AiConsentRequest access={access} studentId={userId} onChange={reload} />
        )}
      </CardContent>
    </Card>
  );
}
