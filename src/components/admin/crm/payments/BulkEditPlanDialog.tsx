import { useEffect, useMemo, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  computeBulkUpdate,
  formatDate,
  formatEuro,
  paymentLabel,
  type BulkEditMode,
  type BulkUpdate,
  type CrmPayment,
} from '@/lib/payments';
import { cn } from '@/lib/utils';

type Mode = BulkEditMode;

export type { BulkUpdate };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rate da incassare del cliente */
  scheduled: CrmPayment[];
  onApply: (updates: BulkUpdate[]) => Promise<boolean>;
}

const NO_PLAN = '__single__';
const SIBLING_DISCOUNT_PERCENT = 10;

/**
 * Modifica in blocco delle rate future di un piano: nuovo prezzo, sconto
 * (percentuale o fisso, es. sconto fratelli) o rimozione dello sconto.
 * Lo sconto è sempre calcolato sul prezzo pieno, quindi non si somma a uno precedente.
 */
export function BulkEditPlanDialog({ open, onOpenChange, scheduled, onApply }: Props) {
  const plans = useMemo(() => {
    const map = new Map<string, CrmPayment[]>();
    for (const p of scheduled) {
      const key = p.plan_id ?? NO_PLAN;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return Array.from(map.entries()).map(([key, list]) => ({
      key,
      list: list.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '')),
      label: key === NO_PLAN
        ? `Rate singole (${list.length})`
        : `${list[0].description || 'Piano rate'} · ${list.length} ${list.length === 1 ? 'rata' : 'rate'} da pagare`,
    }));
  }, [scheduled]);

  const [planKey, setPlanKey] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [mode, setMode] = useState<Mode>('price');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const plan = plans.find(p => p.key === planKey) ?? plans[0];

  useEffect(() => {
    if (!open) return;
    setPlanKey(plans[0]?.key ?? '');
    setFromDate('');
    setMode('price');
    setValue('');
    setLabel('');
  }, [open, plans]);

  const targets = (plan?.list ?? []).filter(p => !fromDate || (p.due_date ?? '') >= fromDate);

  const compute = (p: CrmPayment) => computeBulkUpdate(p, mode, value, label);

  const updates = targets.map(compute);
  const valid = targets.length > 0 && updates.every(Boolean);
  const totalBefore = targets.reduce((s, p) => s + p.amount_cents, 0);
  const totalAfter = valid ? (updates as BulkUpdate[]).reduce((s, u) => s + u.amount_cents, 0) : totalBefore;

  const applySiblingPreset = () => {
    setMode('percent');
    setValue(String(SIBLING_DISCOUNT_PERCENT));
    setLabel(`Sconto fratelli ${SIBLING_DISCOUNT_PERCENT}%`);
  };

  const handleApply = async () => {
    if (!valid) return;
    setSaving(true);
    const ok = await onApply(updates as BulkUpdate[]);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica piano rate</DialogTitle>
          <DialogDescription>Cambia il prezzo o applica uno sconto a tutte le rate ancora da pagare.</DialogDescription>
        </DialogHeader>

        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna rata da pagare da modificare.</p>
        ) : (
          <div className="space-y-4">
            {plans.length > 1 && (
              <div className="space-y-1.5">
                <Label>Piano</Label>
                <Select value={plan?.key} onValueChange={setPlanKey}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {plans.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Da quale rata</Label>
              <Select value={fromDate || '__all__'} onValueChange={v => setFromDate(v === '__all__' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutte le rate da pagare</SelectItem>
                  {(plan?.list ?? []).slice(1).filter(p => p.due_date).map(p => (
                    <SelectItem key={p.id} value={p.due_date!}>
                      Dal {formatDate(p.due_date)}
                      {p.installment_number && p.installment_total ? ` (rata ${p.installment_number}/${p.installment_total})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Modifica</Label>
                <Button type="button" size="sm" variant="secondary" onClick={applySiblingPreset}>
                  <Users className="w-4 h-4 mr-1" /> Sconto fratelli {SIBLING_DISCOUNT_PERCENT}%
                </Button>
              </div>
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={v => v && setMode(v as Mode)}
                variant="outline"
                size="sm"
                className="justify-start flex-wrap"
              >
                <ToggleGroupItem value="price">Nuovo prezzo</ToggleGroupItem>
                <ToggleGroupItem value="percent">Sconto %</ToggleGroupItem>
                <ToggleGroupItem value="fixed">Sconto €</ToggleGroupItem>
                <ToggleGroupItem value="remove">Togli sconto</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {mode !== 'remove' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bulk-value">
                    {mode === 'price' ? 'Prezzo per rata (€)' : mode === 'percent' ? 'Sconto (%)' : 'Sconto per rata (€)'}
                  </Label>
                  <Input
                    id="bulk-value"
                    inputMode="decimal"
                    placeholder={mode === 'price' ? '75,00' : mode === 'percent' ? '10' : '5,00'}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    autoFocus
                  />
                </div>
                {mode !== 'price' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="bulk-label">Nome dello sconto</Label>
                    <Input
                      id="bulk-label"
                      placeholder="Es. Sconto fratelli"
                      value={label}
                      onChange={e => setLabel(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {targets.length > 0 && (
              <div className="rounded-lg border">
                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40 text-sm">
                  <span className="font-medium">Anteprima ({targets.length} rate)</span>
                  <span>
                    {formatEuro(totalBefore)} → <strong className={cn(totalAfter < totalBefore && 'text-green-600 dark:text-green-400')}>{formatEuro(totalAfter)}</strong>
                  </span>
                </div>
                <ol className="max-h-48 overflow-y-auto divide-y text-sm">
                  {targets.map((p, i) => {
                    const u = updates[i];
                    return (
                      <li key={p.id} className="flex items-center gap-3 px-3 py-1.5">
                        <span className="flex-1 truncate">{formatDate(p.due_date)} · {paymentLabel(p)}</span>
                        <span className="text-muted-foreground line-through">{formatEuro(p.amount_cents)}</span>
                        <span className="w-20 text-right font-medium">{u ? formatEuro(u.amount_cents) : '—'}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleApply} disabled={!valid || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Applica a {targets.length} {targets.length === 1 ? 'rata' : 'rate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
