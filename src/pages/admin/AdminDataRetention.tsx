import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, RefreshCw, Trash2, XCircle, CheckCircle2, Clock, Info, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
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
import { toast } from 'sonner';

/**
 * Pulizia dati oltre i termini di conservazione (Privacy Policy §2).
 * La scansione mensile (cron -> edge function data-retention) crea una run
 * "in attesa" e avvisa via push ed email; qui l'admin la rivede e decide.
 * Nulla viene cancellato senza il click su "Accetto e procedi".
 */

type SummaryRow = { id: string; label: string; basis: string; cutoff: string; count: number };
type ResultRow = { id: string; deleted: number; error?: string };
type RetentionRun = {
  id: string;
  created_at: string;
  status: 'pending' | 'executed' | 'rejected';
  trigger: 'scheduled' | 'manual';
  summary: SummaryRow[];
  notified_at: string | null;
  approved_at: string | null;
  executed_at: string | null;
  result: ResultRow[] | null;
  note: string | null;
};

/** Termini dichiarati in Privacy Policy: mostrati per trasparenza (non modificabili da qui). */
const RETENTION_POLICY = [
  { label: 'Richieste di lezione di prova, messaggi di contatto, candidature', term: '24 mesi', why: 'riferimento del Garante per i dati commerciali di chi non è diventato cliente' },
  { label: 'Conversazioni della chat del sito', term: '24 mesi dall\'ultimo messaggio', why: 'gestione della richiesta e miglioramento del servizio' },
  { label: 'Iscrizioni newsletter mai confermate', term: '30 giorni', why: 'senza conferma non esiste un consenso valido' },
  { label: 'Lead CRM non clienti senza attività', term: '24 mesi', why: 'esclusi i lead vinti e quelli collegati a un account' },
  { label: 'Account genitori e studenti, dati contabili', term: 'durata del rapporto + 10 anni', why: 'obblighi fiscali e prescrizione ordinaria — NON toccati da questo job' },
  { label: 'Log di sicurezza, tentativi di accesso, statistiche', term: '24 h / 7 gg / 30 gg / 90 gg', why: 'pulizia notturna automatica già attiva' },
];

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('it-IT');

const STATUS: Record<RetentionRun['status'], { label: string; className: string }> = {
  pending: { label: 'In attesa di approvazione', className: 'bg-destructive text-destructive-foreground' },
  executed: { label: 'Eseguita', className: 'bg-emerald-600 text-white' },
  rejected: { label: 'Rifiutata', className: 'bg-muted text-muted-foreground' },
};

export default function AdminDataRetention() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('run');
  const [runs, setRuns] = useState<RetentionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [working, setWorking] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState('');

  const pending = useMemo(() => runs.find((r) => r.status === 'pending') ?? null, [runs]);
  const history = useMemo(() => runs.filter((r) => r.status !== 'pending'), [runs]);

  const load = useCallback(async () => {
    // Tabella non ancora nei tipi generati da Lovable (vedi migration data_retention_runs)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.from('data_retention_runs' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      toast.error('Impossibile caricare le pulizie dati: ' + error.message);
    } else {
      setRuns((data ?? []) as unknown as RetentionRun[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Alla comparsa di una run pendente, tutte le categorie con record sono preselezionate
  useEffect(() => {
    if (!pending) return;
    setSelected(Object.fromEntries(pending.summary.filter((r) => r.count > 0).map((r) => [r.id, true])));
    setConfirmed(false);
    setNote('');
  }, [pending?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('data-retention', { body });
    if (error || data?.error) throw new Error(data?.error || error?.message || 'Errore');
    return data;
  };

  const scanNow = async () => {
    setScanning(true);
    try {
      const data = await invoke({ action: 'scan', trigger: 'manual' });
      if (data.total === 0) toast.success('Nessun dato oltre i termini: niente da pulire.');
      else toast.success(`Trovati ${data.total} record oltre i termini${data.run?.notified ? ' (notifiche inviate)' : ''}.`);
      await load();
    } catch (e) {
      toast.error('Scansione fallita: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setScanning(false);
    }
  };

  const approve = async () => {
    if (!pending) return;
    const categories = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    setWorking(true);
    try {
      const data = await invoke({ action: 'approve', runId: pending.id, categories, note: note.trim() || undefined });
      toast.success(`Pulizia eseguita: ${data.deletedTotal} record cancellati definitivamente.`);
      await load();
    } catch (e) {
      toast.error('Pulizia non eseguita: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setWorking(false);
    }
  };

  const reject = async () => {
    if (!pending) return;
    setWorking(true);
    try {
      await invoke({ action: 'reject', runId: pending.id, note: note.trim() || undefined });
      toast.success('Run rifiutata: nessun dato cancellato. Riceverai un nuovo promemoria alla prossima scansione.');
      await load();
    } catch (e) {
      toast.error('Operazione fallita: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setWorking(false);
    }
  };

  const selectedTotal = pending
    ? pending.summary.filter((r) => selected[r.id]).reduce((a, r) => a + r.count, 0)
    : 0;
  const pendingTotal = pending ? pending.summary.reduce((a, r) => a + r.count, 0) : 0;

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <AdminNav />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-primary" /> Privacy · pulizia dati
            </h1>
            <p className="text-sm text-muted-foreground">
              Cancellazione dei dati oltre i termini della Privacy Policy. Ogni mese arriva una proposta: nulla viene
              cancellato finché non la approvi tu.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" /> Aggiorna
            </Button>
            <Button size="sm" onClick={scanNow} disabled={scanning}>
              {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Clock className="w-4 h-4 mr-2" />}
              Esegui scansione ora
            </Button>
          </div>
        </div>

        {/* Run in attesa */}
        {pending ? (
          <Card className={`border-destructive/40 ${highlightId === pending.id ? 'ring-2 ring-primary' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-destructive" />
                  Proposta del {fmtDate(pending.created_at)}
                  <Badge className={`text-xs ${STATUS.pending.className}`}>{STATUS.pending.label}</Badge>
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {pending.trigger === 'scheduled' ? 'Scansione mensile automatica' : 'Scansione manuale'} · notifiche inviate:{' '}
                  {fmtDate(pending.notified_at)}
                </span>
              </div>
              <CardDescription>
                {pendingTotal} record hanno superato i termini di conservazione. Scegli cosa cancellare: la cancellazione è
                definitiva e non recuperabile.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="divide-y rounded-lg border">
                {pending.summary.map((row) => (
                  <label
                    key={row.id}
                    className={`flex items-start gap-3 p-3 text-sm ${row.count === 0 ? 'opacity-50' : 'cursor-pointer hover:bg-muted/40'}`}
                  >
                    <Checkbox
                      checked={!!selected[row.id]}
                      disabled={row.count === 0}
                      onCheckedChange={(v) => setSelected((s) => ({ ...s, [row.id]: v === true }))}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{row.label}</span>
                        <span className="font-mono text-base font-semibold">{row.count}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {row.basis} · record precedenti al {fmtDay(row.cutoff)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Nota facoltativa (es. motivo del rifiuto o annotazione per il registro dei trattamenti)"
              />

              <label className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm cursor-pointer">
                <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
                <span>
                  Ho verificato le categorie selezionate e <strong>accetto la cancellazione definitiva</strong> di{' '}
                  <strong>{selectedTotal}</strong> record. Sono consapevole che l&apos;operazione non è reversibile.
                </span>
              </label>

              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" onClick={reject} disabled={working}>
                  <XCircle className="w-4 h-4 mr-2" /> Rifiuta (non cancellare nulla)
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={working || !confirmed || selectedTotal === 0}>
                      {working ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      Accetto e procedi
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancellare definitivamente {selectedTotal} record?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Verranno eliminati dal database i dati delle categorie selezionate. Non esiste un cestino: se ti
                        serve una copia, esportala prima di confermare.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction onClick={approve} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Sì, cancella ora
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              {loading ? 'Caricamento…' : 'Nessuna pulizia in attesa. La prossima scansione automatica è il giorno 1 del mese alle 06:00.'}
            </CardContent>
          </Card>
        )}

        {/* Termini dichiarati */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" /> Termini di conservazione dichiarati
            </CardTitle>
            <CardDescription>
              Quelli scritti nella Privacy Policy. Se li cambi lì, vanno cambiati anche nella funzione{' '}
              <code className="text-xs">data-retention</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Dati</th>
                  <th className="py-2 pr-3 font-medium">Termine</th>
                  <th className="py-2 font-medium">Motivazione</th>
                </tr>
              </thead>
              <tbody>
                {RETENTION_POLICY.map((r) => (
                  <tr key={r.label} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3">{r.label}</td>
                    <td className="py-2 pr-3 whitespace-nowrap font-medium">{r.term}</td>
                    <td className="py-2 text-muted-foreground">{r.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Storico */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Storico</CardTitle>
            <CardDescription>Le run eseguite o rifiutate restano qui come traccia per il registro dei trattamenti.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.length === 0 && <p className="text-sm text-muted-foreground">Nessuna run precedente.</p>}
            {history.map((r) => {
              const deleted = (r.result ?? []).reduce((a, x) => a + x.deleted, 0);
              return (
                <div key={r.id} className={`rounded-lg border p-3 text-sm ${highlightId === r.id ? 'ring-2 ring-primary' : ''}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{fmtDate(r.created_at)}</span>
                    <Badge className={`text-xs ${STATUS[r.status].className}`}>{STATUS[r.status].label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.status === 'executed'
                      ? `${deleted} record cancellati il ${fmtDate(r.executed_at)}`
                      : `Decisione del ${fmtDate(r.approved_at)}`}
                    {r.note ? ` · ${r.note}` : ''}
                  </p>
                  {r.status === 'executed' && r.result && (
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2 text-xs text-muted-foreground">
                      {r.result.map((x) => {
                        const label = r.summary.find((s) => s.id === x.id)?.label ?? x.id;
                        return (
                          <li key={x.id}>
                            {label}: <strong className="text-foreground">{x.deleted}</strong>
                            {x.error ? <span className="text-destructive"> · errore: {x.error}</span> : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
