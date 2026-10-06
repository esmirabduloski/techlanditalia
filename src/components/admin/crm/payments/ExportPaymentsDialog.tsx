import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useToast } from '@/hooks/use-toast';
import { exportPayments, type ExportFormat, type ExportStatus } from '@/lib/paymentsExport';
import { todayIso } from '@/lib/payments';

type Period = 'all' | 'this_year' | 'last_year' | 'this_month' | 'custom';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Esporta solo i pagamenti di questo cliente */
  leadId?: string;
  /** Usato nel nome del file, es. il nome del cliente */
  label?: string;
}

function periodRange(period: Period, from: string, to: string): { from?: string; to?: string } {
  const year = new Date().getFullYear();
  switch (period) {
    case 'this_year': return { from: `${year}-01-01`, to: `${year}-12-31` };
    case 'last_year': return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    case 'this_month': {
      const month = todayIso().slice(0, 7);
      return { from: `${month}-01`, to: `${month}-31` };
    }
    case 'custom': return { from: from || undefined, to: to || undefined };
    default: return {};
  }
}

const slug = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function ExportPaymentsDialog({ open, onOpenChange, leadId, label }: Props) {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>(leadId ? 'all' : 'this_year');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<ExportStatus>('all');
  const [fileFormat, setFileFormat] = useState<ExportFormat>('xlsx');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (open) setPeriod(leadId ? 'all' : 'this_year');
  }, [open, leadId]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const range = periodRange(period, from, to);
      const parts = ['pagamenti', label && slug(label), range.from && range.to ? `${range.from}_${range.to}` : todayIso()]
        .filter(Boolean);
      const count = await exportPayments({ format: fileFormat, status, leadId, ...range, fileName: parts.join('-') });
      toast({
        title: count > 0 ? `Esportati ${count} pagamenti` : 'Nessun pagamento nel periodo scelto',
        description: count > 0 ? (fileFormat === 'xlsx' ? 'File Excel scaricato' : 'File CSV scaricato') : undefined,
      });
      if (count > 0) onOpenChange(false);
    } catch (e) {
      toast({ title: 'Esportazione non riuscita', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Esporta pagamenti{label ? ` · ${label}` : ''}</DialogTitle>
          <DialogDescription>
            Per il commercialista o per i tuoi conti. Gli incassati sono filtrati per data di ricezione, le rate da
            pagare per data di scadenza.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Periodo</Label>
            <Select value={period} onValueChange={v => setPeriod(v as Period)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutto</SelectItem>
                <SelectItem value="this_month">Questo mese</SelectItem>
                <SelectItem value="this_year">Quest'anno</SelectItem>
                <SelectItem value="last_year">Anno scorso</SelectItem>
                <SelectItem value="custom">Date personalizzate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="export-from">Dal</Label>
                <Input id="export-from" type="date" value={from} onChange={e => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="export-to">Al</Label>
                <Input id="export-to" type="date" value={to} onChange={e => setTo(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Cosa esportare</Label>
            <ToggleGroup type="single" value={status} onValueChange={v => v && setStatus(v as ExportStatus)} variant="outline" size="sm" className="justify-start">
              <ToggleGroupItem value="all">Tutti</ToggleGroupItem>
              <ToggleGroupItem value="paid">Incassati</ToggleGroupItem>
              <ToggleGroupItem value="scheduled">Da incassare</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-1.5">
            <Label>Formato</Label>
            <ToggleGroup type="single" value={fileFormat} onValueChange={v => v && setFileFormat(v as ExportFormat)} variant="outline" size="sm" className="justify-start">
              <ToggleGroupItem value="xlsx">Excel (.xlsx)</ToggleGroupItem>
              <ToggleGroupItem value="csv">CSV</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleExport} disabled={exporting || (period === 'custom' && !from && !to)}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Esporta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
