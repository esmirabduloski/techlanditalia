import { useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Download, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { decodeCsvBytes, parseCsv } from '@/lib/csv';
import {
  rowsToApply, summarize, type ApplyProgress, type ApplyResult, type CsvColumn, type CsvPlan, type RowPlan, type RowStatus,
} from '@/lib/csvImport';

const STATUS: Record<RowStatus, { label: string; one: string; many: string; className: string }> = {
  new: { label: 'Nuova', one: 'nuova', many: 'nuove', className: 'border-emerald-500/50 text-emerald-700 dark:text-emerald-400' },
  update: { label: 'Modificata', one: 'modificata', many: 'modificate', className: 'border-sky-500/50 text-sky-700 dark:text-sky-400' },
  same: { label: 'Invariata', one: 'invariata', many: 'invariate', className: 'text-muted-foreground' },
  error: { label: 'Errore', one: 'con errori', many: 'con errori', className: 'border-destructive/50 text-destructive' },
};

/** Menu "CSV" delle pagine admin: esporta, importa, modello vuoto. */
export function CsvMenu({ onExport, onImport, onTemplate }: {
  onExport: () => Promise<unknown> | unknown;
  onImport: () => void;
  onTemplate: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const exportNow = async () => {
    setBusy(true);
    try {
      await onExport();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Export non riuscito', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    // modal={false}: il dialog di import si apre dal menu senza lasciare la pagina bloccata
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          CSV
          <ChevronDown className="w-4 h-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={exportNow} className="gap-2 cursor-pointer">
          <Download className="w-4 h-4" /> Esporta CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onImport} className="gap-2 cursor-pointer">
          <Upload className="w-4 h-4" /> Importa CSV
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onTemplate} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4" /> Scarica modello
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Step<T> =
  | { kind: 'pick' }
  | { kind: 'reading' }
  | { kind: 'preview'; fileName: string; plan: CsvPlan<T> }
  | { kind: 'applying'; done: number; total: number }
  | { kind: 'done'; results: ApplyResult[]; error?: string };

interface CsvImportDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  columns: readonly CsvColumn[];
  /** Anteprima del file sui dati attuali del database */
  plan: (rows: string[][]) => Promise<CsvPlan<T>> | CsvPlan<T>;
  /** Scrive le righe nuove e modificate */
  apply: (rows: RowPlan<T>[], onProgress: ApplyProgress) => Promise<ApplyResult[]>;
  /** Opzioni mostrate con l'anteprima (es. l'email di benvenuto) */
  options?: ReactNode;
  /**
   * Alla chiusura, se l'import ha scritto qualcosa: la pagina ricarica i dati
   * solo dopo il riepilogo (alcune ricaricano con uno spinner a tutta pagina).
   */
  onImported?: () => void;
}

/**
 * Import CSV in tre passi: scelta del file, anteprima riga per riga
 * (nuova / modificata / invariata / errore) e conferma con il riepilogo.
 */
export function CsvImportDialog<T>({
  open, onOpenChange, title, description, columns, plan, apply, options, onImported,
}: CsvImportDialogProps<T>) {
  const [step, setStep] = useState<Step<T>>({ kind: 'pick' });
  const [readError, setReadError] = useState<string | null>(null);
  const [showSame, setShowSame] = useState(false);
  const [wrote, setWrote] = useState(false);
  const applying = step.kind === 'applying';

  const reset = () => {
    setStep({ kind: 'pick' });
    setReadError(null);
    setShowSame(false);
  };

  const changeOpen = (next: boolean) => {
    if (applying) return; // non si chiude a metà import
    if (!next) {
      reset();
      if (wrote) onImported?.();
      setWrote(false);
    }
    onOpenChange(next);
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setReadError(null);
    setStep({ kind: 'reading' });
    try {
      const rows = parseCsv(decodeCsvBytes(await file.arrayBuffer()));
      setStep({ kind: 'preview', fileName: file.name, plan: await plan(rows) });
    } catch (e) {
      setReadError(e instanceof Error ? e.message : String(e));
      setStep({ kind: 'pick' });
    }
  };

  const confirm = async (p: CsvPlan<T>) => {
    const total = rowsToApply(p.rows).length;
    setStep({ kind: 'applying', done: 0, total });
    try {
      const results = await apply(p.rows, (done, all) => setStep({ kind: 'applying', done, total: all }));
      setStep({ kind: 'done', results });
      if (results.some((r) => r.ok)) setWrote(true);
    } catch (e) {
      setStep({ kind: 'done', results: [], error: e instanceof Error ? e.message : String(e) });
      setWrote(true); // qualcosa può essere già stato scritto
    }
  };

  const required = columns.filter((c) => c.required);
  const optional = columns.filter((c) => !c.required && !c.readOnly);
  const readOnly = columns.filter((c) => c.readOnly);

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {(step.kind === 'pick' || step.kind === 'reading') && (
          <div className="space-y-4">
            <label
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center cursor-pointer hover:bg-muted/50',
                step.kind === 'reading' && 'pointer-events-none opacity-60',
              )}
            >
              {step.kind === 'reading' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6 text-muted-foreground" />}
              <span className="font-medium">{step.kind === 'reading' ? 'Lettura del file…' : 'Scegli il file CSV'}</span>
              <span className="text-xs text-muted-foreground">Separatore ; o , — anche salvato da Excel</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                aria-label="File CSV da importare"
                onChange={(e) => {
                  void readFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            {readError && <p className="text-sm text-destructive">{readError}</p>}
            <div className="text-sm space-y-2">
              <p className="font-medium">Colonne</p>
              <ul className="space-y-1">
                {[...required, ...optional].map((c) => (
                  <li key={c.key}>
                    <span className="font-medium">{c.header}</span>
                    {c.required && <span className="text-muted-foreground"> (obbligatoria)</span>}
                    {c.hint && <span className="text-muted-foreground"> — {c.hint}</span>}
                  </li>
                ))}
              </ul>
              {readOnly.length > 0 && (
                <p className="text-muted-foreground">Ignorate all'import: {readOnly.map((c) => c.header).join(', ')}.</p>
              )}
              <p className="text-muted-foreground">
                Una colonna che manca dal file non cambia quel dato; una cella vuota lo svuota. Nessuna riga viene cancellata.
              </p>
            </div>
          </div>
        )}

        {step.kind === 'preview' && (() => {
          const counts = summarize(step.plan.rows);
          const toApply = counts.new + counts.update;
          const visible = step.plan.rows.filter((r) => showSame || r.status !== 'same');
          const blocked = step.plan.fileErrors.length > 0;
          return (
            <div className="space-y-4 min-w-0">
              <p className="text-sm text-muted-foreground break-all">{step.fileName}</p>
              {blocked ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {step.plan.fileErrors.map((e) => <p key={e}>{e}</p>)}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2" data-testid="csv-import-counts">
                    {(Object.keys(STATUS) as RowStatus[]).filter((s) => counts[s] > 0).map((s) => (
                      <Badge key={s} variant="outline" className={STATUS[s].className}>
                        {counts[s]} {counts[s] === 1 ? STATUS[s].one : STATUS[s].many}
                      </Badge>
                    ))}
                  </div>
                  {step.plan.unknownColumns.length > 0 && (
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Colonne non riconosciute, ignorate: {step.plan.unknownColumns.join(', ')}
                    </p>
                  )}
                  {step.plan.ignoredColumns.length > 0 && (
                    <p className="text-sm text-muted-foreground">Colonne di sola lettura, ignorate: {step.plan.ignoredColumns.join(', ')}</p>
                  )}
                  {counts.same > 0 && (
                    <button type="button" className="text-sm underline text-muted-foreground" onClick={() => setShowSame((v) => !v)}>
                      {showSame ? 'Nascondi le righe invariate' : `Mostra anche le righe invariate (${counts.same})`}
                    </button>
                  )}
                  <ul className="space-y-2 sm:max-h-[40vh] sm:overflow-y-auto sm:pr-1" aria-label="Anteprima dell'import">
                    {visible.map((r) => (
                      <li key={r.line} className="rounded-md border p-3 text-sm" data-status={r.status}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">Riga {r.line}</span>
                          <span className="font-medium break-all">{r.key}</span>
                          <Badge variant="outline" className={STATUS[r.status].className}>{STATUS[r.status].label}</Badge>
                        </div>
                        {r.errors.map((e) => (
                          <p key={e} className="mt-1 flex gap-1.5 text-destructive"><XCircle className="w-4 h-4 shrink-0 mt-0.5" />{e}</p>
                        ))}
                        {r.status !== 'error' && r.changes.map((c) => <p key={c} className="mt-1 break-words">{c}</p>)}
                        {r.warnings.map((w) => (
                          <p key={w} className="mt-1 flex gap-1.5 text-amber-700 dark:text-amber-400"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{w}</p>
                        ))}
                      </li>
                    ))}
                    {visible.length === 0 && <li className="text-sm text-muted-foreground">Nessuna modifica: il file corrisponde ai dati attuali.</li>}
                  </ul>
                  {toApply > 0 && options}
                  {counts.error > 0 && toApply > 0 && (
                    <p className="text-sm text-muted-foreground">Le righe con errori vengono saltate; correggile nel file e reimportalo.</p>
                  )}
                </>
              )}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={reset}>Scegli un altro file</Button>
                <Button onClick={() => confirm(step.plan)} disabled={blocked || toApply === 0}>
                  {toApply === 1 ? 'Importa 1 riga' : `Importa ${toApply} righe`}
                </Button>
              </DialogFooter>
            </div>
          );
        })()}

        {step.kind === 'applying' && (
          <div className="space-y-3 py-4" aria-live="polite">
            <p className="text-sm">Import in corso: {step.done} di {step.total}…</p>
            <Progress value={step.total ? (step.done / step.total) * 100 : 0} />
            <p className="text-xs text-muted-foreground">Non chiudere la finestra fino alla fine.</p>
          </div>
        )}

        {step.kind === 'done' && (() => {
          const okCount = step.results.filter((r) => r.ok).length;
          const failed = step.results.filter((r) => !r.ok);
          return (
            <div className="space-y-3">
              {step.error ? (
                <p className="flex gap-2 text-destructive"><XCircle className="w-5 h-5 shrink-0" />Import interrotto: {step.error}</p>
              ) : (
                <p className="flex gap-2 font-medium" data-testid="csv-import-result">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                  {okCount === 1 ? '1 riga importata' : `${okCount} righe importate`}
                  {failed.length > 0 && `, ${failed.length} non riuscite`}
                </p>
              )}
              {failed.length > 0 && (
                <ul className="space-y-1 max-h-[40vh] overflow-y-auto text-sm">
                  {failed.map((r) => (
                    <li key={r.line} className="rounded-md border border-destructive/40 p-2">
                      <span className="text-xs text-muted-foreground">Riga {r.line}</span>{' '}
                      <span className="font-medium break-all">{r.key}</span>
                      <p className="text-destructive break-words">{r.message}</p>
                    </li>
                  ))}
                </ul>
              )}
              <DialogFooter>
                <Button onClick={() => changeOpen(false)}>Chiudi</Button>
              </DialogFooter>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
