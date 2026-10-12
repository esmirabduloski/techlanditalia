import { Label } from '@/components/ui/label';
import { useCRMTasks } from '@/hooks/useCRMTasks';
import { CRMTaskItem } from './CRMTaskItem';

interface Props {
  leadId: string;
  /** Chiudere un'attività aggiunge una voce alla timeline */
  onChanged: () => void;
}

/** Attività aperte del lead (es. studente a rischio): niente se non ce ne sono. */
export function CRMLeadTasks({ leadId, onChanged }: Props) {
  const { tasks, completeTask, dismissTask } = useCRMTasks(leadId);
  if (tasks.length === 0) return null;

  const done = (fn: typeof completeTask) => async (...args: Parameters<typeof completeTask>) => {
    const ok = await fn(...args);
    if (ok) onChanged();
    return ok;
  };

  return (
    <div className="space-y-2 mb-6">
      <Label className="text-base font-semibold">Da chiamare</Label>
      <ul className="divide-y rounded-lg border border-destructive/30 bg-destructive/5">
        {tasks.map(t => (
          <CRMTaskItem key={t.id} task={t} onComplete={done(completeTask)} onDismiss={done(dismissTask)} />
        ))}
      </ul>
    </div>
  );
}
