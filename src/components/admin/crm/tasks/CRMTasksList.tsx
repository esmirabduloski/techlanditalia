import { useState } from 'react';
import { Loader2, RefreshCw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSiteSetting } from '@/hooks/useSiteSetting';
import type { useCRMTasks } from '@/hooks/useCRMTasks';
import { DEFAULT_STUDENT_RISK_RULES, STUDENT_RISK_RULES_KEY, type StudentRiskRules } from '@/lib/studentRisk';
import { CRMTaskItem } from './CRMTaskItem';
import { StudentRiskSettingsDialog } from './StudentRiskSettingsDialog';

interface Props {
  /** Stato condiviso con AdminCRM (che mostra il numero di attività sulla scheda) */
  tasks: ReturnType<typeof useCRMTasks>;
  onOpenLead: (leadId: string) => void;
  /** Dopo "Controlla ora": il controllo può aver creato lead nuovi */
  onChecked?: () => void;
}

/** Scheda "Da chiamare": famiglie da sentire perché lo studente rischia di abbandonare. */
export function CRMTasksList({ tasks, onOpenLead, onChecked }: Props) {
  const { toast } = useToast();
  const { value, setValue } = useSiteSetting<StudentRiskRules>(STUDENT_RISK_RULES_KEY, DEFAULT_STUDENT_RISK_RULES);
  const rules = { ...DEFAULT_STUDENT_RISK_RULES, ...value };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    const r = await tasks.runCheck();
    setChecking(false);
    if (!r) return;
    onChecked?.();
    if (r.disabled) {
      toast({ title: 'Il controllo è spento', description: 'Attivalo dalle soglie.' });
      return;
    }
    const parts = [
      r.created > 0 && `${r.created} ${r.created === 1 ? 'nuova attività' : 'nuove attività'}`,
      r.updated > 0 && `${r.updated} aggiornate`,
      r.cooldown > 0 && `${r.cooldown} già chiamate di recente`,
    ].filter(Boolean);
    toast({
      title: r.students === 0
        ? 'Nessuno studente a rischio'
        : `${r.students} ${r.students === 1 ? 'studente' : 'studenti'} a rischio`,
      description: [
        parts.join(', ') || (r.students > 0 ? 'Nessuna novità' : ''),
        ...r.skipped.map(s => `${s.student}: ${s.reason}`),
      ].filter(Boolean).join('\n'),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground flex-1 min-w-[220px]">
          Ogni mattina il CRM cerca gli studenti con assenze di fila, compiti non consegnati, streak azzerate o saldo
          lezioni basso.
        </p>
        <Button size="sm" variant="outline" onClick={check} disabled={checking}>
          {checking ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Controlla ora
        </Button>
        <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="w-4 h-4 mr-1" />
          Soglie: {rules.enabled ? 'attive' : 'spente'}
        </Button>
      </div>

      {tasks.loadError ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 p-4">
          Impossibile caricare le attività: {tasks.loadError}
        </p>
      ) : tasks.loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : tasks.tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-lg border border-dashed">
          Nessuna famiglia da chiamare.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {tasks.tasks.map(t => (
            <CRMTaskItem
              key={t.id}
              task={t}
              onComplete={tasks.completeTask}
              onDismiss={tasks.dismissTask}
              onOpenLead={onOpenLead}
            />
          ))}
        </ul>
      )}

      <StudentRiskSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} rules={rules} onSaved={setValue} />
    </div>
  );
}
