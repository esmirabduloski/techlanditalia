import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { MfaChallenge } from '@/components/auth/mfa/MfaChallenge';
import type { MfaUserStatus } from '@/lib/mfaOverview';

/**
 * Reset della 2FA di un utente (telefono perso). Prima dell'operazione l'admin
 * conferma di aver verificato l'identità e reinserisce il codice della propria
 * app: la edge function admin-reset-mfa accetta solo un codice di pochi minuti fa.
 */
export function MfaResetDialog({
  open,
  onOpenChange,
  user,
  status,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; name: string; email?: string | null } | null;
  status: MfaUserStatus | undefined;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [identityChecked, setIdentityChecked] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setIdentityChecked(false);
      setNote('');
    }
  }, [open, user?.id]);

  if (!user) return null;

  const reset = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('admin-reset-mfa', {
      body: { userId: user.id, note: note.trim() || undefined },
    });
    setBusy(false);
    if (error || data?.error) {
      let message = data?.error as string | undefined;
      if (!message && error && 'context' in error) {
        try {
          message = (await (error.context as Response).json())?.error;
        } catch {
          // corpo non leggibile
        }
      }
      toast({ variant: 'destructive', title: 'Reset non riuscito', description: message || 'Riprova.' });
      return;
    }
    toast({
      title: '2FA reimpostata',
      description: data?.emailSent
        ? `${user.name} è stato disconnesso e ha ricevuto un'email.`
        : `${user.name} è stato disconnesso. L'email di avviso non è partita: avvisalo tu.`,
    });
    onOpenChange(false);
    onDone();
  };

  const reject = async () => {
    if (!status?.pendingRequestId) return;
    setBusy(true);
    const { data: { user: me } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('mfa_reset_requests' as never)
      .update({
        status: 'rejected',
        resolved_at: new Date().toISOString(),
        resolved_by: me?.id ?? null,
        note: note.trim() || null,
      } as never)
      .eq('id', status.pendingRequestId);
    setBusy(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Errore', description: error.message });
      return;
    }
    toast({ title: 'Richiesta rifiutata' });
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Reimposta 2FA di {user.name}
          </DialogTitle>
          <DialogDescription>
            Vengono rimosse tutte le app di autenticazione ({status?.verifiedFactors ?? 0}) e chiuse tutte le
            sessioni dell&apos;utente. Al prossimo accesso dovrà configurarne una nuova.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {status?.pendingRequestId && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="font-medium">
                Richiesta inviata dall&apos;utente il{' '}
                {status.pendingRequestAt ? new Date(status.pendingRequestAt).toLocaleString('it-IT') : '—'}
              </p>
              <p className="text-muted-foreground">Email confermata con codice monouso.</p>
              {status.pendingRequestNote && <p className="mt-1 italic">&ldquo;{status.pendingRequestNote}&rdquo;</p>}
            </div>
          )}

          <div className="flex items-start gap-2">
            <Checkbox
              id="mfa-identity"
              checked={identityChecked}
              onCheckedChange={(v) => setIdentityChecked(v === true)}
            />
            <Label htmlFor="mfa-identity" className="text-sm font-normal leading-snug">
              Ho verificato che la richiesta arriva davvero da {user.name}
              {user.email ? ` (${user.email})` : ''}, ad esempio con una telefonata al numero che conosciamo.
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mfa-reset-note">Nota interna (facoltativa)</Label>
            <Textarea
              id="mfa-reset-note"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Es. verificato al telefono il 12/10"
            />
          </div>

          {identityChecked && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Conferma con il codice della tua app di autenticazione</p>
              {busy ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <MfaChallenge submitLabel="Conferma e reimposta" onVerified={() => void reset()} />
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {status?.pendingRequestId ? (
            <Button variant="ghost" onClick={reject} disabled={busy}>
              Rifiuta richiesta
            </Button>
          ) : (
            <span />
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
