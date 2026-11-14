import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { openStorageFile } from '@/hooks/useSignedUrl';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { SubmissionWorkspace } from '@/components/grading/SubmissionWorkspace';
import { AutoGradingReview, AutoScoreBadge } from '@/components/grading/AutoGradingReview';
import { failedTestsFeedback, parseSubmittedCode, parseTestCases, parseTestResults } from '@/lib/testCases';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  LogOut, Loader2, Award, User, Calendar, Save, Download, Code, GraduationCap, ClipboardCheck
} from 'lucide-react';
import { FeedbackTemplates } from '@/components/feedback/FeedbackTemplates';
import { GradeWithoutSubmissionDialog } from '@/components/grading/GradeWithoutSubmissionDialog';
import { hasDelivery } from '@/lib/gradeWithoutSubmission';
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Submission {
  id: string;
  student_id: string;
  homework_id: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  notes: string | null;
  status: string;
  grade: number | null;
  teacher_feedback: string | null;
  submitted_at: string;
  feedback_at: string | null;
  points_earned: number;
  auto_score: number | null;
  test_results: unknown;
  student: {
    full_name: string;
    email: string | null;
  };
  homework: {
    title: string;
    points_reward: number;
    test_cases: unknown;
    python_env: string | null;
    default_python_code: string | null;
    attachments: unknown;
    /** Corso diretto del compito (anche senza lezione) */
    course: { slug: string } | null;
    /** null: compito stagionale tolto dalla lezione (le consegne restano da correggere) */
    lesson: {
      title: string;
      lesson_number: number;
      course: {
        title: string;
        emoji: string;
        slug: string;
      };
    } | null;
  };
}

export default function AdminGrading() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [withoutSubmissionOpen, setWithoutSubmissionOpen] = useState(false);

  const [formData, setFormData] = useState({
    grade: 100,
    teacher_feedback: '',
  });

  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchSubmissions();
    }
  }, [user, isAdmin, statusFilter]);

  const fetchSubmissions = async () => {
    let query = supabase
      .from('homework_submissions')
      .select(`
        id,
        student_id,
        homework_id,
        file_url,
        file_name,
        file_type,
        notes,
        status,
        grade,
        teacher_feedback,
        submitted_at,
        feedback_at,
        points_earned,
        auto_score,
        test_results,
        student:student_id (full_name, email),
        homework:homework_id (
          title,
          points_reward,
          test_cases,
          python_env,
          default_python_code,
          attachments,
          course:course_id (slug),
          lesson:lesson_id (
            title,
            lesson_number,
            course:course_id (title, emoji, slug)
          )
        )
      `)
      .order('submitted_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: 'Errore', description: 'Impossibile caricare le consegne', variant: 'destructive' });
    } else {
      const typedSubmissions = (data || []).map((s: any) => ({
        ...s,
        student: s.student as { full_name: string; email: string | null },
        homework: s.homework as {
          title: string;
          points_reward: number;
          lesson: {
            title: string;
            lesson_number: number;
            course: { title: string; emoji: string };
          } | null;
        },
      }));
      setSubmissions(typedSubmissions);
    }
    setIsLoading(false);
  };

  const isCodeFile = (fileName: string | null): boolean => {
    if (!fileName) return false;
    const codeExtensions = ['.py', '.html', '.css', '.js', '.ts', '.tsx', '.json', '.lua', '.md'];
    return codeExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  };

  // Il DB contiene il percorso nel bucket privato, non un indirizzo: il link
  // firmato si genera al clic (così non scade se la pagina resta aperta).
  const openSubmissionFile = async (path: string) => {
    const ok = await openStorageFile('homework-files', path);
    if (!ok) {
      toast({ title: 'File non disponibile', description: 'Impossibile aprire il file consegnato.', variant: 'destructive' });
    }
  };

  const openGradeDialog = async (submission: Submission) => {
    setSelectedSubmission(submission);
    setFormData({
      // Senza voto parte dal voto proposto dalla correzione automatica
      grade: submission.grade ?? submission.auto_score ?? 100,
      teacher_feedback: submission.teacher_feedback || '',
    });
    setDialogOpen(true);
  };

  // Un clic: voto = punteggio dei test, feedback = quello scritto o l'elenco dei test da sistemare
  const confirmAutoScore = (submission: Submission) => {
    if (submission.auto_score == null) return;
    const cases = parseTestCases(submission.homework.test_cases);
    const results = parseTestResults(submission.test_results);
    const relevant = cases.filter(c => results.some(r => r.id === c.id));
    const feedback = formData.teacher_feedback.trim()
      || (relevant.length > 0 ? failedTestsFeedback(relevant, results) : '');
    void handleSubmit({ grade: submission.auto_score, teacher_feedback: feedback });
  };

  const handleSubmit = async (override?: { grade: number; teacher_feedback: string }) => {
    const values = override ?? formData;
    if (!selectedSubmission) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('homework_submissions')
        .update({
          grade: values.grade,
          teacher_feedback: values.teacher_feedback || null,
          status: 'graded',
          feedback_at: new Date().toISOString(),
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;
      toast({ title: 'Successo', description: 'Valutazione salvata' });
      setDialogOpen(false);
      fetchSubmissions();
    } catch (error: any) {
      toast({ 
        title: 'Errore', 
        description: error.message || 'Impossibile salvare la valutazione', 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const getStatusBadge = (status: string, grade: number | null) => {
    switch (status) {
      case 'graded':
        return <Badge className="bg-green-500">{grade}%</Badge>;
      case 'reviewed':
        return <Badge variant="secondary">Revisionato</Badge>;
      case 'pending':
      default:
        return <Badge variant="outline">In attesa</Badge>;
    }
  };

  const calculatePoints = (maxPoints: number, grade: number) => {
    return Math.round((maxPoints * grade) / 100);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <AdminHeader />

      {/* Navigation */}
      <AdminNav />

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Valutazione Compiti</h1>
            <p className="text-muted-foreground mt-1">{submissions.length} consegne</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setWithoutSubmissionOpen(true)}>
            <ClipboardCheck className="w-4 h-4 mr-2" />
            Valuta senza consegna
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtra per stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="pending">In attesa</SelectItem>
              <SelectItem value="graded">Valutati</SelectItem>
            </SelectContent>
          </Select>
          </div>
        </div>

        {/* Submissions List */}
        {submissions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nessuna consegna</h3>
              <p className="text-muted-foreground">
                {statusFilter === 'pending' 
                  ? 'Non ci sono compiti da valutare' 
                  : 'Nessuna consegna trovata'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {submissions.map((submission) => (
              <Card key={submission.id} className={submission.status === 'pending' ? 'border-amber-500/50' : ''}>
                <CardContent className="py-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{submission.homework.lesson?.course.emoji ?? '✨'}</span>
                        <h3 className="font-semibold">{submission.homework.title}</h3>
                        {getStatusBadge(submission.status, submission.grade)}
                        {!hasDelivery(submission) && (
                          <Badge variant="outline">Senza consegna</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {submission.student.full_name} · {submission.homework.lesson?.course.title ?? 'Compito stagionale'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {submission.homework.lesson
                          ? `Lezione ${submission.homework.lesson.lesson_number}: ${submission.homework.lesson.title}`
                          : 'Non è più in una lezione'}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(submission.submitted_at), "d MMM yyyy", { locale: it })}
                        </span>
                        <span>
                          Max: {submission.homework.points_reward} punti
                        </span>
                        {submission.status === 'graded' && (
                          <span className="text-primary font-medium">
                            Assegnati: {submission.points_earned} punti
                          </span>
                        )}
                      </div>
                      {submission.notes && parseSubmittedCode(submission.notes) == null && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          Note: {submission.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <AutoScoreBadge score={submission.auto_score} />
                      {(parseSubmittedCode(submission.notes) != null || (submission.file_url && isCodeFile(submission.file_name))) && (
                        <Badge variant="outline" className="gap-1">
                          <Code className="w-3 h-3" />
                          Codice
                        </Badge>
                      )}
                      {submission.file_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openSubmissionFile(submission.file_url!)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          {submission.file_name || 'File'}
                        </Button>
                      )}
                      <Button onClick={() => openGradeDialog(submission)}>
                        <Award className="w-4 h-4 mr-2" />
                        {submission.status === 'graded' ? 'Modifica' : 'Valuta'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Grade Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[1600px] sm:max-w-[1600px] h-[96dvh] max-h-[96dvh] p-0 sm:p-0 flex flex-col gap-0 overflow-hidden">
            <DialogHeader className="p-4 sm:p-6 pb-2 border-b shrink-0">
              <DialogTitle>Valuta Compito</DialogTitle>
              <DialogDescription>
                {selectedSubmission && (
                  <>
                    {selectedSubmission.student.full_name} - {selectedSubmission.homework.title}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
              {/* Consegna: compilatore eseguibile, anteprima di file e progetti Scratch */}
              <div className="lg:flex-1 lg:min-w-0 lg:overflow-y-auto p-4 sm:p-6 bg-muted/20 border-b lg:border-b-0 lg:border-r">
                {selectedSubmission && (
                  <SubmissionWorkspace
                    submission={selectedSubmission}
                    homework={{
                      test_cases: selectedSubmission.homework.test_cases,
                      python_env: selectedSubmission.homework.python_env,
                      default_python_code: selectedSubmission.homework.default_python_code,
                      attachments: selectedSubmission.homework.attachments,
                      courseSlug: selectedSubmission.homework.lesson?.course.slug ?? selectedSubmission.homework.course?.slug ?? null,
                    }}
                  />
                )}
              </div>

              {/* Valutazione */}
              <div className="lg:w-[420px] xl:w-[460px] shrink-0 lg:overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Codice dal compilatore e correzione automatica */}
              {selectedSubmission && (
                <AutoGradingReview
                  notes={selectedSubmission.notes}
                  autoScore={selectedSubmission.auto_score}
                  testResults={selectedSubmission.test_results}
                  testCases={selectedSubmission.homework.test_cases}
                  showCode={false}
                />
              )}

              {/* Notes */}
              {selectedSubmission?.notes && parseSubmittedCode(selectedSubmission.notes) == null && (
                <div className="space-y-2">
                  <Label>Note dello studente</Label>
                  <div className="bg-muted/30 rounded-lg p-3 text-sm">
                    {selectedSubmission.notes}
                  </div>
                </div>
              )}

              {/* Grading Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Voto</Label>
                  <span className="text-2xl font-bold text-primary">{formData.grade}%</span>
                </div>
                <Slider
                  value={[formData.grade]}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, grade: v[0] }))}
                  max={100}
                  min={0}
                  step={5}
                  className="py-4"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
                {selectedSubmission && (
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-sm text-muted-foreground">Punti assegnati</p>
                    <p className="text-xl font-bold text-primary">
                      {calculatePoints(selectedSubmission.homework.points_reward, formData.grade)} / {selectedSubmission.homework.points_reward}
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback">Feedback (opzionale)</Label>
                <FeedbackTemplates
                  mode="grading"
                  onSelect={(text) => setFormData(prev => ({
                    ...prev,
                    teacher_feedback: prev.teacher_feedback ? prev.teacher_feedback + '\n' + text : text
                  }))}
                />
                <Textarea
                  id="feedback"
                  value={formData.teacher_feedback}
                  onChange={(e) => setFormData(prev => ({ ...prev, teacher_feedback: e.target.value }))}
                  placeholder="Scrivi un feedback per lo studente..."
                  rows={4}
                />
              </div>
              </div>
            </div>
            <DialogFooter className="p-4 sm:p-6 pt-3 border-t bg-background shrink-0 flex-row flex-wrap justify-end gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annulla
              </Button>
              {selectedSubmission?.auto_score != null && (
                <Button
                  variant="secondary"
                  onClick={() => confirmAutoScore(selectedSubmission)}
                  disabled={isSaving}
                  title="Salva come voto il punteggio dei test, con un feedback sui test non superati"
                >
                  Conferma voto proposto ({selectedSubmission.auto_score}%)
                </Button>
              )}
              <Button onClick={() => handleSubmit()} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salva Valutazione
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <GradeWithoutSubmissionDialog
          open={withoutSubmissionOpen}
          onOpenChange={setWithoutSubmissionOpen}
          teacherId={null}
          onGraded={fetchSubmissions}
        />
      </main>
    </div>
  );
}
