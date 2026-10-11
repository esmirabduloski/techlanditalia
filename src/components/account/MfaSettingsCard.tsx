import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { MfaEnroll } from '@/components/auth/mfa/MfaEnroll';

interface Factor {
  id: string;
  friendly_name?: string;
  created_at: string;
}

/**
 * Gestione della verifica in due passaggi dal proprio account: elenco delle
 * app collegate, aggiunta di un secondo dispositivo, rimozione.
 * La 2FA esiste solo per admin/insegnanti/operatori (obbligatoria): i genitori
 * non la attivano, per non complicare il loro login. L'ultima app non si può
 * rimuovere (prima se ne aggiunge un'altra).
 */
export function MfaSettingsCard() {
  const { user, refreshAccess } = useAuth();
  const { toast } = useToast();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [mandatory, setMandatory] = useState<boolean | null>(null);
  const [adding, setAdding] = useState(false);
  const [toRemove, setToRemove] = useState<Factor | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'teacher', 'operator'])
      .then(({ data }) => setMandatory((data ?? []).length > 0));
  }, [user, load]);

  const remove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: toRemove.id });
    if (!error) await supabase.auth.refreshSession();
    setRemoving(false);
    setToRemove(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Impossibile rimuovere', description: error.message });
      return;
    }
    toast({ title: 'App di autenticazione rimossa' });
    await load();
    await refreshAccess();
  };

  const onAdded = async () => {
    setAdding(false);
    await load();
    await refreshAccess();
  };

  const active = (factors?.length ?? 0) > 0;

  if (mandatory === false && !active) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verifica in due passaggi
          </CardTitle>
          <CardDescription>
            Non è necessaria per il tuo account: serve solo agli account dello staff (admin e insegnanti).
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Verifica in due passaggi
          {factors && (
            <Badge variant={active ? 'default' : 'secondary'}>{active ? 'Attiva' : 'Non attiva'}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Oltre alla password, all&apos;accesso ti chiediamo un codice generato da un&apos;app sul telefono.
          {mandatory && ' Per il tuo ruolo è obbligatoria.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {factors === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <>
            {factors.length > 0 && (
              <ul className="divide-y rounded-md border">
                {factors.map((f) => {
                  const lastOne = factors.length === 1;
                  return (
                    <li key={f.id} className="flex items-center gap-3 p-3">
                      <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{f.friendly_name || 'App di autenticazione'}</p>
                        <p className="text-xs text-muted-foreground">
                          Aggiunta il {new Date(f.created_at).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Rimuovi"
                        disabled={!!mandatory && lastOne}
                        title={mandatory && lastOne ? 'Aggiungi prima un altro dispositivo' : undefined}
                        onClick={() => setToRemove(f)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}

            {factors.length === 1 && (
              <p className="text-xs text-muted-foreground">
                Consiglio: aggiungi un secondo dispositivo (es. il gestore password o un altro telefono),
                così se perdi il primo puoi accedere senza chiedere il reset all&apos;amministratore.
              </p>
            )}

            {adding ? (
              <MfaEnroll
                defaultName={factors.length > 0 ? 'Secondo dispositivo' : 'App di autenticazione'}
                onDone={onAdded}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <Button variant={active ? 'outline' : 'default'} onClick={() => setAdding(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {active ? 'Aggiungi un altro dispositivo' : 'Attiva la verifica in due passaggi'}
              </Button>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rimuovere questa app di autenticazione?</AlertDialogTitle>
            <AlertDialogDescription>
              {factors?.length === 1
                ? 'È l’unica collegata: la verifica in due passaggi verrà disattivata.'
                : 'Non potrai più usare i codici di questo dispositivo per accedere.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              {removing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rimuovi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
