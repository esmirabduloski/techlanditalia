import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  PAYMENT_METHODS, centsToInput, formatEuro, parseEuroToCents, todayIso, type ClientChannel, type CrmPayment,
} from '@/lib/payments';
import { cn } from '@/lib/utils';

export type PaymentFormMode = 'record' | 'markPaid' | 'edit';

export interface PaymentFormValues {
  amount_cents: number;
  description: string | null;
  paid_at: string | null;
  method: string | null;
  due_date: string | null;
  reminder_date: string | null;
  remind_admin: boolean;
  remind_client: boolean;
  notes: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: PaymentFormMode;
  /** Pagamento esistente (markPaid / edit) */
  payment?: CrmPayment | null;
  /** Canale del promemoria al cliente (push o email) */
  clientChannel: ClientChannel;
  onSubmit: (values: PaymentFormValues) => Promise<boolean>;
}

const TITLES: Record<PaymentFormMode, string> = {
  record: 'Registra pagamento ricevuto',
  markPaid: 'Segna rata come pagata',
  edit: 'Modifica pagamento',
};

export function PaymentFormDialog({ open, onOpenChange, mode, payment, clientChannel, onSubmit }: Props) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paidAt, setPaidAt] = useState(todayIso());
  const [method, setMethod] = useState('bonifico');
  const [dueDate, setDueDate] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [remindAdmin, setRemindAdmin] = useState(true);
  const [remindClient, setRemindClient] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagato = registrazione nuova, "segna come pagata", o modifica di un pagamento già incassato
  const isPaid = mode !== 'edit' || payment?.status === 'paid';

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAmount(payment ? centsToInput(payment.amount_cents) : '');
    setDescription(payment?.description ?? '');
    setPaidAt(payment?.paid_at ?? todayIso());
    setMethod(payment?.method ?? 'bonifico');
    setDueDate(payment?.due_date ?? '');
    setReminderDate(payment?.reminder_date ?? '');
    setRemindAdmin(payment?.remind_admin ?? true);
    setRemindClient(payment?.remind_client ?? false);
    setNotes(payment?.notes ?? '');
  }, [open, payment]);

  const handleSubmit = async () => {
    const cents = parseEuroToCents(amount);
    if (cents === null || cents === 0) {
      setError("Inserisci un importo valido, es. 80 o 80,50");
      return;
    }
    if (isPaid && !paidAt) {
      setError('Inserisci la data di ricezione del pagamento');
      return;
    }
    if (!isPaid && !dueDate) {
      setError('Inserisci la data di scadenza');
      return;
    }
    setSaving(true);
    const ok = await onSubmit({
      amount_cents: cents,
      description: description.trim() || null,
      paid_at: isPaid ? paidAt : null,
      method: isPaid ? method : null,
      due_date: isPaid ? (payment?.due_date ?? null) : dueDate,
      reminder_date: isPaid ? (payment?.reminder_date ?? null) : (reminderDate || dueDate),
      remind_admin: isPaid ? (payment?.remind_admin ?? false) : remindAdmin,
      remind_client: isPaid ? (payment?.remind_client ?? false) : remindClient && clientChannel.canNotify,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TITLES[mode]}</DialogTitle>
          {mode === 'markPaid' && payment && (
            <DialogDescription>
              Importo previsto {formatEuro(payment.amount_cents)}. Puoi correggerlo se il cliente ha pagato una cifra diversa.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Importo (€)</Label>
              <Input
                id="pay-amount"
                inputMode="decimal"
                placeholder="80,00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                autoFocus
              />
            </div>
            {isPaid ? (
              <div className="space-y-1.5">
                <Label htmlFor="pay-date">Data ricezione</Label>
                <Input id="pay-date" type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="pay-due">Scadenza</Label>
                <Input id="pay-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            )}
          </div>

          {isPaid && (
            <div className="space-y-1.5">
              <Label>Metodo di pagamento</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="pay-desc">Descrizione</Label>
            <Input
              id="pay-desc"
              placeholder="Es. Corso Python Base – ottobre"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {!isPaid && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="pay-reminder">Giorno della notifica</Label>
                <Input
                  id="pay-reminder"
                  type="date"
                  value={reminderDate || dueDate}
                  onChange={e => setReminderDate(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="pay-remind-admin" className="font-normal">Notifica a me per chiedere il pagamento</Label>
                <Switch id="pay-remind-admin" checked={remindAdmin} onCheckedChange={setRemindAdmin} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="pay-remind-client" className="font-normal">
                  Promemoria al cliente con l'importo
                  <span className={cn('block text-xs', clientChannel.warn ? 'text-amber-600' : 'text-muted-foreground')}>
                    {clientChannel.hint}
                  </span>
                </Label>
                <Switch
                  id="pay-remind-client"
                  checked={remindClient && clientChannel.canNotify}
                  onCheckedChange={setRemindClient}
                  disabled={!clientChannel.canNotify}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="pay-notes">Note</Label>
            <Textarea id="pay-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
