import { useMemo, useState } from 'react';
import {
  Bell, BellOff, CalendarClock, CheckCircle2, Loader2, MoreHorizontal, Pencil, Plus, Send, Smartphone, Trash2, Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useCRMPayments, useClientPushStatus } from '@/hooks/useCRMPayments';
import type { CrmInteraction, CrmLead } from '@/hooks/useCRM';
import {
  formatDate, formatEuro, methodLabel, paymentLabel, todayIso, type CrmPayment,
} from '@/lib/payments';
import { cn } from '@/lib/utils';
import { PaymentFormDialog, type PaymentFormMode, type PaymentFormValues } from './PaymentFormDialog';
import { ScheduleInstallmentsDialog } from './ScheduleInstallmentsDialog';

const CLIENT_RESULT_LABELS: Record<string, string> = {
  sent: 'Promemoria inviato al cliente',
  no_account: 'Cliente senza account: promemoria non inviato',
  no_devices: 'Il cliente non ha le notifiche attive',
  failed: 'Invio al cliente non riuscito',
  skipped_old: 'Promemoria al cliente saltato (data troppo vecchia)',
};

interface Props {
  lead: CrmLead;
  /** Dalla scheda: registra nella timeline del lead (così la timeline si aggiorna) */
  addInteraction: (input: Partial<CrmInteraction>) => Promise<boolean>;
}

export function CRMPaymentsSection({ lead, addInteraction }: Props) {
  const { toast } = useToast();
  const {
    payments, loading, loadError, insertPayments, updatePayment, deletePayment, sendClientReminderNow,
  } = useCRMPayments(lead.id);
  const clientHasAccount = !!lead.linked_profile_id;
  const clientHasPushDevices = useClientPushStatus(lead.linked_profile_id);

  const [form, setForm] = useState<{ mode: PaymentFormMode; payment: CrmPayment | null } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CrmPayment | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const today = todayIso();
  const { upcoming, history, totals } = useMemo(() => {
    const upcoming = payments
      .filter(p => p.status === 'scheduled')
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
    const history = payments
      .filter(p => p.status === 'paid')
      .sort((a, b) => (b.paid_at ?? '').localeCompare(a.paid_at ?? ''));
    const overdue = upcoming.filter(p => p.due_date && p.due_date < today);
    return {
      upcoming,
      history,
      totals: {
        paid: history.reduce((s, p) => s + p.amount_cents, 0),
        scheduled: upcoming.reduce((s, p) => s + p.amount_cents, 0),
        overdue: overdue.reduce((s, p) => s + p.amount_cents, 0),
        overdueCount: overdue.length,
      },
    };
  }, [payments, today]);

  const logPaymentReceived = (values: PaymentFormValues) =>
    addInteraction({
      type: 'note',
      subject: 'Pagamento ricevuto',
      content: `${formatEuro(values.amount_cents)} il ${formatDate(values.paid_at)}${values.method ? ` (${methodLabel(values.method)})` : ''}${values.description ? ` · ${values.description}` : ''}`,
    });

  const handleFormSubmit = async (values: PaymentFormValues) => {
    if (!form) return false;

    if (form.mode === 'record') {
      const ok = await insertPayments([{ ...values, status: 'paid', remind_admin: false, remind_client: false }]);
      if (ok) {
        await logPaymentReceived(values);
        toast({ title: 'Pagamento registrato', description: formatEuro(values.amount_cents) });
      }
      return ok;
    }

    const payment = form.payment!;
    if (form.mode === 'markPaid') {
      const ok = await updatePayment(payment.id, { ...values, status: 'paid' });
      if (ok) {
        await logPaymentReceived(values);
        toast({ title: 'Rata segnata come pagata', description: formatEuro(values.amount_cents) });
      }
      return ok;
    }

    // Modifica: se cambia il giorno della notifica, i promemoria ripartono
    const patch: Partial<CrmPayment> = { ...values };
    if (payment.status === 'scheduled' && values.reminder_date !== payment.reminder_date) {
      patch.admin_reminder_sent_at = null;
      patch.client_reminder_sent_at = null;
      patch.client_reminder_result = null;
    }
    const ok = await updatePayment(payment.id, patch);
    if (ok) toast({ title: 'Pagamento aggiornato' });
    return ok;
  };

  const handleMarkUnpaid = async (p: CrmPayment) => {
    if (!p.due_date) {
      toast({ title: 'Questo pagamento non ha una scadenza', description: 'Puoi solo modificarlo o eliminarlo.' });
      return;
    }
    const ok = await updatePayment(p.id, { status: 'scheduled', paid_at: null, method: null });
    if (ok) toast({ title: 'Rata riportata tra quelle da incassare' });
  };

  const handleSendNow = async (p: CrmPayment) => {
    setSendingId(p.id);
    const { ok, result } = await sendClientReminderNow(p.id);
    setSendingId(null);
    toast({
      title: ok ? 'Promemoria inviato al cliente' : 'Promemoria non inviato',
      description: ok ? undefined : CLIENT_RESULT_LABELS[result ?? ''] ?? result,
      variant: ok ? undefined : 'destructive',
    });
  };

  const handleSchedule = async (rows: Parameters<typeof insertPayments>[0]) => {
    const ok = await insertPayments(rows);
    if (ok) {
      toast({ title: `${rows.length} rate pianificate`, description: formatEuro(rows.reduce((s, r) => s + r.amount_cents, 0)) });
    }
    return ok;
  };

  return (
    <section className="space-y-4 mb-6" aria-labelledby="crm-payments-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label id="crm-payments-title" className="text-base font-semibold flex items-center gap-2">
          <Wallet className="w-4 h-4" /> Pagamenti
        </Label>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setScheduleOpen(true)}>
            <CalendarClock className="w-4 h-4 mr-1" /> Pianifica rate
          </Button>
          <Button size="sm" onClick={() => setForm({ mode: 'record', payment: null })}>
            <Plus className="w-4 h-4 mr-1" /> Registra pagamento
          </Button>
        </div>
      </div>

      {loadError ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 p-3">
          Impossibile caricare i pagamenti: {loadError}
        </p>
      ) : (
        <>
          {/* Riepilogo */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border p-2">
              <div className="text-xs text-muted-foreground">Incassato</div>
              <div className="font-semibold text-green-600 dark:text-green-400">{formatEuro(totals.paid)}</div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="text-xs text-muted-foreground">Da incassare</div>
              <div className="font-semibold">{formatEuro(totals.scheduled)}</div>
            </div>
            <div className={cn('rounded-lg border p-2', totals.overdueCount > 0 && 'border-destructive/50 bg-destructive/5')}>
              <div className="text-xs text-muted-foreground">Scaduto</div>
              <div className={cn('font-semibold', totals.overdueCount > 0 && 'text-destructive')}>
                {formatEuro(totals.overdue)}
                {totals.overdueCount > 0 && <span className="text-xs font-normal"> ({totals.overdueCount})</span>}
              </div>
            </div>
          </div>

          {loading && payments.length === 0 && (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          )}

          {/* Rate da incassare */}
          {upcoming.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-sm font-medium text-muted-foreground">Rate in programma</h4>
              <ul className="divide-y rounded-lg border">
                {upcoming.map(p => {
                  const isOverdue = !!p.due_date && p.due_date < today;
                  const isToday = p.due_date === today;
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{formatDate(p.due_date)}</span>
                          {isOverdue && <Badge variant="destructive">Scaduta</Badge>}
                          {isToday && <Badge className="bg-amber-500 hover:bg-amber-500">Oggi</Badge>}
                        </div>
                        <div className="text-muted-foreground truncate">{paymentLabel(p)}</div>
                        <ReminderInfo payment={p} />
                      </div>
                      <span className="font-semibold whitespace-nowrap">{formatEuro(p.amount_cents)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="hidden sm:inline-flex"
                        onClick={() => setForm({ mode: 'markPaid', payment: p })}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Pagata
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" aria-label="Azioni rata">
                            {sendingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setForm({ mode: 'markPaid', payment: p })}>
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Segna come pagata
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setForm({ mode: 'edit', payment: p })}>
                            <Pencil className="w-4 h-4 mr-2" /> Modifica
                          </DropdownMenuItem>
                          {clientHasAccount && (
                            <DropdownMenuItem onSelect={() => handleSendNow(p)}>
                              <Send className="w-4 h-4 mr-2" /> Invia ora promemoria al cliente
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onSelect={() => setToDelete(p)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Elimina rata
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Storico */}
          <div className="space-y-1.5">
            <h4 className="text-sm font-medium text-muted-foreground">Storico pagamenti</h4>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3 rounded-lg border border-dashed">
                Nessun pagamento registrato
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {history.map(p => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600 dark:text-green-400" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {formatDate(p.paid_at)}
                        {p.method && <span className="font-normal text-muted-foreground"> · {methodLabel(p.method)}</span>}
                      </div>
                      <div className="text-muted-foreground truncate">
                        {paymentLabel(p)}
                        {p.due_date && p.paid_at && p.paid_at > p.due_date && (
                          <span className="text-amber-600"> · in ritardo di {daysLate(p.due_date, p.paid_at)} gg</span>
                        )}
                      </div>
                      {p.notes && <div className="text-xs text-muted-foreground truncate">{p.notes}</div>}
                    </div>
                    <span className="font-semibold whitespace-nowrap">{formatEuro(p.amount_cents)}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Azioni pagamento">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setForm({ mode: 'edit', payment: p })}>
                          <Pencil className="w-4 h-4 mr-2" /> Modifica
                        </DropdownMenuItem>
                        {p.due_date && (
                          <DropdownMenuItem onSelect={() => handleMarkUnpaid(p)}>
                            <CalendarClock className="w-4 h-4 mr-2" /> Segna come non pagata
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onSelect={() => setToDelete(p)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <PaymentFormDialog
        open={!!form}
        onOpenChange={open => !open && setForm(null)}
        mode={form?.mode ?? 'record'}
        payment={form?.payment}
        clientHasAccount={clientHasAccount}
        onSubmit={handleFormSubmit}
      />

      <ScheduleInstallmentsDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        defaultDescription={lead.interest}
        clientHasAccount={clientHasAccount}
        clientHasPushDevices={clientHasPushDevices}
        onSubmit={handleSchedule}
      />

      <AlertDialog open={!!toDelete} onOpenChange={open => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && `${paymentLabel(toDelete)} · ${formatEuro(toDelete.amount_cents)}. `}
              L'operazione non si può annullare.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (toDelete) await deletePayment(toDelete.id);
                setToDelete(null);
              }}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function daysLate(dueIso: string, paidIso: string) {
  return Math.round((Date.parse(paidIso) - Date.parse(dueIso)) / 86_400_000);
}

/** Stato dei promemoria di una rata: a me e al cliente. */
function ReminderInfo({ payment: p }: { payment: CrmPayment }) {
  if (!p.remind_admin && !p.remind_client) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <BellOff className="w-3 h-3" /> Nessuna notifica
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      {p.remind_admin && (
        <span className="flex items-center gap-1" title="Notifica a me">
          <Bell className="w-3 h-3" />
          {p.admin_reminder_sent_at ? 'Notificato' : `Notifica il ${formatDate(p.reminder_date, 'dd/MM')}`}
        </span>
      )}
      {p.remind_client && (
        <span
          className={cn('flex items-center gap-1', p.client_reminder_result && p.client_reminder_result !== 'sent' && 'text-amber-600')}
          title={p.client_reminder_result ? CLIENT_RESULT_LABELS[p.client_reminder_result] : 'Notifica al cliente'}
        >
          <Smartphone className="w-3 h-3" />
          {p.client_reminder_sent_at
            ? (p.client_reminder_result === 'sent' ? 'Cliente avvisato' : 'Cliente non avvisato')
            : `Cliente il ${formatDate(p.reminder_date, 'dd/MM')}`}
        </span>
      )}
    </div>
  );
}
