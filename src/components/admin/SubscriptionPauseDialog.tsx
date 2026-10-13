import { useEffect, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  PAUSE_REASON_LABELS,
  isPauseActive,
  pausePeriodLabel,
  romeTodayIso,
  shortDate,
  type PauseReason,
  type SubscriptionPause,
} from '@/lib/subscriptionPause';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: { id: string; full_name: string; parent_id?: string | null };
  /** Pausa aperta dello studente, se c'è */
  pause: SubscriptionPause | null;
  onSaved: () => void;
}

/** Nota nella timeline del lead della famiglia (genitore, altrimenti studente), se esiste. */
async function logToFamilyLead(
  student: Props['student'],
  adminId: string | null,
  subject: string,
  content: string | null,
) {
  let parentId = student.parent_id;
  if (parentId === undefined) {
    const { data } = await supabase.from('profiles').select('parent_id').eq('id', student.id).maybeSingle();
    parentId = data?.parent_id ?? null;
  }
  for (const pid of [parentId, student.id]) {
    if (!pid) continue;
    const { data: lead } = await supabase
      .from('crm_leads').select('id').eq('linked_profile_id', pid).is('deleted_at', null)
      .order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (lead) {
      await supabase.from('crm_interactions').insert({
        lead_id: lead.id,
        admin_id: adminId,
        type: 'status_change',
        subject,
        content,
        metadata: { student_id: student.id, subscription_pause: true },
      });
      return;
    }
  }
}

/**
 * Mette in pausa l'abbonamento di uno studente (le lezioni non vengono scalate
 * e la famiglia non riceve push) o lo riprende.
 */
export function SubscriptionPauseDialog({ open, onOpenChange, student, pause, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState<PauseReason>('summer');
  const [startsOn, setStartsOn] = useState(romeTodayIso());
  const [endsOn, setEndsOn] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason(pause?.reason ?? 'summer');
    setStartsOn(pause?.starts_on ?? romeTodayIso());
    setEndsOn(pause?.ends_on ?? '');
    setNotes(pause?.notes ?? '');
  }, [open, pause]);

  const datesInvalid = !!endsOn && endsOn <= startsOn;

  const save = async () => {
    if (datesInvalid) return;
    setSaving(true);
    const values = { reason, starts_on: startsOn, ends_on: endsOn || null, notes: notes.trim() || null };
    const { error } = pause
      ? await supabase.from('subscription_pauses').update({
          ...values,
          // Nuova data di ripresa: gli avvisi dei 14 e 7 giorni ripartono
          ...(values.ends_on !== pause.ends_on ? { reminder_14_sent_at: null, reminder_7_sent_at: null } : {}),
        }).eq('id', pause.id)
      : await supabase.from('subscription_pauses').insert({ ...values, student_id: student.id, created_by: user?.id ?? null });
    if (error) {
      setSaving(false);
      toast({ title: 'Pausa non salvata', description: error.message, variant: 'destructive' });
      return;
    }
    const period = pausePeriodLabel(values);
    await logToFamilyLead(
      student,
      user?.id ?? null,
      pause ? `Pausa di ${student.full_name} modificata` : `Abbonamento di ${student.full_name} in pausa`,
      `${PAUSE_REASON_LABELS[reason]}, ${period}${values.notes ? `\n${values.notes}` : ''}`,
    );
    setSaving(false);
    toast({ title: pause ? 'Pausa aggiornata' : `${student.full_name} è in pausa`, description: period });
    onSaved();
    onOpenChange(false);
  };

  const resume = async () => {
    if (!pause) return;
    setSaving(true);
    const { error } = await supabase
      .from('subscription_pauses')
      .update({ ended_at: new Date().toISOString(), ended_by: user?.id ?? null, end_reason: 'manual' })
      .eq('id', pause.id);
    if (error) {
      setSaving(false);
      toast({ title: 'Ripresa non riuscita', description: error.message, variant: 'destructive' });
      return;
    }
    await logToFamilyLead(
      student,
      user?.id ?? null,
      `Pausa terminata: ${student.full_name} riprende le lezioni`,
      `Ripresa manuale il ${shortDate(romeTodayIso())}.`,
    );
    setSaving(false);
    toast({ title: `${student.full_name} riprende le lezioni` });
    onSaved();
    onOpenChange(false);
  };

  const active = pause ? isPauseActive(pause) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {pause ? `Pausa di ${student.full_name}` : `Metti in pausa ${student.full_name}`}
          </DialogTitle>
          <DialogDescription>
            Durante la pausa le lezioni non vengono scalate e la famiglia non riceve notifiche push.
            Se indichi la data di ripresa, la famiglia viene avvisata 14 e 7 giorni prima (push ed email)
            e la pausa si chiude da sola quel giorno.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pause-reason">Motivo</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as PauseReason)}>
              <SelectTrigger id="pause-reason"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PAUSE_REASON_LABELS) as PauseReason[]).map((r) => (
                  <SelectItem key={r} value={r}>{PAUSE_REASON_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pause-start">Dal</Label>
              <Input
                id="pause-start"
                type="date"
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
                disabled={active}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pause-end">Ripresa il</Label>
              <Input id="pause-end" type="date" value={endsOn} min={startsOn} onChange={(e) => setEndsOn(e.target.value)} />
            </div>
          </div>
          {datesInvalid && <p className="text-sm text-destructive">La ripresa deve essere dopo l'inizio della pausa.</p>}
          {!endsOn && (
            <p className="text-xs text-muted-foreground">
              Senza data di ripresa la pausa resta finché non premi "Riprendi ora".
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pause-notes">Note</Label>
            <Textarea
              id="pause-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Es. vacanze in Puglia fino a fine agosto"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {pause && (
            <Button variant="outline" onClick={resume} disabled={saving} className="sm:mr-auto">
              <Play className="w-4 h-4 mr-1" /> Riprendi ora
            </Button>
          )}
          <Button onClick={save} disabled={saving || !startsOn || datesInvalid}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Pause className="w-4 h-4 mr-1" />}
            {pause ? 'Salva' : 'Metti in pausa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
