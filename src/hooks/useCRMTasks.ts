import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { CrmTaskWithRefs } from '@/lib/studentRisk';

export type RiskCheckSummary = {
  students: number;
  created: number;
  updated: number;
  unchanged: number;
  cooldown: number;
  leads_created: number;
  skipped: { student: string; reason: string }[];
  disabled?: boolean;
};

/** Attività aperte del CRM (tutte, o di un solo lead se leadId è indicato). */
export function useCRMTasks(leadId?: string | null) {
  const [tasks, setTasks] = useState<CrmTaskWithRefs[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (leadId === null) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let query = supabase
      .from('crm_tasks')
      .select('*, crm_leads(full_name, email, phone), student:profiles!crm_tasks_student_id_fkey(full_name)')
      .eq('status', 'open')
      .order('due_at', { ascending: true });
    if (leadId) query = query.eq('lead_id', leadId);
    const { data, error } = await query;
    if (error) {
      setLoadError(error.message);
    } else {
      setLoadError(null);
      setTasks((data ?? []) as unknown as CrmTaskWithRefs[]);
    }
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const close = async (task: CrmTaskWithRefs, status: 'done' | 'dismissed', outcome: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('crm_tasks')
      .update({ status, outcome: outcome.trim() || null, completed_at: now, completed_by: user?.id ?? null })
      .eq('id', task.id);
    if (error) {
      toast({ title: 'Errore aggiornamento attività', description: error.message, variant: 'destructive' });
      return false;
    }
    const studentName = task.student?.full_name ?? 'lo studente';
    await supabase.from('crm_interactions').insert({
      lead_id: task.lead_id,
      admin_id: user?.id ?? null,
      type: status === 'done' ? 'call' : 'note',
      subject: status === 'done'
        ? `Chiamata alla famiglia: ${studentName} a rischio abbandono`
        : `Avviso studente a rischio ignorato (${studentName})`,
      content: outcome.trim() || null,
      metadata: { task_id: task.id },
    });
    if (status === 'done') {
      await supabase.from('crm_leads').update({ last_contacted_at: now }).eq('id', task.lead_id);
    }
    setTasks(prev => prev.filter(t => t.id !== task.id));
    return true;
  };

  /** Lancia subito il controllo (stessa funzione del job delle 6:30). */
  const runCheck = async (): Promise<RiskCheckSummary | null> => {
    const { data, error } = await supabase.functions.invoke('student-risk-check', { body: {} });
    if (error || data?.error) {
      toast({ title: 'Controllo non riuscito', description: data?.error ?? error?.message, variant: 'destructive' });
      return null;
    }
    await load();
    return data as RiskCheckSummary;
  };

  return {
    tasks,
    loading,
    loadError,
    reload: load,
    completeTask: (task: CrmTaskWithRefs, outcome: string) => close(task, 'done', outcome),
    dismissTask: (task: CrmTaskWithRefs, reason: string) => close(task, 'dismissed', reason),
    runCheck,
  };
}
