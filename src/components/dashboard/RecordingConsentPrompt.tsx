import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { consentKey, consentStatus, fetchMediaConsents, setMediaConsent } from '@/lib/mediaConsents';
import { fetchChildIds } from '@/lib/familyClient';

interface Props {
  userId: string;
  /** Admin che impersona: vede l'avviso ma non può decidere al posto del genitore */
  readOnly?: boolean;
}

/**
 * Chiede al genitore, in evidenza nella dashboard, il consenso alla registrazione
 * delle lezioni per i figli su cui non ha ancora deciso. Il consenso resta
 * opt-in (GDPR: niente consenso pre-attivato); "No, grazie" registra il rifiuto
 * così l'avviso non torna. Si cambia idea dal Profilo (MediaConsentCard).
 */
export function RecordingConsentPrompt({ userId, readOnly }: Props) {
  const { toast } = useToast();
  const [pending, setPending] = useState<{ id: string; full_name: string | null }[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: me } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
    if (me?.role !== 'parent') return;
    const { data: kids } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', await fetchChildIds(supabase, userId))
      .eq('role', 'student');
    const list = kids ?? [];
    if (list.length === 0) return;
    const consents = await fetchMediaConsents(list.map((k) => k.id));
    setPending(list.filter((k) => consentStatus(consents.get(consentKey(k.id, 'lesson_recording'))) === 'none'));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (pending.length === 0) return null;

  const decide = async (granted: boolean) => {
    setBusy(true);
    const results = await Promise.all(pending.map((k) => setMediaConsent(k.id, 'lesson_recording', granted)));
    setBusy(false);
    if (results.some((r) => r.error)) {
      toast({ variant: 'destructive', title: 'Non è stato possibile salvare', description: 'Riprova o scrivici a info@techlanditalia.it' });
      return;
    }
    toast({
      title: granted ? 'Registrazioni attivate' : 'Va bene, niente registrazioni',
      description: 'Puoi cambiare idea quando vuoi dal tuo Profilo.',
    });
    setPending([]);
  };

  const names = pending.map((k) => k.full_name?.split(' ')[0] ?? 'tuo figlio').join(' e ');

  return (
    <Card className="mb-8 border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-tech-teal/10" data-testid="recording-consent-prompt">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 shrink-0"><Video className="w-6 h-6 text-primary" /></div>
          <div className="space-y-2 text-sm">
            <h2 className="text-lg font-bold text-foreground">Vuoi le registrazioni delle lezioni di {names}?</h2>
            <p className="text-muted-foreground">
              Così può riguardarle a casa per ripassare o recuperare una lezione persa. Le registrazioni si vedono solo
              nell&apos;area riservata di techlanditalia.it, le cancelliamo alla fine del corso e né noi né voi possiamo
              usarle o diffonderle fuori dalla piattaforma.
            </p>
            <p className="text-xs text-muted-foreground">
              È facoltativo: se non lo attivi, partecipa normalmente alle lezioni.{' '}
              <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
            </p>
          </div>
        </div>
        {!readOnly && (
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button variant="ghost" disabled={busy} onClick={() => decide(false)}>No, grazie</Button>
            <Button disabled={busy} onClick={() => decide(true)}>
              {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Attiva registrazioni
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
