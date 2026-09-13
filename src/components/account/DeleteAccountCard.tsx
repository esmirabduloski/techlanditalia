import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

/**
 * Cancellazione account self-service (art. 17 GDPR), solo per i genitori.
 * Mostra cosa verrà eliminato (account propri e dei figli) e chiede di digitare
 * ELIMINA prima di chiamare la edge function delete-my-account.
 */
export function DeleteAccountCard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isParent, setIsParent] = useState(false);
  const [children, setChildren] = useState<{ id: string; full_name: string | null }[]>([]);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (cancelled || profile?.role !== 'parent') return;
      const { data: kids } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('parent_id', user.id)
        .eq('role', 'student');
      if (cancelled) return;
      setIsParent(true);
      setChildren(kids ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!isParent) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-my-account', { body: { confirm: 'ELIMINA' } });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Errore');
      toast({ title: 'Account eliminato', description: 'I tuoi dati e quelli dei tuoi figli sono stati cancellati. Grazie di essere stato con noi.' });
      setOpen(false);
      await signOut();
      navigate('/', { replace: true });
    } catch (e) {
      toast({ title: 'Impossibile eliminare l\'account', description: e instanceof Error ? e.message : 'Riprova o scrivici a info@techlanditalia.it', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trash2 className="w-5 h-5 text-destructive" /> Elimina account
        </CardTitle>
        <CardDescription>
          Diritto alla cancellazione (art. 17 GDPR): puoi eliminare in autonomia il tuo account e quelli dei tuoi figli.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <p className="font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" /> Cosa succede
          </p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>
              Vengono eliminati il tuo account e{' '}
              {children.length > 0
                ? `gli account di ${children.map((c) => c.full_name).filter(Boolean).join(', ') || `${children.length} studenti`}`
                : 'gli eventuali account studente collegati'}
              , con progressi, compiti consegnati, presenze, badge e commenti.
            </li>
            <li>Le lezioni residue non ancora utilizzate vengono perse: contattaci prima se vuoi chiarimenti.</li>
            <li>Conserviamo solo i documenti contabili obbligatori per legge (fatture), per 10 anni.</li>
            <li>L&apos;operazione è immediata e non reversibile.</li>
          </ul>
        </div>

        <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmText(''); }}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10">
              <Trash2 className="w-4 h-4 mr-2" /> Elimina il mio account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confermi l&apos;eliminazione definitiva?</AlertDialogTitle>
              <AlertDialogDescription>
                Per procedere scrivi <strong>ELIMINA</strong> nel campo qui sotto. Verranno cancellati il tuo account
                {children.length > 0 ? ` e ${children.length === 1 ? 'l\'account studente collegato' : `i ${children.length} account studente collegati`}` : ''}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">Digita ELIMINA</Label>
              <Input
                id="delete-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                autoComplete="off"
                placeholder="ELIMINA"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Annulla</AlertDialogCancel>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting || confirmText !== 'ELIMINA'}>
                {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Elimina definitivamente
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
