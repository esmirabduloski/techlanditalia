import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Loader2, Plus, Send, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CrmLead } from '@/hooks/useCRM';
import {
  DEFAULT_DISCOUNT_CENTS,
  DEFAULT_OFFER_DAYS,
  PROPOSAL_STATUS_LABELS,
  addDaysIso,
  formatEuro,
  parseEuroInput,
  romeToday,
  shortDate,
  type CourseProposal,
  type CourseProposalStatus,
} from '@/lib/courseProposal';

type Student = { id: string; full_name: string };
type Course = { id: string; title: string; emoji: string };
type GroupRef = { id: string; title: string; student_id: string };
type Row = CourseProposal & { group: { title: string; course: { title: string } | null } | null };
type Form = { courseId: string; reason: string; euros: string; expiresOn: string };

interface Props {
  lead: CrmLead;
  /** Invio e ritiro aggiungono una voce alla timeline */
  onChanged: () => void;
}

// Testo segnaposto delle bozze create dall'admin: non può partire così
const PLACEHOLDER_REASON = 'Scrivi qui il motivo della proposta.';

const STATUS_VARIANT: Record<CourseProposalStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'default',
  sent: 'secondary',
  accepted: 'secondary',
  declined: 'destructive',
  withdrawn: 'outline',
};

/**
 * Proposte del corso successivo per gli studenti della famiglia. L'insegnante
 * scrive corso e motivo; qui l'admin sceglie lo sconto per chi continua subito
 * (diverso per ogni famiglia) e la scadenza, poi invia email e push.
 */
export function CRMCourseProposalSection({ lead, onChanged }: Props) {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<GroupRef[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [forms, setForms] = useState<Record<string, Form>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [newFor, setNewFor] = useState<{ groupKey: string } | null>(null);

  const load = useCallback(async () => {
    const profileId = lead.linked_profile_id;
    if (!profileId) {
      setStudents([]);
      setRows([]);
      return;
    }
    const { data: studentRows } = await supabase
      .from('profiles')
      .select('id, full_name')
      .or(`parent_id.eq.${profileId},id.eq.${profileId}`)
      .eq('role', 'student')
      .order('full_name');
    const list = (studentRows ?? []) as Student[];
    setStudents(list);
    if (list.length === 0) {
      setRows([]);
      return;
    }
    const ids = list.map((s) => s.id);
    const [{ data: proposalRows }, { data: groupRows }, { data: courseRows }] = await Promise.all([
      supabase
        .from('course_proposals')
        .select('*, group:student_groups!course_proposals_group_id_fkey(title, course:courses(title))')
        .in('student_id', ids)
        .order('created_at', { ascending: false }),
      supabase.from('group_students').select('student_id, group:student_groups(id, title)').in('student_id', ids),
      supabase.from('courses').select('id, title, emoji').order('title'),
    ]);
    const proposals = (proposalRows ?? []) as unknown as Row[];
    setRows(proposals);
    setGroups(
      ((groupRows ?? []) as unknown as { student_id: string; group: { id: string; title: string } | null }[])
        .filter((g) => g.group)
        .map((g) => ({ id: g.group!.id, title: g.group!.title, student_id: g.student_id })),
    );
    setCourses((courseRows ?? []) as Course[]);
    const today = romeToday();
    const next: Record<string, Form> = {};
    for (const p of proposals) {
      if (p.status !== 'draft') continue;
      next[p.id] = {
        courseId: p.proposed_course_id,
        reason: p.teacher_reason,
        euros: String((p.discount_cents ?? DEFAULT_DISCOUNT_CENTS) / 100).replace('.', ','),
        expiresOn: p.offer_expires_on ?? addDaysIso(today, DEFAULT_OFFER_DAYS),
      };
    }
    setForms(next);
  }, [lead.linked_profile_id]);

  useEffect(() => {
    load();
  }, [load]);

  const setForm = (id: string, patch: Partial<Form>) => setForms((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const studentName = (id: string) => students.find((s) => s.id === id)?.full_name ?? 'Studente';

  const saveDraft = async (p: Row): Promise<boolean> => {
    const f = forms[p.id];
    const cents = parseEuroInput(f.euros);
    if (cents === null) {
      toast({ title: 'Sconto non valido', description: 'Scrivi un importo in euro, es. 50 (0 = nessuno sconto).', variant: 'destructive' });
      return false;
    }
    if (!f.expiresOn || f.expiresOn < romeToday()) {
      toast({ title: 'Scadenza non valida', description: "La scadenza dell'offerta deve essere da oggi in poi.", variant: 'destructive' });
      return false;
    }
    if (!f.courseId || f.reason.trim().length < 10 || f.reason.trim() === PLACEHOLDER_REASON) {
      toast({ title: 'Manca il corso o il motivo', description: 'Il motivo deve avere almeno 10 caratteri.', variant: 'destructive' });
      return false;
    }
    const { error } = await supabase
      .from('course_proposals')
      .update({ proposed_course_id: f.courseId, teacher_reason: f.reason.trim(), discount_cents: cents, offer_expires_on: f.expiresOn })
      .eq('id', p.id);
    if (error) {
      toast({ title: 'Errore nel salvataggio', description: error.message, variant: 'destructive' });
      return false;
    }
    return true;
  };

  const send = async (p: Row) => {
    setBusy(p.id);
    try {
      if (!(await saveDraft(p))) return;
      const { data, error } = await supabase.functions.invoke('course-proposal', { body: { action: 'send', proposal_id: p.id } });
      if (error || data?.error) {
        toast({ title: 'Invio non riuscito', description: data?.error ?? error?.message, variant: 'destructive' });
        return;
      }
      toast({
        title: 'Proposta inviata',
        description: data.email_sent
          ? `Email inviata${data.push_sent ? ` e push su ${data.push_sent} dispositivi` : ''}. La famiglia la trova anche nell'area riservata.`
          : "Email non inviata (manca l'indirizzo?). La famiglia la trova comunque nell'area riservata.",
      });
      await load();
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async (p: Row) => {
    setBusy(p.id);
    const { error } = await supabase.from('course_proposals').update({ status: 'withdrawn' }).eq('id', p.id);
    setBusy(null);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
      return;
    }
    await load();
  };

  const createDraft = async (groupKey: string) => {
    const [studentId, groupId] = groupKey.split('|');
    const group = await supabase.from('student_groups').select('course_id').eq('id', groupId).maybeSingle();
    const nextCourse = courses.find((c) => c.id !== group.data?.course_id);
    if (!nextCourse) return;
    const { error } = await supabase.from('course_proposals').insert({
      student_id: studentId,
      group_id: groupId,
      proposed_course_id: nextCourse.id,
      teacher_reason: PLACEHOLDER_REASON,
      status: 'draft',
    });
    if (error) {
      toast({ title: 'Impossibile creare la proposta', description: error.message, variant: 'destructive' });
      return;
    }
    setNewFor(null);
    await load();
  };

  if (students.length === 0) return null;
  const visible = rows.filter((r) => r.status !== 'withdrawn');

  return (
    <div className="space-y-2 mb-6" data-testid="crm-course-proposals">
      <div className="flex items-center gap-2">
        <GraduationCap className="w-4 h-4" />
        <Label className="text-base font-semibold">Prossimo corso</Label>
        {visible.some((r) => r.status === 'draft') && <Badge>Da inviare</Badge>}
      </div>

      {visible.length === 0 && <p className="text-sm text-muted-foreground">Nessuna proposta. Di solito la scrive l'insegnante verso fine corso.</p>}

      <ul className="space-y-2">
        {visible.map((p) => {
          const course = courses.find((c) => c.id === p.proposed_course_id);
          const f = forms[p.id];
          const status = p.status as CourseProposalStatus;
          return (
            <li key={p.id} className="rounded-lg border p-3 text-sm space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{studentName(p.student_id)}</span>
                <span className="text-muted-foreground">· {p.group?.course?.title ?? p.group?.title} →</span>
                <span className="font-medium">{course ? `${course.emoji} ${course.title}` : '—'}</span>
                <Badge variant={STATUS_VARIANT[status]} className="ml-auto">{PROPOSAL_STATUS_LABELS[status]}</Badge>
              </div>

              {status === 'draft' && f ? (
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1 sm:col-span-1">
                      <Label className="text-xs">Corso proposto</Label>
                      <Select value={f.courseId} onValueChange={(v) => setForm(p.id, { courseId: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.emoji} {c.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`discount-${p.id}`}>Sconto se continua subito (€)</Label>
                      <Input
                        id={`discount-${p.id}`}
                        inputMode="decimal"
                        value={f.euros}
                        onChange={(e) => setForm(p.id, { euros: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor={`expires-${p.id}`}>Offerta valida fino al</Label>
                      <Input
                        id={`expires-${p.id}`}
                        type="date"
                        min={romeToday()}
                        value={f.expiresOn}
                        onChange={(e) => setForm(p.id, { expiresOn: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Motivo dell'insegnante (lo legge la famiglia)</Label>
                    <Textarea rows={3} maxLength={600} value={f.reason} onChange={(e) => setForm(p.id, { reason: e.target.value })} />
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => withdraw(p)} disabled={busy === p.id}>
                      <Undo2 className="w-4 h-4 mr-1" /> Scarta
                    </Button>
                    <Button size="sm" onClick={() => send(p)} disabled={busy === p.id}>
                      {busy === p.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                      Invia alla famiglia
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="italic text-muted-foreground">"{p.teacher_reason}"</div>
                  <div>
                    {p.discount_cents > 0 ? `Sconto ${formatEuro(p.discount_cents)}` : 'Senza sconto'}
                    {p.offer_expires_on && ` · valida fino al ${shortDate(p.offer_expires_on)}`}
                    {p.sent_at && ` · inviata il ${shortDate(p.sent_at.slice(0, 10))}`}
                    {p.sent_at && !p.email_sent_at && ' (email non partita)'}
                  </div>
                  {status === 'accepted' && (
                    <div className="font-medium text-green-700 dark:text-green-400">
                      Confermata{p.responded_at && ` il ${shortDate(p.responded_at.slice(0, 10))}`}
                      {p.discount_applies ? ` · applica lo sconto di ${formatEuro(p.discount_cents)} al prossimo pagamento` : ' · senza sconto (oltre la scadenza)'}
                    </div>
                  )}
                  {status === 'declined' && <div className="font-medium text-destructive">La famiglia vuole parlarne: richiamala.</div>}
                  {p.parent_note && <div><span className="text-muted-foreground">Nota della famiglia:</span> {p.parent_note}</div>}
                  {status === 'sent' && (
                    <Button size="sm" variant="ghost" className="px-0" onClick={() => withdraw(p)} disabled={busy === p.id}>
                      <Undo2 className="w-4 h-4 mr-1" /> Ritira la proposta
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {groups.length > 0 && (newFor ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={newFor.groupKey} onValueChange={(v) => setNewFor({ groupKey: v })}>
            <SelectTrigger className="w-auto min-w-[240px]"><SelectValue placeholder="Studente e gruppo" /></SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={`${g.student_id}|${g.id}`} value={`${g.student_id}|${g.id}`}>
                  {studentName(g.student_id)} · {g.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!newFor.groupKey} onClick={() => createDraft(newFor.groupKey)}>Crea bozza</Button>
          <Button size="sm" variant="ghost" onClick={() => setNewFor(null)}>Annulla</Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setNewFor({ groupKey: '' })}>
          <Plus className="w-4 h-4 mr-1" /> Nuova proposta
        </Button>
      ))}
    </div>
  );
}
