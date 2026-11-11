import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FeedbackTemplates } from '@/components/feedback/FeedbackTemplates';
import { useToast } from '@/hooks/use-toast';
import { gradeWithoutSubmission } from '@/lib/gradeWithoutSubmission';
import { Loader2, Save } from 'lucide-react';

interface GroupOption { id: string; title: string; course_id: string }
interface StudentOption { id: string; full_name: string }
interface HomeworkOption { id: string; title: string; points_reward: number; lesson_number: number }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Gruppi di questo insegnante; null = tutti i gruppi (admin). */
  teacherId: string | null;
  /** Gruppo già scelto (pagina Valutazioni aperta da un gruppo). */
  initialGroupId?: string | null;
  onGraded: () => void;
}

const calculatePoints = (maxPoints: number, grade: number) => Math.round((maxPoints * grade) / 100);

export function GradeWithoutSubmissionDialog({ open, onOpenChange, teacherId, initialGroupId, onGraded }: Props) {
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [homework, setHomework] = useState<HomeworkOption[]>([]);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());
  const [groupId, setGroupId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [homeworkId, setHomeworkId] = useState('');
  const [grade, setGrade] = useState(100);
  const [feedback, setFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const group = groups.find(g => g.id === groupId);
  const selectedHomework = homework.find(h => h.id === homeworkId);
  const availableHomework = useMemo(
    () => homework.filter(h => !submittedIds.has(h.id)),
    [homework, submittedIds],
  );

  // Apertura: azzera il modulo e carica i gruppi
  useEffect(() => {
    if (!open) return;
    setStudentId('');
    setHomeworkId('');
    setGrade(100);
    setFeedback('');
    setStudents([]);
    setHomework([]);
    setSubmittedIds(new Set());
    (async () => {
      let query = supabase.from('student_groups').select('id, title, course_id').order('title');
      if (teacherId) query = query.eq('teacher_id', teacherId);
      const { data } = await query;
      const list = (data || []) as GroupOption[];
      setGroups(list);
      setGroupId(initialGroupId && list.some(g => g.id === initialGroupId) ? initialGroupId : '');
    })();
  }, [open, teacherId, initialGroupId]);

  // Gruppo scelto: studenti del gruppo e compiti delle lezioni del corso
  useEffect(() => {
    setStudentId('');
    setHomeworkId('');
    if (!group) {
      setStudents([]);
      setHomework([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      const [{ data: studentsData }, { data: lessonsData }] = await Promise.all([
        supabase.from('group_students').select('student_id, profiles!inner(full_name)').eq('group_id', group.id),
        supabase.from('lessons').select('id, lesson_number').eq('course_id', group.course_id),
      ]);
      const lessonNumber = new Map((lessonsData || []).map(l => [l.id, l.lesson_number]));
      const lessonIds = [...lessonNumber.keys()];
      const { data: hwData } = lessonIds.length
        ? await supabase.from('homework').select('id, title, points_reward, lesson_id').in('lesson_id', lessonIds)
        : { data: [] as { id: string; title: string; points_reward: number; lesson_id: string | null }[] };
      if (cancelled) return;
      setStudents(
        (studentsData || [])
          .map((s) => {
            const profile = s.profiles as { full_name: string | null } | { full_name: string | null }[] | null;
            const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;
            return { id: s.student_id, full_name: name || 'Studente' };
          })
          .sort((a, b) => a.full_name.localeCompare(b.full_name)),
      );
      setHomework(
        (hwData || [])
          .map(h => ({
            id: h.id,
            title: h.title,
            points_reward: h.points_reward,
            lesson_number: (h.lesson_id && lessonNumber.get(h.lesson_id)) || 0,
          }))
          .sort((a, b) => a.lesson_number - b.lesson_number || a.title.localeCompare(b.title)),
      );
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [group]);

  // Studente scelto: i compiti che ha già consegnato si valutano dall'elenco
  useEffect(() => {
    setHomeworkId('');
    if (!studentId) {
      setSubmittedIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('homework_submissions')
        .select('homework_id')
        .eq('student_id', studentId);
      if (!cancelled) setSubmittedIds(new Set((data || []).map(s => s.homework_id)));
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  const handleSave = async () => {
    if (!studentId || !selectedHomework) return;
    setIsSaving(true);
    const errorMessage = await gradeWithoutSubmission({
      homeworkId: selectedHomework.id,
      studentId,
      grade,
      feedback,
    });
    setIsSaving(false);
    if (errorMessage) {
      toast({ title: 'Errore', description: errorMessage, variant: 'destructive' });
      return;
    }
    const studentName = students.find(s => s.id === studentId)?.full_name ?? 'lo studente';
    toast({
      title: '✅ Valutazione salvata',
      description: `Voto ${grade}% — ${calculatePoints(selectedHomework.points_reward, grade)} punti assegnati a ${studentName}`,
    });
    onOpenChange(false);
    onGraded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-xl max-h-[90vh] p-0 sm:p-0 flex flex-col gap-0">
        <DialogHeader className="p-4 sm:p-6 pb-2 border-b shrink-0">
          <DialogTitle>Valuta senza consegna</DialogTitle>
          <DialogDescription>
            Assegna il voto a un compito che lo studente non ha caricato. Lo studente potrà ancora consegnarlo:
            in quel caso tornerà in attesa di valutazione.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
          <div className="space-y-2">
            <Label>Gruppo</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger><SelectValue placeholder="Scegli il gruppo" /></SelectTrigger>
              <SelectContent>
                {groups.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {groups.length === 0 && <p className="text-xs text-muted-foreground">Nessun gruppo disponibile.</p>}
          </div>

          <div className="space-y-2">
            <Label>Studente</Label>
            <Select value={studentId} onValueChange={setStudentId} disabled={!group || isLoading}>
              <SelectTrigger><SelectValue placeholder={isLoading ? 'Caricamento…' : 'Scegli lo studente'} /></SelectTrigger>
              <SelectContent>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Compito</Label>
            <Select value={homeworkId} onValueChange={setHomeworkId} disabled={!studentId}>
              <SelectTrigger><SelectValue placeholder="Scegli il compito" /></SelectTrigger>
              <SelectContent>
                {availableHomework.map(h => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.lesson_number ? `Lezione ${h.lesson_number} · ` : ''}{h.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {studentId && availableHomework.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Lo studente ha già una consegna per tutti i compiti: valutale dall'elenco.
              </p>
            )}
            {studentId && submittedIds.size > 0 && availableHomework.length > 0 && (
              <p className="text-xs text-muted-foreground">
                I compiti già consegnati non compaiono: valutali dall'elenco.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Voto</Label>
              <span className="text-2xl font-bold text-primary">{grade}%</span>
            </div>
            <Slider value={[grade]} onValueChange={(v) => setGrade(v[0])} max={100} min={0} step={5} className="py-4" />
            {selectedHomework && (
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">Punti assegnati</p>
                <p className="text-xl font-bold text-primary">
                  {calculatePoints(selectedHomework.points_reward, grade)} / {selectedHomework.points_reward}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-without-submission">Feedback (opzionale)</Label>
            <FeedbackTemplates
              mode="grading"
              onSelect={(text) => setFeedback(prev => (prev ? prev + '\n' + text : text))}
            />
            <Textarea
              id="feedback-without-submission"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Scrivi un feedback per lo studente..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="p-4 sm:p-6 pt-3 border-t bg-background shrink-0 flex-row flex-wrap justify-end gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annulla
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving || !studentId || !selectedHomework}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salva Valutazione
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
