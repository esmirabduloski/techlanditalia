import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Info, Loader2, RotateCcw, Trash2, X } from 'lucide-react';
import {
  TRASH_RETENTION_DAYS,
  batchContents,
  batchTitle,
  batchTypes,
  daysLeft,
  restoreErrorMessage,
  tableLabel,
  type TrashBatch,
} from '@/lib/trash';
import { fetchTrashBatches, trashClient } from '@/lib/trashClient';

const ALL_TYPES = 'all';

export default function AdminTrash() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [batches, setBatches] = useState<TrashBatch[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [notApplied, setNotApplied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isEmptying, setIsEmptying] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate('/admin/login');
  }, [user, isAdmin, authLoading, navigate]);

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchTrashBatches();
      setNotApplied(data === null);
      setLoadError(null);
      setBatches(data ?? []);

      const ids = [...new Set((data ?? []).map((b) => b.deleted_by).filter((id): id is string => !!id))];
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
        setNames(Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name || p.email || 'Admin'])));
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  const types = useMemo(() => batchTypes(batches), [batches]);
  const visible = useMemo(
    () => (typeFilter === ALL_TYPES ? batches : batches.filter((b) => b.root_table === typeFilter)),
    [batches, typeFilter],
  );

  const handleRestore = async (batch: TrashBatch) => {
    setBusyId(batch.batch_id);
    const { data, error } = await trashClient.rpc('restore_trash_batch', { _batch: batch.batch_id });
    setBusyId(null);
    if (error) {
      toast({ title: 'Non posso ripristinare', description: restoreErrorMessage(error), variant: 'destructive' });
      return;
    }
    const others = (data ?? batch.total) - 1;
    toast({
      title: `Ripristinato: ${batchTitle(batch)}`,
      description: others > 0 ? `Insieme a ${others} element${others === 1 ? 'o collegato' : 'i collegati'}.` : undefined,
    });
    fetchData();
  };

  const handlePurge = async (batch: TrashBatch) => {
    setBusyId(batch.batch_id);
    const { error } = await trashClient.rpc('purge_trash_batch', { _batch: batch.batch_id });
    setBusyId(null);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: `Eliminato per sempre: ${batchTitle(batch)}` });
    fetchData();
  };

  const handleEmpty = async () => {
    setIsEmptying(true);
    const { error } = await trashClient.rpc('empty_trash');
    setIsEmptying(false);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Cestino svuotato' });
    setTypeFilter(ALL_TYPES);
    fetchData();
  };

  if (authLoading || (isAdmin && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminHeader />
      <AdminNav />
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Trash2 className="w-8 h-8 text-primary" />
            Cestino
          </h1>
          <p className="text-muted-foreground mt-1">
            Quello che un admin elimina resta qui {TRASH_RETENTION_DAYS} giorni. "Ripristina" lo rimette com'era,
            insieme a tutto quello che è stato eliminato con lui: le lezioni di un corso, le consegne di un compito,
            gli alunni e le presenze di un gruppo. Dopo {TRASH_RETENTION_DAYS} giorni viene cancellato per sempre.
          </p>
        </div>

        {notApplied && (
          <Card className="border-destructive/50">
            <CardContent className="py-4 text-sm text-destructive">
              Il cestino non è ancora attivo: la migrazione 0069_trash va applicata da Lovable. Fino ad allora le
              eliminazioni restano definitive.
            </CardContent>
          </Card>
        )}

        {loadError && (
          <Card className="border-destructive/50">
            <CardContent className="py-4 text-sm text-destructive">Non riesco a leggere il cestino ({loadError}).</CardContent>
          </Card>
        )}

        {!notApplied && !loadError && (
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">Eliminati di recente</CardTitle>
                <CardDescription>
                  {batches.length === 0
                    ? 'Il cestino è vuoto.'
                    : `${batches.length} eliminazion${batches.length === 1 ? 'e' : 'i'}, dalla più recente.`}
                </CardDescription>
              </div>
              {batches.length > 0 && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full sm:w-56" aria-label="Filtra per tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_TYPES}>Tutti i tipi</SelectItem>
                      {types.map((t) => (
                        <SelectItem key={t} value={t}>
                          {tableLabel(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={isEmptying}>
                        {isEmptying ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
                        Svuota cestino
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Svuotare il cestino?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tutte le {batches.length} eliminazioni nel cestino diventano definitive e non si potranno più
                          ripristinare.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleEmpty}>Svuota cestino</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </CardHeader>
            {visible.length > 0 && (
              <CardContent className="space-y-3">
                {visible.map((batch) => {
                  const contents = batchContents(batch);
                  const left = daysLeft(batch.deleted_at);
                  const busy = busyId === batch.batch_id;
                  const who = batch.deleted_by ? names[batch.deleted_by] : null;
                  return (
                    <div
                      key={batch.batch_id}
                      data-testid="trash-batch"
                      className="rounded-lg border bg-background p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium break-words">{batchTitle(batch)}</p>
                        <p className="text-xs text-muted-foreground">
                          Eliminato il {format(new Date(batch.deleted_at), "d MMM yyyy 'alle' HH:mm", { locale: it })}
                          {who ? ` da ${who}` : ''}
                        </p>
                        {contents && <p className="text-xs text-muted-foreground">Insieme a: {contents}</p>}
                        <Badge variant={left <= 3 ? 'destructive' : 'secondary'} className="font-normal">
                          {left === 0
                            ? 'Viene cancellato stanotte'
                            : `Ancora ${left} giorn${left === 1 ? 'o' : 'i'}`}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => handleRestore(batch)}>
                          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                          Ripristina
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive" disabled={busy}>
                              <Trash2 className="w-4 h-4 mr-1" />
                              Elimina per sempre
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminare per sempre?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {batchTitle(batch)}
                                {contents ? `, insieme a ${contents},` : ''} non si potrà più ripristinare.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handlePurge(batch)}>Elimina per sempre</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              Cosa non passa dal cestino
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Account utenti</strong> eliminati da Utenti: l'eliminazione porta via anche l'accesso e i file
              ed è definitiva. Quando un account viene eliminato, dal cestino spariscono anche i suoi dati.
            </p>
            <p>
              <strong>File</strong> come allegati dei task e attestati PDF: si ripristinano le righe del database, non i
              file già cancellati dallo storage.
            </p>
            <p>
              <strong>Pulizie della pagina Privacy</strong> e cancellazioni automatiche: sono definitive per legge.
            </p>
            <p>
              <strong>Eliminazioni di insegnanti e alunni</strong>: il cestino raccoglie solo quelle fatte dagli admin.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
