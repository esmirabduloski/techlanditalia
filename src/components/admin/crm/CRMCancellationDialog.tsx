import { useEffect, useState } from 'react';
import { Loader2, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { CrmLead } from '@/hooks/useCRM';
import {
  CANCELLATION_REASON_LABELS,
  WOULD_RETURN_LABELS,
  reasonText,
  type CancellationReason,
  type WouldReturn,
} from '@/lib/subscriptionCancellation';
import { romeTodayIso } from '@/lib/subscriptionPause';

const FAMILY = 'family';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: CrmLead;
  students: { id: string; full_name: string }[];
  /** Pause aperte per studente: chi disdice non resta in pausa */
  openPauseIds: Map<string, string>;
  onUpdate: (id: string, patch: Partial<CrmLead>) => Promise<boolean>;
  onSaved: () => void;
}

/**
 * Registra la disdetta di una famiglia con il breve questionario: motivo,
 * cosa l'avrebbe fatta restare, se tornerebbe.
 */
export function CRMCancellationDialog({ open, onOpenChange, lead, students, openPauseIds, onUpdate, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [who, setWho] = useState(FAMILY);
  const [reason, setReason] = useState<CancellationReason | ''>('');
  const [reasonOther, setReasonOther] = useState('');
  const [wouldHaveStayed, setWouldHaveStayed] = useState('');
  const [wouldReturn, setWouldReturn] = useState<WouldReturn | ''>('');
  const [markLost, setMarkLost] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWho(students.length === 1 ? students[0].id : FAMILY);
    setReason('');
    setReasonOther('');
    setWouldHaveStayed('');
    setWouldReturn('');
    setMarkLost(true);
  }, [open, students]);

  // Se lascia un solo figlio e gli altri restano, il lead non è perso
  useEffect(() => {
    setMarkLost(who === FAMILY || students.length <= 1);
  }, [who, students.length]);

  const valid = !!reason && !!wouldReturn && (reason !== 'other' || reasonOther.trim().length > 0);

  const save = async () => {
    if (!reason || !wouldReturn) return;
    setSaving(true);
    const row = {
      lead_id: lead.id,
      student_id: who === FAMILY ? null : who,
      reason,
      reason_other: reason === 'other' ? reasonOther.trim() : null,
      would_have_stayed: wouldHaveStayed.trim() || null,
      would_return: wouldReturn,
      cancelled_on: romeTodayIso(),
      created_by: user?.id ?? null,
    };
    const { error } = await supabase.from('subscription_cancellations').insert(row);
    if (error) {
      setSaving(false);
      toast({ title: 'Disdetta non salvata', description: error.message, variant: 'destructive' });
      return;
    }

    const leaving = who === FAMILY ? students : students.filter((s) => s.id === who);
    const name = who === FAMILY ? 'la famiglia' : leaving[0]?.full_name ?? 'lo studente';

    // Chi disdice non è più in pausa
    const pauseIds = leaving.map((s) => openPauseIds.get(s.id)).filter((x): x is string => !!x);
    if (pauseIds.length > 0) {
      await supabase
        .from('subscription_pauses')
        .update({ ended_at: new Date().toISOString(), ended_by: user?.id ?? null, end_reason: 'manual' })
        .in('id', pauseIds);
    }

    await supabase.from('crm_interactions').insert({
      lead_id: lead.id,
      admin_id: user?.id ?? null,
      type: 'note',
      subject: `Disdetta: ${name}`,
      content: [
        `Motivo: ${reasonText(row)}`,
        `Cosa li avrebbe fatti restare: ${row.would_have_stayed ?? '—'}`,
        `Tornerebbero: ${WOULD_RETURN_LABELS[wouldReturn]}`,
      ].join('\n'),
      metadata: { subscription_cancellation: true, student_id: row.student_id },
    });
    if (markLost && lead.pipeline_stage !== 'lost') {
      await onUpdate(lead.id, { pipeline_stage: 'lost' });
    }

    setSaving(false);
    toast({ title: 'Disdetta registrata', description: reasonText(row) });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registra disdetta</DialogTitle>
          <DialogDescription>
            Tre domande da fare alla famiglia: servono a capire cosa correggere. Se è solo un periodo
            difficile (estate, esami, malattia), proponi prima la pausa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {students.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="cancel-who">Chi lascia</Label>
              <Select value={who} onValueChange={setWho}>
                <SelectTrigger id="cancel-who"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={FAMILY}>Tutta la famiglia</SelectItem>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-2">1. Qual è il motivo principale?</legend>
            <RadioGroup
              value={reason}
              onValueChange={(v) => setReason(v as CancellationReason)}
              className="grid sm:grid-cols-2 gap-2"
            >
              {(Object.keys(CANCELLATION_REASON_LABELS) as CancellationReason[]).map((r) => (
                <div key={r} className="flex items-center gap-2">
                  <RadioGroupItem value={r} id={`cancel-reason-${r}`} />
                  <Label htmlFor={`cancel-reason-${r}`} className="font-normal">{CANCELLATION_REASON_LABELS[r]}</Label>
                </div>
              ))}
            </RadioGroup>
            {reason === 'other' && (
              <Input
                aria-label="Altro motivo"
                value={reasonOther}
                onChange={(e) => setReasonOther(e.target.value)}
                placeholder="Quale?"
              />
            )}
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="cancel-stay" className="font-medium">2. Cosa vi avrebbe fatto restare?</Label>
            <Textarea
              id="cancel-stay"
              value={wouldHaveStayed}
              onChange={(e) => setWouldHaveStayed(e.target.value)}
              placeholder="Es. un orario al sabato, un prezzo per due fratelli…"
              rows={2}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-2">3. Tornereste in futuro?</legend>
            <RadioGroup
              value={wouldReturn}
              onValueChange={(v) => setWouldReturn(v as WouldReturn)}
              className="flex gap-4"
            >
              {(Object.keys(WOULD_RETURN_LABELS) as WouldReturn[]).map((r) => (
                <div key={r} className="flex items-center gap-2">
                  <RadioGroupItem value={r} id={`cancel-return-${r}`} />
                  <Label htmlFor={`cancel-return-${r}`} className="font-normal">{WOULD_RETURN_LABELS[r]}</Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>

          <div className="flex items-center gap-2">
            <Checkbox id="cancel-lost" checked={markLost} onCheckedChange={(v) => setMarkLost(v === true)} />
            <Label htmlFor="cancel-lost" className="font-normal">Sposta il lead in "Perso"</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="destructive" onClick={save} disabled={saving || !valid}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <UserMinus className="w-4 h-4 mr-1" />}
            Registra disdetta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
