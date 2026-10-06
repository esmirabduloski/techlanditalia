import { useMemo, useState } from 'react';
import {
  AlertTriangle, BellRing, CheckCircle2, Loader2, MessageCircle, MoreHorizontal, Search, Send, Settings2, User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useSiteSetting } from '@/hooks/useSiteSetting';
import { supabase } from '@/integrations/supabase/client';
import type { ScheduledPaymentWithLead, useAllScheduledPayments } from '@/hooks/useCRMPayments';
import {
  CLIENT_RESULT_LABELS, DEFAULT_DUNNING_SETTINGS, getClientChannel, DUNNING_SETTINGS_KEY, daysBetween, formatDate, formatEuro, methodLabel,
  paymentLabel, paymentWhatsAppLink,
  todayIso, type DunningSettings,
} from '@/lib/payments';
import { cn } from '@/lib/utils';
import { PaymentFormDialog, type PaymentFormValues } from './PaymentFormDialog';
import { DunningSettingsDialog } from './DunningSettingsDialog';

type Filter = 'overdue' | 'week' | 'month' | 'all';

interface Props {
  /** Stato condiviso con AdminCRM (che mostra il numero di rate scadute sulla scheda) */
  schedule: ReturnType<typeof useAllScheduledPayments>;
  onOpenLead: (leadId: string) => void;
}


/** Scadenziario: le rate da incassare di tutti i clienti, con solleciti. */
export function CRMPaymentsSchedule({ schedule, onOpenLead }: Props) {
  const { toast } = useToast();
  const { payments, loading, loadError, updatePayment, sendClientReminderNow } = schedule;
  const { value: dunningValue, setValue: setDunning } = useSiteSetting<DunningSettings>(
    DUNNING_SETTINGS_KEY,
    DEFAULT_DUNNING_SETTINGS,
  );
  const dunning = { ...DEFAULT_DUNNING_SETTINGS, ...dunningValue };

  const [filter, setFilter] = useState<Filter>('overdue');
  const [query, setQuery] = useState('');
  const [toMarkPaid, setToMarkPaid] = useState<ScheduledPaymentWithLead | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const today = todayIso();

  const groups = useMemo(() => {
    const overdue: ScheduledPaymentWithLead[] = [];
    const week: ScheduledPaymentWithLead[] = [];
    const month: ScheduledPaymentWithLead[] = [];
    for (const p of payments) {
      if (!p.due_date) continue;
      const days = daysBetween(today, p.due_date);
      if (days < 0) overdue.push(p);
      else if (days <= 7) week.push(p);
      if (days >= 0 && days <= 30) month.push(p);
    }
    return { overdue, week, month, all: payments };
  }, [payments, today]);

  // Ordinate per scadenza (dal database): le scadute più vecchie in alto
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups[filter].filter(p =>
      !q ||
      p.crm_leads?.full_name?.toLowerCase().includes(q) ||
      p.crm_leads?.email.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q),
    );
  }, [groups, filter, query]);

  const sum = (list: ScheduledPaymentWithLead[]) => list.reduce((s, p) => s + p.amount_cents, 0);

  const tiles: { key: Filter; label: string; list: ScheduledPaymentWithLead[]; alert?: boolean }[] = [
    { key: 'overdue', label: 'Scadute', list: groups.overdue, alert: groups.overdue.length > 0 },
    { key: 'week', label: 'Prossimi 7 giorni', list: groups.week },
    { key: 'month', label: 'Prossimi 30 giorni', list: groups.month },
    { key: 'all', label: 'Tutte da incassare', list: groups.all },
  ];

  const handleMarkPaid = async (values: PaymentFormValues) => {
    if (!toMarkPaid) return false;
    const ok = await updatePayment(toMarkPaid.id, { ...values, status: 'paid' });
    if (ok) {
      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from('crm_interactions').insert({
        lead_id: toMarkPaid.lead_id,
        admin_id: user?.id ?? null,
        type: 'note',
        subject: 'Pagamento ricevuto',
        content: `${formatEuro(values.amount_cents)} il ${formatDate(values.paid_at)}${values.method ? ` (${methodLabel(values.method)})` : ''} · ${paymentLabel(toMarkPaid)}`,
      });
      toast({ title: 'Rata segnata come pagata', description: `${toMarkPaid.crm_leads?.full_name ?? ''} · ${formatEuro(values.amount_cents)}` });
    }
    return ok;
  };

  const handleSendPush = async (p: ScheduledPaymentWithLead) => {
    setSendingId(p.id);
    const { ok, result } = await sendClientReminderNow(p.id);
    setSendingId(null);
    toast({
      title: ok ? (result === 'email_sent' ? 'Email inviata al cliente' : 'Notifica push inviata al cliente') : 'Promemoria non inviato',
      description: ok ? undefined : CLIENT_RESULT_LABELS[result ?? ''] ?? result,
      variant: ok ? undefined : 'destructive',
    });
  };

  const whatsappLink = (p: ScheduledPaymentWithLead) =>
    p.crm_leads ? paymentWhatsAppLink(p.crm_leads, p, today) : null;

  if (loadError) {
    return (
      <p className="text-sm text-destructive rounded-lg border border-destructive/30 p-4">
        Impossibile caricare lo scadenziario: {loadError}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            aria-pressed={filter === t.key}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors hover:bg-muted/50',
              filter === t.key && 'ring-2 ring-primary',
              t.alert && 'border-destructive/40 bg-destructive/5',
            )}
          >
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {t.alert && <AlertTriangle className="w-3 h-3 text-destructive" aria-hidden="true" />}
              {t.label} ({t.list.length})
            </p>
            <p className={cn('text-xl font-bold mt-1', t.alert && 'text-destructive')}>{formatEuro(sum(t.list))}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={v => v && setFilter(v as Filter)}
          variant="outline"
          size="sm"
          aria-label="Filtra rate"
        >
          <ToggleGroupItem value="overdue">Scadute</ToggleGroupItem>
          <ToggleGroupItem value="week">7 giorni</ToggleGroupItem>
          <ToggleGroupItem value="month">30 giorni</ToggleGroupItem>
          <ToggleGroupItem value="all">Tutte</ToggleGroupItem>
        </ToggleGroup>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Cerca cliente..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-8 h-9"
            aria-label="Cerca cliente"
          />
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="w-4 h-4 mr-1" />
          Promemoria e solleciti: {dunning.enabled ? 'attivi' : 'spenti'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-lg border border-dashed">
          {payments.length === 0
            ? 'Nessuna rata da incassare. Pianifica le rate dalla scheda di un cliente (sezione Pagamenti).'
            : filter === 'overdue'
              ? 'Nessuna rata scaduta 🎉'
              : 'Nessuna rata in questo periodo.'}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-background">
          {visible.map(p => {
            const days = p.due_date ? daysBetween(today, p.due_date) : 0;
            const wa = whatsappLink(p);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
                <div className="w-36 shrink-0">
                  <div className="font-medium">{formatDate(p.due_date)}</div>
                  {days < 0 ? (
                    <Badge variant="destructive" className="mt-0.5 whitespace-nowrap">Scaduta da {-days} gg</Badge>
                  ) : days === 0 ? (
                    <Badge className="mt-0.5 bg-amber-500 hover:bg-amber-500">Oggi</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">tra {days} gg</span>
                  )}
                </div>

                <div className="flex-1 min-w-[160px]">
                  <button
                    type="button"
                    onClick={() => onOpenLead(p.lead_id)}
                    className="font-medium hover:underline text-left flex items-center gap-1"
                  >
                    {p.crm_leads?.full_name || p.crm_leads?.email || 'Cliente'}
                    {p.crm_leads?.linked_profile_id && (
                      <User className="w-3 h-3 text-green-600" aria-label="Cliente registrato sulla piattaforma" />
                    )}
                  </button>
                  <div className="text-muted-foreground truncate">{paymentLabel(p)}</div>
                  {p.overdue_reminder_count > 0 && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <BellRing className="w-3 h-3" />
                      {p.overdue_reminder_count} {p.overdue_reminder_count === 1 ? 'sollecito' : 'solleciti'}
                      {p.last_overdue_reminder_at && `, ultimo il ${formatDate(p.last_overdue_reminder_at.slice(0, 10), 'dd/MM')}`}
                    </div>
                  )}
                </div>

                <span className="font-semibold whitespace-nowrap">{formatEuro(p.amount_cents)}</span>

                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setToMarkPaid(p)}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Pagata
                  </Button>
                  {wa && (
                    <Button size="icon" variant="ghost" asChild aria-label="Sollecita su WhatsApp" title="Sollecita su WhatsApp">
                      <a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-4 h-4" /></a>
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label="Altre azioni">
                        {sendingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onOpenLead(p.lead_id)}>
                        <User className="w-4 h-4 mr-2" /> Apri scheda cliente
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleSendPush(p)}>
                        <Send className="w-4 h-4 mr-2" /> Invia promemoria al cliente (push o email)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <PaymentFormDialog
        open={!!toMarkPaid}
        onOpenChange={open => !open && setToMarkPaid(null)}
        mode="markPaid"
        payment={toMarkPaid}
        clientChannel={getClientChannel(!!toMarkPaid?.crm_leads?.linked_profile_id, null, toMarkPaid?.crm_leads?.email)}
        onSubmit={handleMarkPaid}
      />

      <DunningSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={dunning}
        onSaved={setDunning}
      />
    </div>
  );
}
