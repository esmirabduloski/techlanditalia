import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Plus, Minus, History, CreditCard, Trash2, Pencil, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface BalanceLogEntry {
  id: string;
  operation_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  performed_by: string | null;
  notes: string | null;
  created_at: string;
  performer_name?: string;
}

interface LessonBalanceManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  currentBalance: number;
  onBalanceUpdated: () => void;
}

export function LessonBalanceManager({
  open,
  onOpenChange,
  studentId,
  studentName,
  currentBalance,
  onBalanceUpdated,
}: LessonBalanceManagerProps) {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState('1');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [log, setLog] = useState<BalanceLogEntry[]>([]);
  const [isLoadingLog, setIsLoadingLog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string>('');

  useEffect(() => {
    if (open && studentId) {
      fetchLog();
    }
  }, [open, studentId]);

  const fetchLog = async () => {
    setIsLoadingLog(true);
    try {
      const { data, error } = await supabase
        .from('lesson_balance_log')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch performer names
      if (data && data.length > 0) {
        const performerIds = [...new Set(data.map(d => d.performed_by).filter(Boolean))] as string[];
        const { data: performers } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', performerIds);

        const performerMap: Record<string, string> = {};
        performers?.forEach(p => { performerMap[p.id] = p.full_name; });

        setLog(data.map(entry => ({
          ...entry,
          performer_name: entry.performed_by ? performerMap[entry.performed_by] || 'Sistema' : 'Sistema'
        })));
      } else {
        setLog([]);
      }
    } catch (error) {
      console.error('Error fetching balance log:', error);
    } finally {
      setIsLoadingLog(false);
    }
  };

  const handleUpdateBalance = async (type: 'add' | 'remove') => {
    const qty = parseInt(amount);
    if (!qty || qty <= 0) {
      toast({ title: 'Errore', description: 'Inserisci una quantità valida', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const newBalance = type === 'add' 
        ? currentBalance + qty 
        : Math.max(currentBalance - qty, 0);

      // Update profile balance
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ lesson_balance: newBalance })
        .eq('id', studentId);

      if (updateError) throw updateError;

      // Log the operation
      const { error: logError } = await supabase
        .from('lesson_balance_log')
        .insert({
          student_id: studentId,
          operation_type: type === 'add' ? 'credit_added' : 'credit_removed',
          amount: type === 'add' ? qty : -qty,
          balance_before: currentBalance,
          balance_after: newBalance,
          performed_by: user?.id,
          notes: notes || (type === 'add' ? 'Credito aggiunto manualmente' : 'Credito rimosso manualmente'),
        });

      if (logError) throw logError;

      toast({
        title: 'Successo',
        description: `Saldo aggiornato: ${currentBalance} → ${newBalance}`,
      });

      setAmount('1');
      setNotes('');
      onBalanceUpdated();
      fetchLog();
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const getOperationLabel = (type: string) => {
    switch (type) {
      case 'lesson_completed': return 'Lezione completata';
      case 'credit_added': return 'Credito aggiunto';
      case 'credit_removed': return 'Credito rimosso';
      default: return type;
    }
  };

  const getOperationColor = (type: string) => {
    switch (type) {
      case 'lesson_completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'credit_added': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'credit_removed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return '';
    }
  };

  const handleDeleteLog = async (entryId: string) => {
    if (!confirm('Eliminare definitivamente questa variazione dallo storico?')) return;
    const { error } = await supabase.from('lesson_balance_log').delete().eq('id', entryId);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Variazione eliminata' });
    fetchLog();
  };

  const startEditDate = (entry: BalanceLogEntry) => {
    setEditingId(entry.id);
    // datetime-local format
    const d = new Date(entry.created_at);
    const pad = (n: number) => String(n).padStart(2, '0');
    setEditingDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  const saveEditDate = async (entryId: string) => {
    if (!editingDate) return;
    const iso = new Date(editingDate).toISOString();
    const { error } = await supabase
      .from('lesson_balance_log')
      .update({ created_at: iso })
      .eq('id', entryId);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Data aggiornata' });
    setEditingId(null);
    fetchLog();
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Saldo Lezioni - {studentName}
          </DialogTitle>
        </DialogHeader>

        {/* Current Balance */}
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">Saldo attuale</p>
          <p className="text-5xl font-bold text-primary">{currentBalance}</p>
          <p className="text-sm text-muted-foreground mt-1">lezioni rimanenti</p>
        </div>

        {/* Add/Remove Controls */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Quantità</Label>
            <Input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Note (opzionale)</Label>
            <Input
              placeholder="Motivo della modifica..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => handleUpdateBalance('add')}
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Aggiungi Lezioni
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleUpdateBalance('remove')}
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Minus className="w-4 h-4 mr-2" />}
            Rimuovi Lezioni
          </Button>
        </div>

        {/* Log History */}
        <div className="mt-4">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <History className="w-4 h-4" />
            Storico Variazioni
          </h3>

          {isLoadingLog ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : log.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nessuna variazione registrata</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {log.map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs ${getOperationColor(entry.operation_type)}`}>
                        {getOperationLabel(entry.operation_type)}
                      </Badge>
                      <span className="font-medium">
                        {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                      </span>
                      <span className="text-muted-foreground">
                        ({entry.balance_before} → {entry.balance_after})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      {editingId === entry.id ? (
                        <>
                          <Input
                            type="datetime-local"
                            value={editingDate}
                            onChange={(e) => setEditingDate(e.target.value)}
                            className="h-7 text-xs w-auto"
                          />
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveEditDate(entry.id)}>
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingId(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span>{format(new Date(entry.created_at), "d MMM yyyy 'alle' HH:mm", { locale: it })}</span>
                          <span>•</span>
                          <span>{entry.performer_name}</span>
                        </>
                      )}
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{entry.notes}</p>
                    )}
                  </div>
                  {isAdmin && editingId !== entry.id && (
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEditDate(entry)} title="Modifica data">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteLog(entry.id)} title="Elimina">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
