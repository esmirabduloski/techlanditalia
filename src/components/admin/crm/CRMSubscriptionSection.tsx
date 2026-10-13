import { useEffect, useState } from 'react';
import { Pause, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import type { CrmLead } from '@/hooks/useCRM';
import type { SubscriptionPausesState } from '@/hooks/useSubscriptionPauses';
import { SubscriptionPauseDialog } from '@/components/admin/SubscriptionPauseDialog';
import { SubscriptionPauseBadge } from '@/components/admin/SubscriptionPauseBadge';
import { PAUSE_REASON_LABELS, isPauseActive, pausePeriodLabel } from '@/lib/subscriptionPause';

type Student = { id: string; full_name: string; parent_id: string | null };

interface Props {
  lead: CrmLead;
  pauses: SubscriptionPausesState;
  /** Mettere in pausa o riprendere aggiunge una voce alla timeline */
  onChanged: () => void;
}

/**
 * Abbonamento degli studenti della famiglia (figli del genitore collegato, o
 * lo studente collegato): pausa e ripresa.
 */
export function CRMSubscriptionSection({ lead, pauses, onChanged }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [editing, setEditing] = useState<Student | null>(null);

  useEffect(() => {
    const profileId = lead.linked_profile_id;
    if (!profileId) {
      setStudents([]);
      return;
    }
    let active = true;
    supabase
      .from('profiles')
      .select('id, full_name, parent_id, role')
      .or(`parent_id.eq.${profileId},id.eq.${profileId}`)
      .eq('role', 'student')
      .order('full_name')
      .then(({ data }) => {
        if (active) setStudents((data ?? []) as Student[]);
      });
    return () => {
      active = false;
    };
  }, [lead.linked_profile_id]);

  if (students.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      <div className="flex items-center gap-2">
        <Label className="text-base font-semibold">Abbonamento</Label>
        <SubscriptionPauseBadge pauses={pauses.activeForProfile(lead.linked_profile_id)} />
      </div>
      <ul className="divide-y rounded-lg border">
        {students.map((s) => {
          const pause = pauses.byStudent.get(s.id) ?? null;
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.full_name}</div>
                <div className="text-xs text-muted-foreground">
                  {!pause
                    ? 'Attivo'
                    : `${isPauseActive(pause) ? 'In pausa' : 'Pausa programmata'} · ${PAUSE_REASON_LABELS[pause.reason]}, ${pausePeriodLabel(pause)}`}
                </div>
              </div>
              <Button size="sm" variant={pause ? 'outline' : 'secondary'} onClick={() => setEditing(s)}>
                {pause ? <Settings2 className="w-4 h-4 mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
                {pause ? 'Gestisci pausa' : 'Metti in pausa'}
              </Button>
            </li>
          );
        })}
      </ul>

      {editing && (
        <SubscriptionPauseDialog
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          student={editing}
          pause={pauses.byStudent.get(editing.id) ?? null}
          onSaved={() => {
            pauses.reload();
            onChanged();
          }}
        />
      )}
    </div>
  );
}
