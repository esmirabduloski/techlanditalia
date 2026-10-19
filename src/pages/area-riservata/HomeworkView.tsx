import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { Layout } from '@/components/layout/Layout';
import { LessonContent } from '@/components/lesson/LessonContent';
import { PythonCompiler, type TestRunnerRef } from '@/components/lesson/PythonCompiler';
import { TurtleCompiler } from '@/components/lesson/TurtleCompiler';
import { PgzeroCompiler } from '@/components/lesson/PgzeroCompiler';
import { WebCompiler } from '@/components/lesson/WebCompiler';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, ArrowLeft, Calendar, Trophy, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCodeDraft } from '@/hooks/useCodeDraft';
import { flushCodeDrafts } from '@/lib/codeDrafts';
import { parseTestCases, pythonCases, scoreResults, webCases, type TestCase, type TestResult } from '@/lib/testCases';
import { resolveCompiler } from '@/lib/compilerKind';

interface Attachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface HomeworkDetails {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  points_reward: number;
  due_date: string | null;
  attachments: Attachment[];
  default_python_code: string | null;
  default_html_code: string | null;
  default_css_code: string | null;
  default_js_code: string | null;
  python_env: string | null;
  replit_url: string | null;
  preview_only: boolean;
  test_cases: TestCase[];
  lesson: {
    id: string;
    title: string;
    lesson_number: number;
    course: {
      id: string;
      title: string;
      emoji: string;
      slug: string;
    };
  };
}

interface Submission {
  id: string;
  status: string;
  submitted_at: string;
  file_url: string | null;
  notes: string | null;
  teacher_feedback: string | null;
  grade: number | null;
  points_earned: number;
  auto_score: number | null;
}

interface TestOutcome {
  score: number;
  results: TestResult[];
}

const SUBMIT_ERRORS: Record<string, string> = {
  already_graded: 'Il compito è già stato valutato: non puoi più modificare la consegna.',
  not_enrolled: 'Non risulti iscritto a questo corso.',
  empty: 'Scrivi del codice prima di inviare il compito.',
  too_large: 'Il codice è troppo lungo per essere consegnato.',
  mfa_required: 'Completa la verifica in due passaggi per consegnare.',
};

export default function HomeworkView() {
  const { homeworkId } = useParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { effectiveUserId, isImpersonating } = useEffectiveUserId();
  const { toast } = useToast();
  
  const [homework, setHomework] = useState<HomeworkDetails | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Il compilatore aperto registra qui la sua "Verifica", rieseguita alla consegna
  const testRunnerRef: TestRunnerRef = useRef(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && homeworkId && effectiveUserId) {
      fetchHomeworkDetails();
    }
  }, [user, homeworkId, effectiveUserId]);

  const fetchHomeworkDetails = async () => {
    if (!user || !homeworkId || !effectiveUserId) return;
    
    try {
      const { data: homeworkData, error: homeworkError } = await supabase
        .from('homework')
        .select(`
          *,
          lessons!inner (
            id,
            title,
            lesson_number,
            courses!inner (
              id,
              title,
              emoji,
              slug
            )
          )
        `)
        .eq('id', homeworkId)
        .single();

      if (homeworkError) throw homeworkError;

      const lesson = homeworkData.lessons as any;
      const course = lesson.courses;

      setHomework({
        id: homeworkData.id,
        title: homeworkData.title,
        description: homeworkData.description,
        instructions: homeworkData.instructions,
        points_reward: homeworkData.points_reward,
        due_date: homeworkData.due_date,
        attachments: Array.isArray(homeworkData.attachments) 
          ? (homeworkData.attachments as unknown as Attachment[]) 
          : [],
        default_python_code: (homeworkData as any).default_python_code || null,
        default_html_code: (homeworkData as any).default_html_code || null,
        default_css_code: (homeworkData as any).default_css_code || null,
        default_js_code: (homeworkData as any).default_js_code || null,
        python_env: (homeworkData as any).python_env || null,
        replit_url: (homeworkData as any).replit_url || null,
        preview_only: (homeworkData as any).preview_only || false,
        test_cases: parseTestCases((homeworkData as any).test_cases),
        lesson: {
          id: lesson.id,
          title: lesson.title,
          lesson_number: lesson.lesson_number,
          course: {
            id: course.id,
            title: course.title,
            emoji: course.emoji,
            slug: course.slug,
          },
        },
      });

      // Fetch existing submission using effectiveUserId (for impersonation)
      const { data: submissionData } = await supabase
        .from('homework_submissions')
        .select('*')
        .eq('homework_id', homeworkId)
        .eq('student_id', effectiveUserId)
        .maybeSingle();

      if (submissionData) {
        setSubmission(submissionData);
      }
    } catch (error) {
      console.error('Error fetching homework:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile caricare i dettagli del compito',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (codeContent: string, tests: TestOutcome | null) => {
    if (!user || !homework || !effectiveUserId) return;

    if (isImpersonating) {
      toast({
        variant: 'destructive',
        title: 'Anteprima studente',
        description: 'In modalità anteprima non puoi consegnare al posto dello studente',
      });
      return;
    }

    if (!codeContent.trim()) {
      toast({
        variant: 'destructive',
        title: 'Codice richiesto',
        description: 'Scrivi del codice prima di inviare il compito',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc('submit_homework_code', {
        _homework_id: homework.id,
        _notes: `[CODE]\n${codeContent}`,
        _auto_score: tests?.score,
        _test_results: tests ? (tests.results as unknown as Json) : undefined,
      });
      if (error) throw error;
      const res = data as { success?: boolean; error?: string } | null;
      if (!res?.success) {
        throw new Error(SUBMIT_ERRORS[res?.error ?? ''] || 'Impossibile inviare il compito');
      }

      toast({
        title: 'Compito inviato! 🎉',
        description: tests
          ? `Test superati: ${tests.results.filter(r => r.passed).length}/${tests.results.length} · voto proposto ${tests.score}/100, in attesa di conferma dell'insegnante`
          : 'Il tuo lavoro è stato inviato con successo',
      });

      fetchHomeworkDetails();
    } catch (error: any) {
      console.error('Error submitting homework:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: error.message || 'Impossibile inviare il compito',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    if (!submission) {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
          <Clock className="w-3 h-3 mr-1" />
          Da fare
        </Badge>
      );
    }
    
    switch (submission.status) {
      case 'graded':
        return (
          <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Valutato{submission.grade != null ? ` · ${submission.grade}/100` : ''}
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Approvato
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">
            <Clock className="w-3 h-3 mr-1" />
            In revisione
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
            <AlertCircle className="w-3 h-3 mr-1" />
            Da rivedere
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user || !homework) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Compito non trovato</p>
        </div>
      </Layout>
    );
  }

  const compiler = resolveCompiler(homework.lesson.course.slug, homework);
  const isPythonCourse = compiler === 'python' || compiler === 'turtle' || compiler === 'pgzero';
  const isWebCourse = compiler === 'web';
  const hasCompiler = isPythonCourse || isWebCourse;

  // Preview-only mode for Web courses with preview_only flag
  if (isWebCourse && homework.preview_only) {
    return (
      <div className="h-screen flex flex-col bg-background">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/area-riservata/corso/${homework.lesson.course.id}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{homework.lesson.course.emoji}</span>
                <span>{homework.lesson.course.title}</span>
                <span>·</span>
                <span>Lezione {homework.lesson.lesson_number}</span>
              </div>
              <h1 className="font-semibold">{homework.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge()}
            <Badge variant="secondary" className="gap-1">
              <Trophy className="w-3 h-3" />
              {homework.points_reward} punti
            </Badge>
            {homework.due_date && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(homework.due_date)}
              </span>
            )}
          </div>
        </div>

        {/* Full-screen preview iframe */}
        <PreviewOnlyFrame
          htmlCode={homework.default_html_code || ''}
          cssCode={homework.default_css_code || ''}
          jsCode={homework.default_js_code || ''}
        />
      </div>
    );
  }

  // Compiler layout for Python/Web courses
  if (hasCompiler) {
    return (
      <div className="h-screen flex flex-col bg-background">
        {/* Top bar with submit button */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/area-riservata/corso/${homework.lesson.course.id}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{homework.lesson.course.emoji}</span>
                <span>{homework.lesson.course.title}</span>
                <span>·</span>
                <span>Lezione {homework.lesson.lesson_number}</span>
              </div>
              <h1 className="font-semibold">{homework.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge()}
            <Badge variant="secondary" className="gap-1">
              <Trophy className="w-3 h-3" />
              {homework.points_reward} punti
            </Badge>
            {homework.due_date && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(homework.due_date)}
              </span>
            )}
            <HomeworkSubmitButton
              homeworkId={homework.id}
              isPythonCourse={isPythonCourse}
              isWebCourse={isWebCourse}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              isAlreadySubmitted={!!submission}
              isLocked={!!submission && ['graded', 'approved'].includes(submission.status)}
              testCases={homework.test_cases}
              testRunnerRef={testRunnerRef}
            />
          </div>
        </div>

        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Left Panel - Homework Content */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full overflow-y-auto">
              <LessonContent
                title={homework.title}
                lessonTitle={homework.lesson.title}
                description={homework.description}
                content={homework.instructions}
                contentType="text"
                videoUrl={null}
                slidesUrl={null}
                images={[]}
              />
              
              {/* Attachments */}
              {homework.attachments && homework.attachments.length > 0 && (
                <div className="px-6 pb-6">
                  <h3 className="font-semibold mb-3">📎 Materiali allegati</h3>
                  <div className="space-y-2">
                    {homework.attachments.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-muted/50 rounded-md hover:bg-muted transition-colors"
                      >
                        <span className="text-sm">{att.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Voto proposto dai test, finché l'insegnante non conferma */}
              {submission?.status === 'pending' && submission.auto_score != null && (
                <div className="px-6 pb-6">
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <h4 className="font-medium mb-1">🧪 Correzione automatica</h4>
                    <p className="text-sm text-muted-foreground">
                      Voto proposto dai test: <span className="font-medium text-foreground">{submission.auto_score}/100</span>.
                      L'insegnante lo conferma o lo modifica.
                    </p>
                  </div>
                </div>
              )}

              {/* Teacher feedback if exists */}
              {submission?.teacher_feedback && (
                <div className="px-6 pb-6">
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <h4 className="font-medium mb-2">💬 Feedback dell'insegnante</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {submission.teacher_feedback}
                    </p>
                    {submission.grade != null && (
                      <p className="mt-2 text-sm font-medium">
                        Voto: {submission.grade}/100 · Punti guadagnati: {submission.points_earned}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Compiler */}
          <ResizablePanel defaultSize={50} minSize={30}>
            {isPythonCourse && (
              compiler === 'turtle' ? (
                <TurtleCompiler
                  defaultCode={homework.default_python_code || undefined}
                  taskId={`homework-${homework.id}`}
                />
              ) : compiler === 'pgzero' ? (
                <PgzeroCompiler
                  defaultCode={homework.default_python_code || undefined}
                  replitUrl={homework.replit_url || undefined}
                  taskId={`homework-${homework.id}`}
                  attachments={homework.attachments}
                />
              ) : (
                <PythonCompiler
                  defaultCode={homework.default_python_code || undefined}
                  taskId={`homework-${homework.id}`}
                  testCases={homework.test_cases}
                  testRunnerRef={testRunnerRef}
                />
              )
            )}
            {isWebCourse && (
              <WebCompiler 
                defaultHtmlCode={homework.default_html_code || undefined}
                defaultCssCode={homework.default_css_code || undefined}
                defaultJsCode={homework.default_js_code || undefined}
                taskId={`homework-${homework.id}`}
                testCases={homework.test_cases}
                testRunnerRef={testRunnerRef}
              />
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  }

  // Normal layout for non-compiler courses (redirect to old detail page)
  navigate(`/area-riservata/compito-dettaglio/${homeworkId}`);
  return null;
}

// Component to handle submit with code from compiler
function HomeworkSubmitButton({ 
  homeworkId, 
  isPythonCourse, 
  isWebCourse, 
  onSubmit, 
  isSubmitting,
  isAlreadySubmitted,
  isLocked,
  testCases,
  testRunnerRef,
}: {
  homeworkId: string;
  isPythonCourse: boolean;
  isWebCourse: boolean;
  onSubmit: (code: string, tests: TestOutcome | null) => void;
  isSubmitting: boolean;
  isAlreadySubmitted: boolean;
  isLocked: boolean;
  testCases: TestCase[];
  testRunnerRef: TestRunnerRef;
}) {
  const [isTesting, setIsTesting] = useState(false);

  const handleClick = async () => {
    // Get code from the draft storage
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: userData } = await supabase.auth.getUser();
    
    if (!userData.user) return;

    // Prima salva le modifiche ancora in sospeso nei compilatori aperti:
    // altrimenti verrebbe consegnato il codice dell'ultimo salvataggio automatico.
    await flushCodeDrafts();

    let codeContent = '';
    
    if (isPythonCourse) {
      const { data } = await supabase
        .from('student_code_drafts')
        .select('content')
        .eq('student_id', userData.user.id)
        .eq('homework_id', homeworkId)
        .eq('code_type', 'python')
        .maybeSingle();
      
      codeContent = data?.content || '';
    } else if (isWebCourse) {
      const { data: htmlData } = await supabase
        .from('student_code_drafts')
        .select('content')
        .eq('student_id', userData.user.id)
        .eq('homework_id', homeworkId)
        .eq('code_type', 'html')
        .maybeSingle();
      
      const { data: cssData } = await supabase
        .from('student_code_drafts')
        .select('content')
        .eq('student_id', userData.user.id)
        .eq('homework_id', homeworkId)
        .eq('code_type', 'css')
        .maybeSingle();
      
      const { data: jsData } = await supabase
        .from('student_code_drafts')
        .select('content')
        .eq('student_id', userData.user.id)
        .eq('homework_id', homeworkId)
        .eq('code_type', 'js')
        .maybeSingle();
      
      codeContent = `<!-- HTML -->\n${htmlData?.content || ''}\n\n/* CSS */\n${cssData?.content || ''}\n\n// JavaScript\n${jsData?.content || ''}`;
    }

    // Correzione automatica: i test girano sul codice appena salvato.
    // Turtle/Pygame Zero non registrano un runner: si consegna senza voto proposto.
    let tests: TestOutcome | null = null;
    const runTests = testRunnerRef.current;
    const relevantCases = isPythonCourse ? pythonCases(testCases) : webCases(testCases);
    if (runTests && relevantCases.length > 0 && codeContent.trim()) {
      setIsTesting(true);
      try {
        const results = await runTests();
        if (results) tests = { score: scoreResults(results), results };
      } finally {
        setIsTesting(false);
      }
    }

    onSubmit(codeContent, tests);
  };

  if (isLocked) {
    return (
      <Button disabled className="gap-2" title="Il compito è già stato valutato">
        <CheckCircle2 className="w-4 h-4" />
        Valutato
      </Button>
    );
  }

  return (
    <Button onClick={handleClick} disabled={isSubmitting || isTesting} className="gap-2">
      {isTesting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isSubmitting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Send className="w-4 h-4" />
      )}
      {isTesting ? 'Verifica in corso…' : isAlreadySubmitted ? 'Aggiorna consegna' : 'INVIA'}
    </Button>
  );
}

// Preview-only iframe component for embedded forms/content
function PreviewOnlyFrame({ 
  htmlCode, 
  cssCode, 
  jsCode 
}: { 
  htmlCode: string; 
  cssCode: string; 
  jsCode: string; 
}) {
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    const generateHtml = () => {
      const userHtmlContent = htmlCode
        .replace(/<!DOCTYPE html>/gi, '')
        .replace(/<\/?html[^>]*>/gi, '')
        .replace(/<\/?head[^>]*>/gi, '')
        .replace(/<\/?body[^>]*>/gi, '')
        .replace(/<link[^>]*>/gi, '');

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${cssCode}</style>
        </head>
        <body>
          ${userHtmlContent}
          <script>${jsCode}</script>
        </body>
        </html>
      `;
    };

    const combinedHtml = generateHtml();
    const blob = new Blob([combinedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [htmlCode, cssCode, jsCode]);

  if (!previewUrl) return null;

  return (
    <iframe
      src={previewUrl}
      title="Preview"
      className="flex-1 w-full bg-white"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
    />
  );
}
