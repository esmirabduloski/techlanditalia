import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MfaCodeInput } from './MfaCodeInput';

interface TotpFactor {
  id: string;
  friendly_name?: string;
}

/**
 * Richiesta del codice dell'app di autenticazione (challengeAndVerify nativo).
 * Usato al login (sessione aal1 -> aal2) e come conferma prima delle azioni
 * delicate (es. reset della 2FA di un altro utente).
 */
export function MfaChallenge({
  submitLabel = 'Verifica',
  onVerified,
}: {
  submitLabel?: string;
  onVerified: () => void;
}) {
  const { toast } = useToast();
  const [factors, setFactors] = useState<TotpFactor[] | null>(null);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const totp = data?.totp ?? [];
      setFactors(totp);
      if (totp[0]) setFactorId(totp[0].id);
    });
  }, []);

  const verify = async (value = code) => {
    if (!factorId || value.length !== 6) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: value });
    setBusy(false);
    if (error) {
      setCode('');
      toast({ variant: 'destructive', title: 'Codice non valido', description: 'Inserisci il codice attuale mostrato dall’app.' });
      return;
    }
    onVerified();
  };

  if (factors === null) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {factors.length > 1 && (
        <div className="space-y-2">
          <Label>Dispositivo</Label>
          <Select value={factorId} onValueChange={setFactorId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {factors.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.friendly_name || 'App di autenticazione'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <MfaCodeInput value={code} onChange={setCode} onComplete={verify} disabled={busy} />
      <div className="flex justify-center">
        <Button onClick={() => verify()} disabled={busy || code.length !== 6}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
