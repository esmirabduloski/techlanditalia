import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Loader2, ShieldAlert, Trash2, ExternalLink } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface ChildRef {
  id: string;
  full_name: string;
  email: string | null;
}

interface DeletionRequest {
  id: string;
  requester_id: string;
  requester_email: string;
  requester_name: string;
  request_type: string;
  reason: string | null;
  children: ChildRef[] | null;
  status: string;
  admin_notes: string | null;
  processed_at: string | null;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  account_and_children: 'Account genitore + figli',
  account_only: 'Solo account genitore',
  data_only: 'Solo dati personali',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'In attesa',
  in_review: 'In lavorazione',
  completed: 'Completata',
  rejected: 'Respinta',
};

const statusVariant = (s: string): 'secondary' | 'default' | 'outline' | 'destructive' =>
  s === 'pending' ? 'secondary' : s === 'in_review' ? 'default' : s === 'completed' ? 'outline' : 'destructive';

export default function AdminDataDeletion() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [selected, setSelected] = useState<DeletionRequest | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate('/admin/login');
  }, [user, isAdmin, authLoading, navigate]);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('data_deletion_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } else {
      setRequests((data || []) as unknown as DeletionRequest[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (user && isAdmin) fetchRequests();
  }, [user, isAdmin]);

  const updateStatus = async (id: string, status: string, adminNotes?: string | null) => {
    const { error } = await supabase
      .from('data_deletion_requests')
      .update({
        status,
        admin_notes: adminNotes ?? null,
        processed_by: user?.id ?? null,
        processed_at: status === 'pending' ? null : new Date().toISOString(),
      })
      .eq('id', id);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Richiesta aggiornata', description: STATUS_LABEL[status] });
    setSelected(null);
    fetchRequests();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('data_deletion_requests').delete().eq('id', id);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
      return;
    }
    setRequests((prev) => prev.filter((r) => r.id !== id));
    toast({ title: 'Richiesta eliminata' });
  };

  const filtered = requests.filter((r) =>
    statusFilter === 'all'
      ? true
      : statusFilter === 'open'
        ? r.status === 'pending' || r.status === 'in_review'
        : r.status === statusFilter,
  );

  if (authLoading || isLoading) {
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
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-destructive" aria-hidden="true" />
              Richieste di Cancellazione Dati
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Le cancellazioni non sono automatiche: elimina gli account manualmente da Utenti, poi segna la richiesta come completata.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Aperte</SelectItem>
                <SelectItem value="pending">In attesa</SelectItem>
                <SelectItem value="in_review">In lavorazione</SelectItem>
                <SelectItem value="completed">Completate</SelectItem>
                <SelectItem value="rejected">Respinte</SelectItem>
                <SelectItem value="all">Tutte</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => navigate('/admin/utenti')}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Utenti
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="tech-card p-8 text-center">
            <ShieldAlert className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Nessuna richiesta</h2>
            <p className="text-muted-foreground">Le richieste inviate dai genitori appariranno qui.</p>
          </div>
        ) : (
          <div className="tech-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Richiedente</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Alunni coinvolti</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelected(r);
                      setNotes(r.admin_notes ?? '');
                    }}
                  >
                    <TableCell className="whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="font-medium">{r.requester_name}</TableCell>
                    <TableCell>{r.requester_email}</TableCell>
                    <TableCell>{TYPE_LABEL[r.request_type] ?? r.request_type}</TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      {(r.children ?? []).map((c) => c.full_name).join(', ') || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminare questa richiesta?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Rimuove solo la richiesta dall'elenco, non gli account.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(r.id)}>Elimina</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Dettaglio richiesta</DialogTitle>
              <DialogDescription>
                {selected?.requester_name} — {selected?.requester_email}
              </DialogDescription>
            </DialogHeader>
            {selected && (
              <div className="space-y-4 text-sm">
                <p><strong>Tipo:</strong> {TYPE_LABEL[selected.request_type] ?? selected.request_type}</p>
                <p><strong>Inviata:</strong> {new Date(selected.created_at).toLocaleString('it-IT')}</p>
                <div>
                  <strong>Alunni coinvolti:</strong>
                  {(selected.children ?? []).length === 0 ? (
                    <span> —</span>
                  ) : (
                    <ul className="list-disc pl-5 mt-1">
                      {(selected.children ?? []).map((c) => (
                        <li key={c.id}>{c.full_name}{c.email ? ` (${c.email})` : ''}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {selected.reason && (
                  <p className="whitespace-pre-wrap"><strong>Motivo:</strong> {selected.reason}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="ddr-admin-notes">Note interne / messaggio al genitore</Label>
                  <Textarea id="ddr-admin-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => updateStatus(selected.id, 'in_review', notes)}>
                    Presa in carico
                  </Button>
                  <Button onClick={() => updateStatus(selected.id, 'completed', notes)}>
                    Segna come completata
                  </Button>
                  <Button variant="destructive" onClick={() => updateStatus(selected.id, 'rejected', notes)}>
                    Respingi
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
