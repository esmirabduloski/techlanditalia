import { useEffect, useMemo, useState } from 'react';
import { addMonths, format, startOfMonth } from 'date-fns';
import { it } from 'date-fns/locale';
import { AlertTriangle, BarChart3, Euro, Loader2, Table as TableIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatEuro, todayIso } from '@/lib/payments';
import { cn } from '@/lib/utils';

type View = 'all' | 'paid' | 'forecast';

interface PaymentRow {
  amount_cents: number;
  status: string;
  paid_at: string | null;
  due_date: string | null;
}

interface MonthBucket {
  key: string;
  label: string;
  paid: number;
  forecast: number;
  overdue: number;
}

interface Props {
  dateFrom?: Date;
  dateTo?: Date;
}

// Palette validata (dataviz validate_palette): incassato = aqua, previsto = blu, scaduto = status "critical"
const SERIES = [
  { key: 'paid', label: 'Incassato', color: 'var(--rev-paid)' },
  { key: 'overdue', label: 'Scaduto non pagato', color: 'var(--rev-overdue)' },
  { key: 'forecast', label: 'Previsto', color: 'var(--rev-forecast)' },
] as const;

const PAST_MONTHS = 11;
const FUTURE_MONTHS = 6;

const monthKey = (iso: string) => iso.slice(0, 7);
const shortEuro = (cents: number) => {
  const euros = cents / 100;
  return euros >= 1000 ? `€${(euros / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k` : `€${euros.toLocaleString('it-IT')}`;
};

/** Andamento delle entrate dai pagamenti CRM: incassato e previsto per mese. */
export function RevenueChart({ dateFrom, dateTo }: Props) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('all');
  const [mode, setMode] = useState<'chart' | 'table'>('chart');

  useEffect(() => {
    let active = true;
    supabase
      .from('crm_payments')
      .select('amount_cents, status, paid_at, due_date')
      .in('status', ['paid', 'scheduled'])
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message);
        else setRows(data ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const today = todayIso();
  const currentMonth = monthKey(today);

  const { months, kpis } = useMemo(() => {
    const start = startOfMonth(dateFrom ?? addMonths(new Date(), -PAST_MONTHS));
    const end = startOfMonth(dateTo ?? addMonths(new Date(), FUTURE_MONTHS));
    const buckets = new Map<string, MonthBucket>();
    for (let d = start; d <= end && buckets.size < 48; d = addMonths(d, 1)) {
      const key = format(d, 'yyyy-MM');
      buckets.set(key, { key, label: format(d, 'MMM yy', { locale: it }), paid: 0, forecast: 0, overdue: 0 });
    }

    const in30Days = format(addMonths(new Date(), 1), 'yyyy-MM-dd');
    const yearAgo = format(addMonths(new Date(), -12), 'yyyy-MM-dd');
    const kpis = { paidThisMonth: 0, paidLast12: 0, next30: 0, overdue: 0, overdueCount: 0 };

    for (const r of rows) {
      if (r.status === 'paid' && r.paid_at) {
        const b = buckets.get(monthKey(r.paid_at));
        if (b) b.paid += r.amount_cents;
        if (monthKey(r.paid_at) === currentMonth) kpis.paidThisMonth += r.amount_cents;
        if (r.paid_at > yearAgo) kpis.paidLast12 += r.amount_cents;
      } else if (r.status === 'scheduled' && r.due_date) {
        const isOverdue = r.due_date < today;
        const b = buckets.get(monthKey(r.due_date));
        if (b) {
          if (isOverdue) b.overdue += r.amount_cents;
          else b.forecast += r.amount_cents;
        }
        if (isOverdue) {
          kpis.overdue += r.amount_cents;
          kpis.overdueCount++;
        } else if (r.due_date <= in30Days) {
          kpis.next30 += r.amount_cents;
        }
      }
    }
    return { months: Array.from(buckets.values()), kpis };
  }, [rows, dateFrom, dateTo, today, currentMonth]);

  const visibleSeries = SERIES.filter(s =>
    view === 'all' || (view === 'paid' ? s.key === 'paid' : s.key !== 'paid'),
  );
  const currentLabel = months.find(m => m.key === currentMonth)?.label;
  const isEmpty = !loading && !error && rows.length === 0;

  const tiles = [
    { label: 'Incassato questo mese', value: formatEuro(kpis.paidThisMonth) },
    { label: 'Incassato ultimi 12 mesi', value: formatEuro(kpis.paidLast12) },
    { label: 'Previsto prossimi 30 giorni', value: formatEuro(kpis.next30) },
    {
      label: `Scaduto da incassare${kpis.overdueCount ? ` (${kpis.overdueCount})` : ''}`,
      value: formatEuro(kpis.overdue),
      alert: kpis.overdueCount > 0,
    },
  ];

  return (
    <Card
      className={cn(
        'mt-6',
        '[--rev-paid:#1baf7a] [--rev-forecast:#2a78d6] [--rev-overdue:#d03b3b]',
        'dark:[--rev-paid:#199e70] dark:[--rev-forecast:#3987e5] dark:[--rev-overdue:#d03b3b]',
      )}
    >
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Euro className="w-5 h-5" />
          Andamento Entrate
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={v => v && setView(v as View)}
            variant="outline"
            size="sm"
            aria-label="Cosa mostrare"
          >
            <ToggleGroupItem value="all">Tutto</ToggleGroupItem>
            <ToggleGroupItem value="paid">Incassato</ToggleGroupItem>
            <ToggleGroupItem value="forecast">Previsto</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={v => v && setMode(v as 'chart' | 'table')}
            variant="outline"
            size="sm"
            aria-label="Grafico o tabella"
          >
            <ToggleGroupItem value="chart" aria-label="Grafico"><BarChart3 className="w-4 h-4" /></ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Tabella"><TableIcon className="w-4 h-4" /></ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tiles.map(t => (
            <div key={t.label} className={cn('rounded-lg border p-3', t.alert && 'border-destructive/40 bg-destructive/5')}>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {t.alert && <AlertTriangle className="w-3 h-3 text-destructive" aria-hidden="true" />}
                {t.label}
              </p>
              <p className="text-xl font-bold mt-1">{t.value}</p>
            </div>
          ))}
        </div>

        {/* Legenda: l'identità delle serie non è affidata solo al colore */}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Legenda">
          {visibleSeries.map(s => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
              {s.key === 'overdue' && <AlertTriangle className="w-3 h-3" aria-hidden="true" />}
              {s.label}
            </li>
          ))}
        </ul>

        {loading ? (
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">Impossibile caricare i pagamenti: {error}</p>
        ) : isEmpty ? (
          <p className="h-[200px] flex items-center justify-center text-sm text-muted-foreground text-center">
            Nessun pagamento ancora. Registra pagamenti e rate dalla scheda dei clienti nel CRM.
          </p>
        ) : mode === 'chart' ? (
          <div className="h-[320px]" role="img" aria-label="Grafico a barre delle entrate mensili, incassate e previste">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} className="fill-muted-foreground" tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  tickFormatter={shortEuro}
                  width={56}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const m = payload[0].payload as MonthBucket;
                    const shown = visibleSeries.filter(s => m[s.key] > 0);
                    return (
                      <div className="rounded-lg border bg-background p-2.5 text-sm shadow-md">
                        <p className="font-medium mb-1 capitalize">{label}</p>
                        {shown.length === 0 && <p className="text-muted-foreground">Nessuna entrata</p>}
                        {shown.map(s => (
                          <p key={s.key} className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
                            <span className="text-muted-foreground">{s.label}</span>
                            <span className="ml-auto font-medium">{formatEuro(m[s.key])}</span>
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                {currentLabel && (
                  <ReferenceLine
                    x={currentLabel}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    label={{ value: 'Oggi', position: 'insideTop', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                )}
                {visibleSeries.map(s => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stackId="revenue"
                    fill={s.color}
                    stroke="hsl(var(--card))"
                    strokeWidth={1}
                    maxBarSize={40}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="max-h-[320px] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Mese</th>
                  {visibleSeries.map(s => <th key={s.key} className="text-right font-medium px-3 py-2">{s.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {months.map(m => (
                  <tr key={m.key} className={cn(m.key === currentMonth && 'bg-muted/30 font-medium')}>
                    <td className="px-3 py-1.5 capitalize">{m.label}</td>
                    {visibleSeries.map(s => (
                      <td key={s.key} className="px-3 py-1.5 text-right tabular-nums">
                        {m[s.key] ? formatEuro(m[s.key]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Incassato per data di ricezione; previsto e scaduto per data di scadenza delle rate. Fonte: pagamenti registrati nel CRM.
        </p>
      </CardContent>
    </Card>
  );
}
