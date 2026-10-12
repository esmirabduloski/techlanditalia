import { useState } from 'react';
import { CalendarX, Check, Coins, Flame, Loader2, NotebookPen, Phone, User, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { daysOpen, telLink, type CrmTaskWithRefs, type RiskSignalKind } from '@/lib/studentRisk';

const SIGNAL_ICONS: Record<RiskSignalKind, typeof Flame> = {
  consecutive_absences: CalendarX,
  missing_homework: NotebookPen,
  streak_broken: Flame,
  low_balance: Coins,
};

interface Props {
  task: CrmTaskWithRefs;
  onComplete: (task: CrmTaskWithRefs, outcome: string) => Promise<boolean>;
  onDismiss: (task: CrmTaskWithRefs, reason: string) => Promise<boolean>;
  /** Assente nel dettaglio del lead, dove il lead è già aperto */
  onOpenLead?: (leadId: string) => void;
}

/** Un'attività "Chiama la famiglia" con i motivi e le azioni per chiuderla. */
export function CRMTaskItem({ task, onComplete, onDismiss, onOpenLead }: Props) {
  const [closing, setClosing] = useState<'done' | 'dismissed' | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const tel = telLink(task.crm_leads?.phone);
  const family = task.crm_leads?.full_name || task.crm_leads?.email || 'Famiglia';
  const age = daysOpen(task.created_at);

  const submit = async () => {
    if (!closing) return;
    setSaving(true);
    const ok = closing === 'done' ? await onComplete(task, text) : await onDismiss(task, text);
    setSaving(false);
    if (ok) {
      setClosing(null);
      setText('');
    }
  };

  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 text-sm" data-testid="crm-task">
      <div className="flex-1 min-w-[200px] space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{task.student?.full_name ?? task.title}</span>
          <span className="text-xs text-muted-foreground">
            {age === 0 ? 'da oggi' : `aperta da ${age} ${age === 1 ? 'giorno' : 'giorni'}`}
          </span>
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Motivi">
          {task.signals.map(s => {
            const Icon = SIGNAL_ICONS[s.kind] ?? Flame;
            return (
              <li key={s.key || s.label}>
                <Badge variant="outline" className="gap-1 font-normal border-destructive/40 bg-destructive/5">
                  <Icon className="w-3 h-3 text-destructive" aria-hidden="true" />
                  {s.label}
                </Badge>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
          {onOpenLead ? (
            <button
              type="button"
              onClick={() => onOpenLead(task.lead_id)}
              className="hover:underline flex items-center gap-1 text-foreground"
            >
              <User className="w-3 h-3" aria-hidden="true" /> {family}
            </button>
          ) : (
            <span className="flex items-center gap-1"><User className="w-3 h-3" aria-hidden="true" /> {family}</span>
          )}
          {tel ? (
            <a href={tel} className="flex items-center gap-1 text-primary hover:underline">
              <Phone className="w-3 h-3" aria-hidden="true" /> {task.crm_leads?.phone}
            </a>
          ) : (
            <span>Nessun telefono nel CRM</span>
          )}
        </div>
      </div>

      <div className="flex gap-2 shrink-0">
        <Button size="sm" onClick={() => setClosing('done')}>
          <Check className="w-4 h-4 mr-1" /> Fatto
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setClosing('dismissed')}>
          <X className="w-4 h-4 mr-1" /> Ignora
        </Button>
      </div>

      <Dialog open={closing !== null} onOpenChange={o => !o && setClosing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{closing === 'done' ? 'Com\'è andata la chiamata?' : 'Ignora l\'avviso'}</DialogTitle>
            <DialogDescription>
              {closing === 'done'
                ? `Resta nella timeline di ${family}. Per ${task.student?.full_name ?? 'lo studente'} non arriveranno avvisi per gli stessi motivi nei prossimi giorni.`
                : 'L\'attività viene chiusa senza chiamare. Torna solo se compaiono motivi nuovi.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`task-outcome-${task.id}`}>{closing === 'done' ? 'Esito (facoltativo)' : 'Motivo (facoltativo)'}</Label>
            <Textarea
              id={`task-outcome-${task.id}`}
              rows={3}
              value={text}
              placeholder={closing === 'done' ? 'Es. influenza, rientra la prossima settimana' : 'Es. assenze già concordate con la famiglia'}
              onChange={e => setText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClosing(null)}>Annulla</Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {closing === 'done' ? 'Segna come fatta' : 'Ignora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
