import { useCallback, useEffect, useState } from 'react';
import { Pause, Settings2, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import type { CrmLead } from '@/hooks/useCRM';
import type { SubscriptionPausesState } from '@/hooks/useSubscriptionPauses';
import { SubscriptionPauseDialog } from '@/components/admin/SubscriptionPauseDialog';
import { SubscriptionPauseBadge } from '@/components/admin/SubscriptionPauseBadge';
import { PAUSE_REASON_LABELS, isPauseActive, pausePeriodLabel, shortDate } from '@/lib/subscriptionPause';
import { WOULD_RETURN_LABELS, reasonText, type SubscriptionCancellation } from '@/lib/subscriptionCancellation';
import { CRMCancellationDialog } from './CRMCancellationDialog';

type Student = { id: string; full_name: string; parent_id: string | null };

interface Props {
  lead: CrmLead;
  pauses: SubscriptionPausesState;
  onUpdate: (id: string, patch: Partial<CrmLead>) => Promise<boolean>;
  /** Pausa, ripresa e disdetta aggiungono una voce alla timeline */
  onChanged: () => void;
}

/**
 * Abbonamento degli studenti della famiglia (figli del genitore collegato, o
 * lo studente collegato): pausa e ripresa, disdetta con il questionario.
 */
export function CRMSubscriptionSection({ lead, pauses, onUpdate, onChanged }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [editing, setEditing] = useState<Student | null>(null);
  const [cancellations, setCancellations] = useState<SubscriptionCancellation[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);

  const loadCancellations = useCallback(async () => {
    const { data } = await supabase
      .from('subscription_cancellations')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false });
    setCancellations((data ?? []) as SubscriptionCancellation[]);
  }, [lead.id]);

  useEffect(() => {
    loadCancellations();
  }, [loadCancellations]);

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

  // Solo per i clienti: chi non si è mai iscritto non ha niente da disdire
  if (students.length === 0 && lead.pipeline_stage !== 'won' && cancellations.length === 0) return null;
  const studentName = (id: string | null) => (id ? students.find((s) => s.id === id)?.full_name ?? 'Studente' : 'Tutta la famiglia');

  return (
    <div className="space-y-2 mb-6">
      <div className="flex items-center gap-2">
        <Label className="text-base font-semibold">Abbonamento</Label>
        <SubscriptionPauseBadge pauses={pauses.activeForProfile(lead.linked_profile_id)} />
      </div>
      {students.length > 0 && <ul className="divide-y rounded-lg border">
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
      </ul>}

      {cancellations.length > 0 && (
        <ul className="space-y-2" aria-label="Disdette registrate">
          {cancellations.map((c) => (
            <li key={c.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-0.5">
              <div className="font-medium">
                Disdetta del {shortDate(c.cancelled_on)} · {studentName(c.student_id)}
              </div>
              <div><span className="text-muted-foreground">Motivo:</span> {reasonText(c)}</div>
              {c.would_have_stayed && (
                <div><span className="text-muted-foreground">Li avrebbe fatti restare:</span> {c.would_have_stayed}</div>
              )}
              <div><span className="text-muted-foreground">Tornerebbero:</span> {WOULD_RETURN_LABELS[c.would_return]}</div>
            </li>
          ))}
        </ul>
      )}

      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}>
        <UserMinus className="w-4 h-4 mr-1" /> Registra disdetta
      </Button>

      <CRMCancellationDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        lead={lead}
        students={students}
        openPauseIds={new Map(pauses.pauses.map((p) => [p.student_id, p.id]))}
        onUpdate={onUpdate}
        onSaved={() => {
          loadCancellations();
          pauses.reload();
          onChanged();
        }}
      />

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
