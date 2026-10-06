import { useEffect, useMemo, useState } from 'react';
import { Bell, Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  FREQUENCIES, REMINDER_OFFSETS, formatDate, formatEuro, parseEuroToCents, planInstallments, todayIso,
  type ClientChannel, type InstallmentFrequency,
} from '@/lib/payments';
import { cn } from '@/lib/utils';
import type { PaymentInsert } from '@/hooks/useCRMPayments';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Descrizione proposta, es. il corso di interesse del lead */
  defaultDescription?: string | null;
  /** Canale del promemoria al cliente (push o email) */
  clientChannel: ClientChannel;
  onSubmit: (rows: PaymentInsert[]) => Promise<boolean>;
}

const MAX_INSTALLMENTS = 36;

export function ScheduleInstallmentsDialog({
  open, onOpenChange, defaultDescription, clientChannel, onSubmit,
}: Props) {
  const [count, setCount] = useState('10');
  const [amount, setAmount] = useState('');
  const [firstDue, setFirstDue] = useState(todayIso());
  const [frequency, setFrequency] = useState<InstallmentFrequency>('monthly');
  const [description, setDescription] = useState('');
  const [offset, setOffset] = useState('0');
  const [remindAdmin, setRemindAdmin] = useState(true);
  const [remindClient, setRemindClient] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDescription(defaultDescription ?? '');
    setRemindClient(false);
  }, [open, defaultDescription]);

  const countNum = Math.min(Math.max(parseInt(count, 10) || 0, 0), MAX_INSTALLMENTS);
  const cents = parseEuroToCents(amount);
  const valid = countNum > 0 && !!cents && !!firstDue;

  const plan = useMemo(
    () => (countNum > 0 && firstDue ? planInstallments(countNum, firstDue, frequency, parseInt(offset, 10)) : []),
    [countNum, firstDue, frequency, offset],
  );

  const handleSubmit = async () => {
    if (!valid || !cents) return;
    setSaving(true);
    const planId = crypto.randomUUID();
    const ok = await onSubmit(plan.map(p => ({
      amount_cents: cents,
      status: 'scheduled',
      description: description.trim() || null,
      due_date: p.dueDate,
      reminder_date: p.reminderDate,
      remind_admin: remindAdmin,
      remind_client: remindClient && clientChannel.canNotify,
      plan_id: planId,
      installment_number: p.number,
      installment_total: countNum,
    })));
    setSaving(false);
    if (ok) {
      onOpenChange(false);
      setAmount('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pianifica rate</DialogTitle>
          <DialogDescription>
            Crea in un colpo solo le rate future con lo stesso importo e i promemoria push.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plan-count">Quante rate?</Label>
              <Input
                id="plan-count"
                type="number"
                min={1}
                max={MAX_INSTALLMENTS}
                value={count}
                onChange={e => setCount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-amount">Prezzo per rata (€)</Label>
              <Input
                id="plan-amount"
                inputMode="decimal"
                placeholder="80,00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-first">Prima scadenza</Label>
              <Input id="plan-first" type="date" value={firstDue} onChange={e => setFirstDue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Frequenza</Label>
              <Select value={frequency} onValueChange={v => setFrequency(v as InstallmentFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-desc">Descrizione</Label>
            <Input
              id="plan-desc"
              placeholder="Es. Corso Python Base"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="space-y-1.5">
              <Label>Quando far scattare la notifica</Label>
              <Select value={offset} onValueChange={setOffset}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REMINDER_OFFSETS.map(o => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Le notifiche partono la mattina del giorno scelto.</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="plan-remind-admin" className="font-normal flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> Notifica a me per chiedere il pagamento
              </Label>
              <Switch id="plan-remind-admin" checked={remindAdmin} onCheckedChange={setRemindAdmin} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="plan-remind-client" className="font-normal">
                <span className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary" /> Promemoria al cliente con l'importo della rata
                </span>
                <span className={cn('block text-xs mt-0.5', clientChannel.warn ? 'text-amber-600' : 'text-muted-foreground')}>
                  {clientChannel.hint}
                </span>
              </Label>
              <Switch
                id="plan-remind-client"
                checked={remindClient && clientChannel.canNotify}
                onCheckedChange={setRemindClient}
                disabled={!clientChannel.canNotify}
              />
            </div>
          </div>

          {plan.length > 0 && (
            <div className="rounded-lg border">
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40 text-sm">
                <span className="font-medium">Anteprima</span>
                <span>
                  Totale <strong>{cents ? formatEuro(cents * countNum) : '—'}</strong>
                </span>
              </div>
              <ol className="max-h-48 overflow-y-auto divide-y text-sm">
                {plan.map(p => (
                  <li key={p.number} className="flex items-center gap-3 px-3 py-1.5">
                    <span className="w-14 text-muted-foreground">{p.number}/{countNum}</span>
                    <span className="flex-1">{formatDate(p.dueDate)}</span>
                    {(remindAdmin || remindClient) && (
                      <span className="text-xs text-muted-foreground">🔔 {formatDate(p.reminderDate, 'dd/MM')}</span>
                    )}
                    <span className="w-20 text-right font-medium">{cents ? formatEuro(cents) : '—'}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={!valid || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Crea {countNum > 0 ? countNum : ''} rate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
