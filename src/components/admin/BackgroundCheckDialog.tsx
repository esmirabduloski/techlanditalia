import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { FileCheck2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { type BackgroundCheck, defaultNextCheck, formatItDate } from '@/lib/backgroundChecks';

/**
 * Registra la data in cui è stato verificato il certificato del casellario di
 * un insegnante e quando ricontrollarlo. Nessun documento viene caricato.
 */
export function BackgroundCheckDialog({
  open,
  onOpenChange,
  teacher,
  check,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: { id: string; name: string } | null;
  check: BackgroundCheck | undefined;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [verifiedAt, setVerifiedAt] = useState('');
  const [nextCheckAt, setNextCheckAt] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    setVerifiedAt(check?.verified_at ?? today);
    setNextCheckAt(check?.next_check_at ?? defaultNextCheck(today));
  }, [open, check]);

  if (!teacher) return null;

  const valid = !!verifiedAt && !!nextCheckAt && nextCheckAt > verifiedAt;

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    const { error } = await supabase.from('teacher_background_checks' as never).upsert({
      user_id: teacher.id,
      verified_at: verifiedAt,
      next_check_at: nextCheckAt,
      verified_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    } as never);
    setBusy(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Errore', description: error.message });
      return;
    }
    toast({ title: 'Verifica registrata', description: `Prossimo controllo il ${formatItDate(nextCheckAt)}` });
    onOpenChange(false);
    onSaved();
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase
      .from('teacher_background_checks' as never)
      .delete()
      .eq('user_id', teacher.id);
    setBusy(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Errore', description: error.message });
      return;
    }
    toast({ title: 'Verifica rimossa' });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-primary" />
            Casellario giudiziale: {teacher.name}
          </DialogTitle>
          <DialogDescription>
            Certificato richiesto dall&apos;art. 25-bis DPR 313/2002 (D.Lgs. 39/2014) per chi lavora a contatto
            con minori.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            Qui si registra solo la data. Il certificato non va caricato né descritto: conservalo nel fascicolo del
            personale con accesso limitato (dati giudiziari, art. 10 GDPR).
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bc-verified">Verificato il</Label>
              <Input
                id="bc-verified"
                type="date"
                value={verifiedAt}
                onChange={(e) => {
                  setVerifiedAt(e.target.value);
                  if (e.target.value) setNextCheckAt(defaultNextCheck(e.target.value));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bc-next">Prossimo controllo</Label>
              <Input id="bc-next" type="date" value={nextCheckAt} onChange={(e) => setNextCheckAt(e.target.value)} />
            </div>
          </div>
          {!valid && verifiedAt && nextCheckAt && (
            <p className="text-xs text-destructive">Il prossimo controllo deve essere dopo la data di verifica.</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {check ? (
            <Button variant="ghost" onClick={remove} disabled={busy}>
              Rimuovi verifica
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save} disabled={busy || !valid}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
