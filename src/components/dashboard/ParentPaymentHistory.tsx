import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useChildBalance, type BalanceLogEntry } from '@/hooks/useChildProgressData';

const INITIAL_COUNT = 5;
/** Sotto questa soglia il genitore viene invitato a ricaricare. */
export const LOW_BALANCE = 2;

interface ParentPaymentHistoryProps {
  childId: string;
  childName: string;
}

const operationLabels: Record<string, string> = {
  lesson_completed: 'Lezione svolta',
  manual_add: 'Ricarica',
  manual_subtract: 'Correzione',
  purchase: 'Acquisto',
  refund: 'Rimborso',
};

/** Lezioni rimaste e movimenti del saldo: elenco sul telefono, tabella da tablet in su. */
export function ParentPaymentHistory({ childId, childName }: ParentPaymentHistoryProps) {
  const { data, isLoading } = useChildBalance(childId);
  const [showAll, setShowAll] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="py-6 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const { balance, logs } = data;
  const visible = showAll ? logs : logs.slice(0, INITIAL_COUNT);

  return (
    <div className="space-y-4">
      <div className={cn(
        'flex items-center justify-between gap-3 rounded-xl border p-4',
        balance <= LOW_BALANCE ? 'border-amber-500/40 bg-amber-500/10' : 'border-primary/20 bg-primary/5',
      )}>
        <div>
          <p className="text-sm text-muted-foreground">Lezioni rimaste a {childName}</p>
          <p className="text-3xl font-bold text-foreground">{balance}</p>
        </div>
        {balance <= LOW_BALANCE ? (
          <Button asChild size="sm" className="min-h-[44px]">
            <Link to="/area-riservata/acquisti">Ricarica</Link>
          </Button>
        ) : (
          <CreditCard className="w-10 h-10 text-primary/30" aria-hidden="true" />
        )}
      </div>

      <h4 className="text-sm font-semibold">Movimenti</h4>
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">Nessun movimento registrato</p>
      ) : (
        <>
          {/* Telefono: elenco */}
          <ul className="sm:hidden divide-y rounded-xl border list-none p-0 m-0">
            {visible.map((log) => (
              <li key={log.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{operationLabels[log.operation_type] || log.operation_type}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'd MMM yyyy, HH:mm', { locale: it })}</p>
                  </div>
                  <Amount log={log} className="text-base" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Saldo dopo: {log.balance_after}</p>
                {log.notes && <p className="text-xs text-muted-foreground mt-1 break-words">{log.notes}</p>}
              </li>
            ))}
          </ul>

          {/* Tablet e desktop: tabella */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantità</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm', { locale: it })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.amount > 0 ? 'default' : 'secondary'} className="gap-1 whitespace-nowrap">
                        {log.amount > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {operationLabels[log.operation_type] || log.operation_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right"><Amount log={log} /></TableCell>
                    <TableCell className="text-right font-mono">{log.balance_after}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[240px]">{log.notes || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {logs.length > INITIAL_COUNT && !showAll && (
            <Button variant="outline" className="w-full gap-2" onClick={() => setShowAll(true)}>
              <ChevronDown className="w-4 h-4" />
              Mostra altri ({logs.length - INITIAL_COUNT})
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function Amount({ log, className }: { log: BalanceLogEntry; className?: string }) {
  return (
    <span className={cn(
      'font-mono font-semibold whitespace-nowrap',
      log.amount > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400',
      className,
    )}>
      {log.amount > 0 ? '+' : ''}{log.amount}
    </span>
  );
}
