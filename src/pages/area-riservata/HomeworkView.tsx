import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { LessonContent } from '@/components/lesson/LessonContent';
import { PythonCompiler } from '@/components/lesson/PythonCompiler';
import { TurtleCompiler } from '@/components/lesson/TurtleCompiler';
import { PgzeroCompiler } from '@/components/lesson/PgzeroCompiler';
import { WebCompiler } from '@/components/lesson/WebCompiler';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, ArrowLeft, Calendar, Trophy, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCodeDraft } from '@/hooks/useCodeDraft';

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
}

const PYTHON_COURSES = ['python-base', 'python-ai', 'python-avanzato'];
const WEB_COURSES = ['web-development'];

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

  const handleSubmit = async (codeContent: string) => {
    if (!user || !homework || !effectiveUserId) return;

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
      // Use effectiveUserId for student submission
      const submissionData: any = {
        homework_id: homework.id,
        student_id: effectiveUserId,
        status: 'pending',
        notes: `[CODE]\n${codeContent}`,
        file_type: 'text/code',
      };

      if (submission) {
        const { error } = await supabase
          .from('homework_submissions')
          .update(submissionData)
          .eq('id', submission.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('homework_submissions')
          .insert(submissionData);

        if (error) throw error;
      }

      toast({
        title: 'Compito inviato! 🎉',
        description: 'Il tuo lavoro è stato inviato con successo',
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

  const isPythonCourse = PYTHON_COURSES.includes(homework.lesson.course.slug);
  const isWebCourse = WEB_COURSES.includes(homework.lesson.course.slug);
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

              {/* Teacher feedback if exists */}
              {submission?.teacher_feedback && (
                <div className="px-6 pb-6">
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <h4 className="font-medium mb-2">💬 Feedback dell'insegnante</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {submission.teacher_feedback}
                    </p>
                    {submission.grade && (
                      <p className="mt-2 text-sm font-medium">
                        Voto: {submission.grade}/10 · Punti guadagnati: {submission.points_earned}
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
              homework.python_env === 'turtle' ? (
                <TurtleCompiler defaultCode={homework.default_python_code || undefined} />
              ) : homework.python_env === 'pgzero' ? (
                <PgzeroCompiler defaultCode={homework.default_python_code || undefined} replitUrl={homework.replit_url || undefined} />
              ) : (
                <PythonCompiler 
                  defaultCode={homework.default_python_code || undefined} 
                  taskId={`homework-${homework.id}`}
                />
              )
            )}
            {isWebCourse && (
              <WebCompiler 
                defaultHtmlCode={homework.default_html_code || undefined}
                defaultCssCode={homework.default_css_code || undefined}
                defaultJsCode={homework.default_js_code || undefined}
                taskId={`homework-${homework.id}`}
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
  isAlreadySubmitted 
}: {
  homeworkId: string;
  isPythonCourse: boolean;
  isWebCourse: boolean;
  onSubmit: (code: string) => void;
  isSubmitting: boolean;
  isAlreadySubmitted: boolean;
}) {
  const handleClick = async () => {
    // Get code from the draft storage
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: userData } = await supabase.auth.getUser();
    
    if (!userData.user) return;

    let codeContent = '';
    
    if (isPythonCourse) {
      const { data } = await supabase
        .from('student_code_drafts')
        .select('content')
        .eq('student_id', userData.user.id)
        .eq('task_id', `homework-${homeworkId}`)
        .eq('code_type', 'python')
        .maybeSingle();
      
      codeContent = data?.content || '';
    } else if (isWebCourse) {
      const { data: htmlData } = await supabase
        .from('student_code_drafts')
        .select('content')
        .eq('student_id', userData.user.id)
        .eq('task_id', `homework-${homeworkId}`)
        .eq('code_type', 'html')
        .maybeSingle();
      
      const { data: cssData } = await supabase
        .from('student_code_drafts')
        .select('content')
        .eq('student_id', userData.user.id)
        .eq('task_id', `homework-${homeworkId}`)
        .eq('code_type', 'css')
        .maybeSingle();
      
      const { data: jsData } = await supabase
        .from('student_code_drafts')
        .select('content')
        .eq('student_id', userData.user.id)
        .eq('task_id', `homework-${homeworkId}`)
        .eq('code_type', 'js')
        .maybeSingle();
      
      codeContent = `<!-- HTML -->\n${htmlData?.content || ''}\n\n/* CSS */\n${cssData?.content || ''}\n\n// JavaScript\n${jsData?.content || ''}`;
    }

    onSubmit(codeContent);
  };

  return (
    <Button onClick={handleClick} disabled={isSubmitting} className="gap-2">
      {isSubmitting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Send className="w-4 h-4" />
      )}
      {isAlreadySubmitted ? 'Aggiorna consegna' : 'INVIA'}
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
