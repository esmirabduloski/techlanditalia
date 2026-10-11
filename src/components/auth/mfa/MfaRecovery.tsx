import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MfaCodeInput } from './MfaCodeInput';

type Step = 'intro' | 'code' | 'sent';

async function invokeRecovery(body: Record<string, unknown>): Promise<{ error?: string }> {
  const { data, error } = await supabase.functions.invoke('mfa-recovery', { body });
  if (!error) return data ?? {};
  try {
    return (await (error as { context?: Response }).context?.json()) ?? { error: error.message };
  } catch {
    return { error: error.message };
  }
}

/**
 * "Ho perso l'app di autenticazione": conferma via codice email (verifyOtp
 * nativo di Supabase) e invio di una richiesta che un admin deve approvare.
 */
export function MfaRecovery({ email, onBack }: { email: string; onBack: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('intro');
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setBusy(true);
    const res = await invokeRecovery({ action: 'send-code' });
    setBusy(false);
    if (res.error) {
      toast({ variant: 'destructive', title: 'Errore', description: res.error });
      return;
    }
    setStep('code');
    toast({ title: 'Codice inviato', description: `Controlla la casella ${email}` });
  };

  const submit = async (value = code) => {
    if (value.length !== 6) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: value, type: 'email' });
    if (error) {
      setBusy(false);
      setCode('');
      toast({ variant: 'destructive', title: 'Codice non valido o scaduto', description: 'Richiedi un nuovo codice.' });
      return;
    }
    const res = await invokeRecovery({ action: 'submit', note: note.trim() || undefined });
    setBusy(false);
    if (res.error) {
      toast({ variant: 'destructive', title: 'Errore', description: res.error });
      return;
    }
    setStep('sent');
  };

  if (step === 'sent') {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <p className="text-sm">
          Richiesta inviata. Un amministratore verificherà la tua identità e reimposterà la verifica
          in due passaggi: riceverai un&apos;email di conferma. Poi potrai accedere e configurare una nuova app.
        </p>
        <Button variant="outline" onClick={onBack}>Indietro</Button>
      </div>
    );
  }

  if (step === 'code') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Inserisci il codice a 6 cifre che ti abbiamo inviato a <strong>{email}</strong>.
        </p>
        <MfaCodeInput value={code} onChange={setCode} disabled={busy} />
        <div className="space-y-2">
          <Label htmlFor="mfa-note">Messaggio per l&apos;amministratore (facoltativo)</Label>
          <Textarea
            id="mfa-note"
            value={note}
            maxLength={500}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Es. ho cambiato telefono"
          />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => submit()} disabled={busy || code.length !== 6}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Invia richiesta
          </Button>
          <Button variant="ghost" onClick={sendCode} disabled={busy}>Invia un nuovo codice</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Se non hai più accesso all&apos;app di autenticazione, ti mandiamo un codice via email per confermare
        che sei tu. La richiesta passa poi a un amministratore, che reimposta la verifica in due passaggi.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={sendCode} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Inviami il codice
        </Button>
        <Button variant="ghost" onClick={onBack} disabled={busy}>Indietro</Button>
      </div>
    </div>
  );
}
