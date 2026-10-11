import { useEffect, useRef, useState } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MfaCodeInput } from './MfaCodeInput';

interface Enrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

/**
 * Configurazione di una app di autenticazione (TOTP) con l'API nativa di
 * Supabase: enroll -> QR code -> challengeAndVerify. Alla verifica la sessione
 * passa ad aal2 e Supabase emette l'evento MFA_CHALLENGE_VERIFIED.
 */
export function MfaEnroll({
  defaultName = 'App di autenticazione',
  onDone,
  onCancel,
}: {
  defaultName?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(defaultName);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const verified = useRef(false);

  // Un fattore avviato e mai verificato va rimosso, altrimenti resta appeso
  // (e blocca un nuovo enroll con lo stesso nome).
  useEffect(() => {
    return () => {
      if (enrollment && !verified.current) {
        supabase.auth.mfa.unenroll({ factorId: enrollment.factorId }).catch(() => {});
      }
    };
  }, [enrollment]);

  const start = async () => {
    setBusy(true);
    try {
      // Pulizia di eventuali tentativi precedenti rimasti a metà
      const { data: list } = await supabase.auth.mfa.listFactors();
      const stale = (list?.all ?? []).filter((f) => f.factor_type === 'totp' && f.status !== 'verified');
      await Promise.all(stale.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })));

      const friendlyName = `${name.trim() || defaultName} · ${new Date().toLocaleDateString('it-IT')}`;
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName,
        issuer: 'TECHLAND',
      });
      if (error) throw error;
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Impossibile avviare la configurazione',
        description: e instanceof Error ? e.message : 'Riprova tra qualche istante.',
      });
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (!enrollment || value.length !== 6) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code: value,
    });
    setBusy(false);
    if (error) {
      setCode('');
      toast({
        variant: 'destructive',
        title: 'Codice non valido',
        description: "Controlla che l'ora del telefono sia corretta e inserisci il codice attuale.",
      });
      return;
    }
    verified.current = true;
    toast({ title: 'Verifica in due passaggi attivata' });
    onDone();
  };

  if (!enrollment) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ti serve un&apos;app di autenticazione sul telefono, ad esempio Google Authenticator,
          Microsoft Authenticator, Authy o il gestore password (1Password, Bitwarden, iCloud Portachiavi).
        </p>
        <div className="space-y-2">
          <Label htmlFor="mfa-name">Nome del dispositivo</Label>
          <Input
            id="mfa-name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="Es. iPhone di lavoro"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={start} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continua
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={busy}>
              Annulla
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Apri l&apos;app di autenticazione e aggiungi un nuovo account.</li>
        <li>Inquadra il QR code (oppure inserisci la chiave a mano).</li>
        <li>Scrivi qui sotto il codice a 6 cifre che compare nell&apos;app.</li>
      </ol>
      <div className="flex justify-center">
        <img
          src={enrollment.qrCode}
          alt="QR code per l'app di autenticazione"
          className="h-48 w-48 rounded-md bg-white p-2"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Chiave manuale</Label>
        <div className="flex items-center gap-2">
          <code className="flex-1 break-all rounded bg-muted px-2 py-1 text-xs">{enrollment.secret}</code>
          <Button
            variant="outline"
            size="icon"
            aria-label="Copia chiave"
            onClick={() => navigator.clipboard?.writeText(enrollment.secret)}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <MfaCodeInput value={code} onChange={setCode} onComplete={verify} disabled={busy} />
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => verify()} disabled={busy || code.length !== 6}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Attiva
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Annulla
          </Button>
        )}
      </div>
    </div>
  );
}
