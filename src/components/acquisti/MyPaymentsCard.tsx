import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { daysBetween, formatDate, formatEuro, methodLabel, paymentLabel, todayIso } from '@/lib/payments';
import { cn } from '@/lib/utils';

interface MyPayment {
  id: string;
  amount_cents: number;
  list_amount_cents: number | null;
  discount_label: string | null;
  status: string;
  description: string | null;
  due_date: string | null;
  paid_at: string | null;
  method: string | null;
  installment_number: number | null;
  installment_total: number | null;
}

const HISTORY_PREVIEW = 3;

/**
 * Area riservata › Acquisti: rate pagate e da pagare del genitore.
 * Non mostra nulla se il cliente non ha pagamenti registrati nel CRM.
 */
export function MyPaymentsCard() {
  const [payments, setPayments] = useState<MyPayment[] | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => {
    let active = true;
    (supabase.rpc as any)('get_my_crm_payments').then(({ data, error }) => {
      // In caso di errore la sezione resta nascosta: non deve bloccare la pagina acquisti
      if (active) setPayments(error ? [] : ((data ?? []) as MyPayment[]));
    });
    return () => {
      active = false;
    };
  }, []);

  const today = todayIso();
  const { upcoming, history, paidTotal, dueTotal, overdueCount } = useMemo(() => {
    const list = payments ?? [];
    const upcoming = list
      .filter(p => p.status === 'scheduled')
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
    const history = list
      .filter(p => p.status === 'paid')
      .sort((a, b) => (b.paid_at ?? '').localeCompare(a.paid_at ?? ''));
    return {
      upcoming,
      history,
      paidTotal: history.reduce((s, p) => s + p.amount_cents, 0),
      dueTotal: upcoming.reduce((s, p) => s + p.amount_cents, 0),
      overdueCount: upcoming.filter(p => p.due_date && p.due_date < today).length,
    };
  }, [payments, today]);

  if (!payments || payments.length === 0) return null;

  const next = upcoming[0];
  const visibleHistory = showAllHistory ? history : history.slice(0, HISTORY_PREVIEW);

  return (
    <Card className="mb-8">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Wallet className="w-5 h-5 text-primary" />
          I tuoi pagamenti
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Già pagato</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatEuro(paidTotal)}</p>
          </div>
          <div className={cn('rounded-lg border p-3', overdueCount > 0 && 'border-destructive/40 bg-destructive/5')}>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {overdueCount > 0 && <AlertTriangle className="w-3 h-3 text-destructive" aria-hidden="true" />}
              Da pagare
            </p>
            <p className="text-xl font-bold">{formatEuro(dueTotal)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Prossima scadenza</p>
            <p className="text-xl font-bold">
              {next ? formatDate(next.due_date) : '—'}
            </p>
            {next && <p className="text-xs text-muted-foreground">{formatEuro(next.amount_cents)}</p>}
          </div>
        </div>

        {upcoming.length > 0 && (
          <section aria-labelledby="my-upcoming">
            <h3 id="my-upcoming" className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4" /> Da pagare
            </h3>
            <ul className="divide-y rounded-lg border">
              {upcoming.map(p => {
                const days = p.due_date ? daysBetween(today, p.due_date) : null;
                return (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex flex-wrap items-center gap-2">
                        {formatDate(p.due_date)}
                        {days !== null && days < 0 && <Badge variant="destructive">Scaduta</Badge>}
                        {days === 0 && <Badge className="bg-amber-500 hover:bg-amber-500">Oggi</Badge>}
                      </div>
                      <div className="text-muted-foreground truncate">{paymentLabel(p)}</div>
                    </div>
                    <Amount payment={p} />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {history.length > 0 && (
          <section aria-labelledby="my-history">
            <h3 id="my-history" className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" /> Pagamenti ricevuti
            </h3>
            <ul className="divide-y rounded-lg border">
              {visibleHistory.map(p => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      {formatDate(p.paid_at)}
                      {p.method && <span className="font-normal text-muted-foreground"> · {methodLabel(p.method)}</span>}
                    </div>
                    <div className="text-muted-foreground truncate">{paymentLabel(p)}</div>
                  </div>
                  <Amount payment={p} />
                </li>
              ))}
            </ul>
            {history.length > HISTORY_PREVIEW && (
              <Button variant="ghost" size="sm" className="mt-1" onClick={() => setShowAllHistory(v => !v)}>
                <ChevronDown className={cn('w-4 h-4 mr-1 transition-transform', showAllHistory && 'rotate-180')} />
                {showAllHistory ? 'Mostra meno' : `Mostra tutti (${history.length})`}
              </Button>
            )}
          </section>
        )}

        <p className="text-xs text-muted-foreground">
          Per dubbi sui pagamenti scrivici: ti rispondiamo il prima possibile.
        </p>
      </CardContent>
    </Card>
  );
}

function Amount({ payment: p }: { payment: MyPayment }) {
  const discounted = p.list_amount_cents != null && p.list_amount_cents !== p.amount_cents;
  return (
    <div className="text-right whitespace-nowrap">
      <div className="font-semibold">{formatEuro(p.amount_cents)}</div>
      {discounted && (
        <div className="text-xs">
          <span className="text-muted-foreground line-through">{formatEuro(p.list_amount_cents!)}</span>
          {p.discount_label && <span className="block text-green-600 dark:text-green-400">{p.discount_label}</span>}
        </div>
      )}
    </div>
  );
}
