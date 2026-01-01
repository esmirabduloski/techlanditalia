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
import { AdminNav } from '@/components/admin/AdminNav';
import { CodeViewer } from '@/components/admin/CodeViewer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  LogOut, Loader2, Award, User, Calendar, Save, Download, Code
} from 'lucide-react';
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
  student: {
    full_name: string;
    email: string | null;
  };
  homework: {
    title: string;
    points_reward: number;
    lesson: {
      title: string;
      lesson_number: number;
      course: {
        title: string;
        emoji: string;
      };
    };
  };
}

export default function AdminGrading() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [codeContent, setCodeContent] = useState<string | null>(null);
  const [isLoadingCode, setIsLoadingCode] = useState(false);

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
        student:student_id (full_name, email),
        homework:homework_id (
          title,
          points_reward,
          lesson:lesson_id (
            title,
            lesson_number,
            course:course_id (title, emoji)
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
          };
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

  const loadCodeContent = async (fileUrl: string) => {
    setIsLoadingCode(true);
    try {
      const response = await fetch(fileUrl);
      if (response.ok) {
        const text = await response.text();
        setCodeContent(text);
      } else {
        setCodeContent(null);
      }
    } catch (error) {
      console.error('Error loading code:', error);
      setCodeContent(null);
    } finally {
      setIsLoadingCode(false);
    }
  };

  const openGradeDialog = async (submission: Submission) => {
    setSelectedSubmission(submission);
    setFormData({
      grade: submission.grade ?? 100,
      teacher_feedback: submission.teacher_feedback || '',
    });
    setCodeContent(null);
    setDialogOpen(true);

    // Load code content if it's a code file
    if (submission.file_url && isCodeFile(submission.file_name)) {
      await loadCodeContent(submission.file_url);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSubmission) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('homework_submissions')
        .update({
          grade: formData.grade,
          teacher_feedback: formData.teacher_feedback || null,
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
      <header className="bg-background border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-2xl font-bold">
              <span className="text-primary">TECH</span>
              <span className="text-tech-teal">LAND</span>
            </Link>
            <Badge variant="secondary">Admin</Badge>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/area-riservata">
                <User className="w-4 h-4 mr-2" />
                Area Riservata
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <AdminNav />

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Valutazione Compiti</h1>
            <p className="text-muted-foreground mt-1">{submissions.length} consegne</p>
          </div>
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
                        <span className="text-xl">{submission.homework.lesson.course.emoji}</span>
                        <h3 className="font-semibold">{submission.homework.title}</h3>
                        {getStatusBadge(submission.status, submission.grade)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {submission.student.full_name} · {submission.homework.lesson.course.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Lezione {submission.homework.lesson.lesson_number}: {submission.homework.lesson.title}
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
                      {submission.notes && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          Note: {submission.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {submission.file_url && isCodeFile(submission.file_name) && (
                        <Badge variant="outline" className="gap-1">
                          <Code className="w-3 h-3" />
                          Codice
                        </Badge>
                      )}
                      {submission.file_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={submission.file_url} target="_blank" rel="noopener noreferrer">
                            <Download className="w-4 h-4 mr-1" />
                            {submission.file_name || 'File'}
                          </a>
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Valuta Compito</DialogTitle>
              <DialogDescription>
                {selectedSubmission && (
                  <>
                    {selectedSubmission.student.full_name} - {selectedSubmission.homework.title}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Code Preview Section */}
              {selectedSubmission?.file_url && isCodeFile(selectedSubmission.file_name) && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Codice inviato
                  </Label>
                  {isLoadingCode ? (
                    <div className="flex items-center justify-center py-8 bg-muted/30 rounded-lg">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : codeContent ? (
                    <CodeViewer code={codeContent} fileName={selectedSubmission.file_name || undefined} />
                  ) : (
                    <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4 text-center">
                      Impossibile caricare il codice. 
                      <a 
                        href={selectedSubmission.file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary underline ml-1"
                      >
                        Scarica il file
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Notes Section */}
              {selectedSubmission?.notes && (
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
                <Textarea
                  id="feedback"
                  value={formData.teacher_feedback}
                  onChange={(e) => setFormData(prev => ({ ...prev, teacher_feedback: e.target.value }))}
                  placeholder="Scrivi un feedback per lo studente..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
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
      </main>
    </div>
  );
}
