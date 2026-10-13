import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { PROPOSAL_STATUS_LABELS, type CourseProposal, type CourseProposalStatus } from '@/lib/courseProposal';

type Course = { id: string; title: string; emoji: string };
type Draft = { courseId: string; reason: string };

interface Props {
  groupId: string;
  teacherId: string;
  currentCourseId: string;
  students: { student_id: string; full_name: string }[];
  /** Mancano poche lezioni alla fine: il riquadro viene messo in evidenza */
  nearEnd: boolean;
}

const MIN_REASON = 10;

/**
 * A fine corso l'insegnante propone a ogni alunno il corso successivo con il
 * motivo. Le proposte restano bozze: sconto, scadenza e invio alla famiglia li
 * decide l'admin dal CRM (gli admin ricevono una push).
 */
export function CourseProposalsCard({ groupId, teacherId, currentCourseId, students, nearEnd }: Props) {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [proposals, setProposals] = useState<CourseProposal[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ data: courseRows }, { data: proposalRows }] = await Promise.all([
      supabase.from('courses').select('id, title, emoji').eq('is_visible', true).neq('id', currentCourseId).order('title'),
      supabase.from('course_proposals').select('*').eq('group_id', groupId).neq('status', 'withdrawn').order('created_at', { ascending: false }),
    ]);
    const list = (proposalRows ?? []) as CourseProposal[];
    setCourses((courseRows ?? []) as Course[]);
    setProposals(list);
    const next: Record<string, Draft> = {};
    for (const p of list) {
      if (p.status === 'draft' && !next[p.student_id]) next[p.student_id] = { courseId: p.proposed_course_id, reason: p.teacher_reason };
    }
    setDrafts(next);
    setLoading(false);
  }, [groupId, currentCourseId]);

  useEffect(() => {
    load();
  }, [load]);

  const latest = (studentId: string) => proposals.find((p) => p.student_id === studentId);
  const editable = (studentId: string) => {
    const p = latest(studentId);
    return !p || p.status === 'draft';
  };
  const setDraft = (studentId: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] ?? { courseId: '', reason: '' }), ...patch } }));

  const ready = students.filter((s) => {
    const d = drafts[s.student_id];
    return editable(s.student_id) && d?.courseId && d.reason.trim().length >= MIN_REASON;
  });

  const save = async () => {
    setSaving(true);
    try {
      for (const s of ready) {
        const d = drafts[s.student_id];
        const existing = latest(s.student_id);
        const values = { proposed_course_id: d.courseId, teacher_reason: d.reason.trim() };
        const { error } = existing?.status === 'draft'
          ? await supabase.from('course_proposals').update(values).eq('id', existing.id)
          : await supabase.from('course_proposals').insert({
            ...values,
            student_id: s.student_id,
            group_id: groupId,
            created_by: teacherId,
            status: 'draft',
          });
        if (error) throw new Error(`${s.full_name}: ${error.message}`);
      }
      await supabase.functions.invoke('course-proposal', { body: { action: 'submitted', group_id: groupId } });
      toast({
        title: ready.length === 1 ? 'Proposta salvata' : `${ready.length} proposte salvate`,
        description: 'La segreteria sceglie lo sconto e la invia alla famiglia.',
      });
      await load();
    } catch (e) {
      toast({ title: 'Errore nel salvataggio', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (students.length === 0) return null;

  return (
    <Card className={cn('mb-6', nearEnd && 'border-primary ring-1 ring-primary/30')} data-testid="course-proposals-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5" />
          Prossimo corso
          {nearEnd && <Badge>Fine corso vicina</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Per ogni alunno scegli il corso che consigli dopo questo e spiega perché, in due righe che leggerà la famiglia
          (es. "Ha capito bene i cicli e si diverte a creare: è pronto per Python").
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            {students.map((s) => {
              const p = latest(s.student_id);
              const d = drafts[s.student_id] ?? { courseId: '', reason: '' };
              const course = p ? courses.find((c) => c.id === p.proposed_course_id) : undefined;
              return (
                <div key={s.student_id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{s.full_name}</span>
                    {p && <Badge variant={p.status === 'draft' ? 'outline' : 'secondary'}>{PROPOSAL_STATUS_LABELS[p.status as CourseProposalStatus]}</Badge>}
                  </div>
                  {editable(s.student_id) ? (
                    <div className="grid gap-2 md:grid-cols-[220px_1fr]">
                      <div className="space-y-1">
                        <Label className="text-xs">Corso consigliato</Label>
                        <Select value={d.courseId} onValueChange={(v) => setDraft(s.student_id, { courseId: v })}>
                          <SelectTrigger aria-label={`Corso consigliato per ${s.full_name}`}><SelectValue placeholder="Scegli il corso" /></SelectTrigger>
                          <SelectContent>
                            {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.emoji} {c.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Perché lo consigli</Label>
                        <Textarea
                          aria-label={`Motivo per ${s.full_name}`}
                          rows={2}
                          maxLength={600}
                          value={d.reason}
                          onChange={(e) => setDraft(s.student_id, { reason: e.target.value })}
                          placeholder="Cosa ha imparato, cosa gli piace, perché è pronto"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {course ? `${course.emoji} ${course.title}` : 'Corso proposto'} · "{p?.teacher_reason}"
                    </p>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-end gap-3">
              <span className="text-xs text-muted-foreground">
                {ready.length === 0 ? `Scegli il corso e scrivi almeno ${MIN_REASON} caratteri di motivo` : `${ready.length} pronte da salvare`}
              </span>
              <Button onClick={save} disabled={saving || ready.length === 0}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Salva e manda in segreteria
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
