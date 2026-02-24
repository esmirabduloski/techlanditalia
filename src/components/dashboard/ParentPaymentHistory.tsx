import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Loader2, TrendingUp, TrendingDown, History } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface BalanceLogEntry {
  id: string;
  operation_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  notes: string | null;
  created_at: string;
}

interface ParentPaymentHistoryProps {
  childId: string;
  childName: string;
}

const operationLabels: Record<string, string> = {
  lesson_completed: 'Lezione completata',
  manual_add: 'Ricarica manuale',
  manual_subtract: 'Sottrazione manuale',
  purchase: 'Acquisto',
  refund: 'Rimborso',
};

export function ParentPaymentHistory({ childId, childName }: ParentPaymentHistoryProps) {
  const [logs, setLogs] = useState<BalanceLogEntry[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (childId) {
      fetchData();
    }
  }, [childId]);

  const fetchData = async () => {
    setIsLoading(true);
    const [logsRes, profileRes] = await Promise.all([
      supabase
        .from('lesson_balance_log')
        .select('*')
        .eq('student_id', childId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('profiles')
        .select('lesson_balance')
        .eq('id', childId)
        .single(),
    ]);

    if (logsRes.data) setLogs(logsRes.data);
    if (profileRes.data) setBalance(profileRes.data.lesson_balance);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <History className="w-5 h-5 text-primary" />
        Saldo e Storico Lezioni — {childName}
      </h3>

      {/* Balance Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Lezioni Rimanenti</p>
              <p className="text-4xl font-bold text-foreground">{balance ?? 0}</p>
            </div>
            <CreditCard className="w-12 h-12 text-primary/30" />
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Storico Movimenti</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nessun movimento registrato
            </p>
          ) : (
            <div className="overflow-x-auto">
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
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm', { locale: it })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={log.amount > 0 ? 'default' : 'secondary'}
                          className="gap-1"
                        >
                          {log.amount > 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {operationLabels[log.operation_type] || log.operation_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        <span className={log.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {log.amount > 0 ? '+' : ''}{log.amount}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {log.balance_after}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {log.notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
