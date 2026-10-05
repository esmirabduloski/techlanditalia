import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStudentProgress } from '@/hooks/useStudentProgress';
import { useBookmarks } from '@/hooks/useBookmarks';
import { computeLessonAccess, useCourseOutline } from '@/hooks/useCourseOutline';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { LessonContent } from '@/components/lesson/LessonContent';
import { LessonHeader } from '@/components/lesson/LessonHeader';
import { TaskNavigation } from '@/components/lesson/TaskNavigation';
import { CourseOutlineSheet } from '@/components/lesson/CourseOutlineSheet';
import { LessonCompleteDialog } from '@/components/lesson/LessonCompleteDialog';
import { BookmarkButton } from '@/components/dashboard/BookmarkButton';
import { PythonCompiler } from '@/components/lesson/PythonCompiler';
import { TurtleCompiler } from '@/components/lesson/TurtleCompiler';
import { PgzeroCompiler } from '@/components/lesson/PgzeroCompiler';
import { WebCompiler } from '@/components/lesson/WebCompiler';
import { QuizTask } from '@/components/lesson/QuizTask';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Course {
  id: string;
  slug: string;
  title: string;
}

interface Lesson {
  id: string;
  lesson_number: number;
  title: string;
  points_reward: number;
}

interface VisibleTask {
  id: string;
  task_number: number;
  title: string;
}

interface TaskAttachment {
  name: string;
  url: string;
  type: 'image' | 'css' | 'js' | 'html';
}

interface Task {
  id: string;
  task_number: number;
  title: string;
  description: string | null;
  content: string | null;
  content_type: string | null;
  slides_url: string | null;
  scratch_url: string | null;
  points_reward: number;
  default_python_code: string | null;
  default_html_code: string | null;
  default_css_code: string | null;
  default_js_code: string | null;
  python_env: string | null;
  replit_url: string | null;
  attachments: TaskAttachment[];
}

const PYTHON_COURSES = ['python-base', 'python-ai', 'python-avanzato'];
const WEB_COURSES = ['web-development'];

function ContentSkeleton() {
  return (
    <div className="p-6 space-y-4" aria-busy="true" aria-label="Caricamento task">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export default function TaskView() {
  const { courseId, lessonNumber, taskNumber } = useParams<{ courseId: string; lessonNumber: string; taskNumber: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { isTaskCompleted, completeTask, completeLesson, lessonProgress, effectiveUserId } = useStudentProgress();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const { lessons: outlineLessons, schedule } = useCourseOutline(courseId, effectiveUserId);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [visibleTasks, setVisibleTasks] = useState<VisibleTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  // Il componente resta montato passando da un task all'altro: teniamo traccia
  // della richiesta più recente per ignorare risposte arrivate in ritardo e
  // per non mostrare il contenuto del task precedente mentre carica il nuovo.
  const requestKey = `${courseId}/${lessonNumber}/${taskNumber}`;
  const latestRequest = useRef(requestKey);
  const isStale = loadedKey !== requestKey;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (courseId && lessonNumber && taskNumber) {
      fetchData();
    }
  }, [courseId, lessonNumber, taskNumber]);

  // Nel layout diviso il testo scorre dentro il pannello, non nella finestra:
  // riportarlo in cima a ogni cambio task.
  useEffect(() => {
    contentScrollRef.current?.scrollTo({ top: 0 });
  }, [task?.id]);

  const fetchData = async () => {
    if (!courseId || !lessonNumber || !taskNumber) return;
    const key = `${courseId}/${lessonNumber}/${taskNumber}`;
    latestRequest.current = key;
    const isCurrent = () => latestRequest.current === key;

    try {
      // Fetch course
      const { data: courseData } = await supabase
        .from('courses')
        .select('id, slug, title')
        .eq('id', courseId)
        .maybeSingle();
      if (!isCurrent()) return;

      if (courseData) {
        setCourse(courseData);
      }

      // Fetch lesson by lesson_number
      const { data: lessonData } = await supabase
        .from('lessons')
        .select('id, lesson_number, title, points_reward')
        .eq('course_id', courseId)
        .eq('lesson_number', parseInt(lessonNumber))
        .maybeSingle();
      if (!isCurrent()) return;

      setLesson(lessonData);
      if (!lessonData) {
        setTask(null);
        return;
      }

      // Fetch visible tasks for navigation and the stepper
      const { data: visibleTasksData } = await supabase
        .from('lesson_tasks')
        .select('id, task_number, title')
        .eq('lesson_id', lessonData.id)
        .eq('is_visible', true)
        .order('task_number');
      if (!isCurrent()) return;

      const visible = (visibleTasksData || []) as VisibleTask[];
      setVisibleTasks(visible);
      const visibleNumbers = visible.map(t => t.task_number);

      const requestedNumber = parseInt(taskNumber);

      // If the requested task is hidden or missing, jump to next visible one (or back to course)
      if (!visibleNumbers.includes(requestedNumber)) {
        const nextVisible = visibleNumbers.find(n => n > requestedNumber) ?? visibleNumbers[visibleNumbers.length - 1];
        if (nextVisible !== undefined && nextVisible !== requestedNumber) {
          navigate(`/area-riservata/corso/${courseId}/lezione/${lessonNumber}/task/${nextVisible}`, { replace: true });
          return;
        }
        if (nextVisible === undefined) {
          navigate(`/area-riservata/corso/${courseId}`, { replace: true });
          return;
        }
      }

      // Fetch the specific task (only if visible)
      const { data: taskData } = await supabase
        .from('lesson_tasks')
        .select('*')
        .eq('lesson_id', lessonData.id)
        .eq('task_number', requestedNumber)
        .eq('is_visible', true)
        .maybeSingle();
      if (!isCurrent()) return;

      if (taskData) {
        // Parse attachments from JSONB
        let attachments: TaskAttachment[] = [];
        try {
          const rawAttachments = (taskData as any).attachments;
          if (Array.isArray(rawAttachments)) {
            attachments = rawAttachments;
          } else if (typeof rawAttachments === 'string') {
            attachments = JSON.parse(rawAttachments);
          }
        } catch (e) {
          console.error('Error parsing attachments:', e);
        }

        setTask({ ...taskData, attachments });
      } else {
        setTask(null);
      }
    } catch (error) {
      console.error('Error fetching task:', error);
    } finally {
      if (isCurrent()) {
        setIsLoading(false);
        setLoadedKey(key);
      }
    }
  };

  const goToTask = (newTaskNumber: number) => {
    // Andando avanti il task corrente viene segnato come completato.
    // Non blocchiamo la navigazione in attesa del salvataggio.
    if (task && newTaskNumber > task.task_number) {
      void completeTask(task.id);
    }
    navigate(`/area-riservata/corso/${courseId}/lezione/${lessonNumber}/task/${newTaskNumber}`);
  };

  const goToLesson = (newLessonNumber: number) => {
    setCompleteDialogOpen(false);
    navigate(`/area-riservata/corso/${courseId}/lezione/${newLessonNumber}`);
  };

  const handleNavigateToCourse = async () => {
    // Mark last task as completed when going back to course
    if (task) {
      await completeTask(task.id);
    }
    navigate(`/area-riservata/corso/${courseId}`);
  };

  const handleFinishLesson = () => {
    if (task) {
      void completeTask(task.id);
    }
    setCompleteDialogOpen(true);
  };

  const lessonAccess = useMemo(
    () => computeLessonAccess(outlineLessons, new Set(lessonProgress.map(p => p.lesson_id)), schedule),
    [outlineLessons, lessonProgress, schedule],
  );

  const taskCompleted = task ? isTaskCompleted(task.id) : false;

  if (authLoading || (isLoading && !task)) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user || !course || !lesson || !task) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Task non trovato</p>
        </div>
      </Layout>
    );
  }

  const isPythonCourse = PYTHON_COURSES.includes(course.slug);
  const isWebCourse = WEB_COURSES.includes(course.slug);

  // Navigation among visible tasks only
  const currentIndex = visibleTasks.findIndex(t => t.task_number === task.task_number);
  const previousTaskNumber = currentIndex > 0 ? visibleTasks[currentIndex - 1].task_number : undefined;
  const nextTaskNumber = currentIndex >= 0 && currentIndex < visibleTasks.length - 1
    ? visibleTasks[currentIndex + 1].task_number
    : undefined;
  const displayPosition = currentIndex >= 0 ? currentIndex + 1 : 1;
  const totalTasks = visibleTasks.length || 1;
  const isMixedType = task.content_type === 'mixed';
  const isScratchType = task.content_type === 'scratch';
  const showCompiler = (isPythonCourse || isWebCourse) && isMixedType;
  const showScratch = isScratchType && task.scratch_url;
  const isQuizType = task.content_type === 'quiz';

  const outlineIndex = outlineLessons.findIndex(l => l.id === lesson.id);
  const nextOutlineLesson = outlineIndex >= 0 ? outlineLessons[outlineIndex + 1] : undefined;

  // Helper function to extract proper Scratch embed URL
  const getScratchEmbedUrl = (url: string): string => {
    // If already an embed URL, return as-is
    if (url.includes('/embed')) {
      return url;
    }
    // Extract project ID and create embed URL
    const match = url.match(/scratch\.mit\.edu\/projects\/(\d+)/);
    if (match) {
      return `https://scratch.mit.edu/projects/${match[1]}/embed`;
    }
    return url;
  };

  const header = (
    <LessonHeader
      courseTitle={course.title}
      lessonNumber={lesson.lesson_number}
      lessonTitle={lesson.title}
      taskTitle={task.title}
      taskPosition={displayPosition}
      steps={visibleTasks.map(t => ({
        key: t.id,
        title: t.title,
        completed: isTaskCompleted(t.id),
        current: t.task_number === task.task_number,
        onSelect: () => goToTask(t.task_number),
      }))}
      onBack={handleNavigateToCourse}
      onOpenOutline={outlineLessons.length > 0 ? () => setOutlineOpen(true) : undefined}
      actions={
        <>
          {taskCompleted && (
            <Badge variant="outline" className="hidden sm:inline-flex text-primary border-primary mr-1">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Completato
            </Badge>
          )}
          <BookmarkButton
            isBookmarked={isBookmarked('task', task.id)}
            onToggle={() => toggleBookmark('task', task.id, course.id)}
            size="sm"
          />
        </>
      }
    />
  );

  const navigation = (className?: string) => (
    <TaskNavigation
      courseId={course.id}
      lessonNumber={lesson.lesson_number}
      currentTaskNumber={displayPosition}
      totalTasks={totalTasks}
      onPrevious={previousTaskNumber !== undefined ? () => goToTask(previousTaskNumber) : undefined}
      onNext={nextTaskNumber !== undefined ? () => goToTask(nextTaskNumber) : undefined}
      onComplete={handleFinishLesson}
      disabled={isStale}
      className={className}
    />
  );

  const overlays = (
    <>
      <CourseOutlineSheet
        open={outlineOpen}
        onOpenChange={setOutlineOpen}
        courseTitle={course.title}
        lessons={outlineLessons}
        access={lessonAccess}
        currentLessonId={lesson.id}
        currentTaskId={task.id}
        isTaskCompleted={isTaskCompleted}
        onSelectLesson={goToLesson}
        onSelectTask={goToTask}
      />
      <LessonCompleteDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        lessonNumber={lesson.lesson_number}
        lessonTitle={lesson.title}
        pointsReward={lesson.points_reward}
        lessonAccess={lessonAccess[lesson.id]}
        onCompleteLesson={async () => {
          const ok = await completeLesson(lesson.id);
          if (ok) {
            toast({
              title: '🎉 Lezione completata!',
              description: `Hai guadagnato ${lesson.points_reward} punti!`,
            });
          }
          return ok;
        }}
        nextLesson={nextOutlineLesson && {
          lesson_number: nextOutlineLesson.lesson_number,
          title: nextOutlineLesson.title,
          access: lessonAccess[nextOutlineLesson.id],
        }}
        onGoToLesson={goToLesson}
        onGoToCourse={() => navigate(`/area-riservata/corso/${courseId}`)}
      />
    </>
  );

  const taskContent = (slidesUrl: string | null) => isStale ? (
    <ContentSkeleton />
  ) : (
    <LessonContent
      title={task.title}
      lessonTitle={lesson.title}
      description={task.description}
      content={task.content}
      contentType={task.content_type || 'text'}
      videoUrl={null}
      slidesUrl={slidesUrl}
      images={[]}
      hideHeading
    />
  );

  // Split layout for Scratch games or for "misto" tasks in courses with a compiler
  if (showScratch || showCompiler) {
    return (
      <div className="h-screen flex flex-col bg-background">
        {header}

        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Left Panel - Task Content */}
          <ResizablePanel defaultSize={showScratch ? 40 : 50} minSize={showScratch ? 25 : 30}>
            <div ref={contentScrollRef} className="h-full overflow-y-auto">
              {taskContent(showScratch ? null : task.slides_url)}
              {navigation('px-6 mt-0')}
            </div>
          </ResizablePanel>

          {/* Resize Handle */}
          <ResizableHandle withHandle />

          {showScratch ? (
            /* Right Panel - Scratch Game */
            <ResizablePanel defaultSize={60} minSize={30}>
              <div className="h-full flex flex-col bg-muted/30">
                <div className="p-4 border-b bg-background">
                  <h3 className="font-semibold flex items-center gap-2">
                    🐱 Scratch - Gioca e Impara
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Clicca sulla bandierina verde per iniziare il gioco!
                  </p>
                </div>
                <div className="flex-1 p-4">
                  <iframe
                    src={getScratchEmbedUrl(task.scratch_url!)}
                    className="w-full h-full rounded-lg border shadow-sm"
                    allowFullScreen
                    title="Scratch Game"
                  />
                </div>
              </div>
            </ResizablePanel>
          ) : (
            /* Right Panel - Compiler */
            <ResizablePanel defaultSize={50} minSize={30}>
              {isPythonCourse && (
                task.python_env === 'turtle' ? (
                  <TurtleCompiler defaultCode={task.default_python_code || undefined} />
                ) : task.python_env === 'pgzero' ? (
                  <PgzeroCompiler defaultCode={task.default_python_code || undefined} replitUrl={task.replit_url || undefined} />
                ) : (
                  <PythonCompiler defaultCode={task.default_python_code || undefined} taskId={task.id} />
                )
              )}
              {isWebCourse && (
                <WebCompiler
                  defaultHtmlCode={task.default_html_code || undefined}
                  defaultCssCode={task.default_css_code || undefined}
                  defaultJsCode={task.default_js_code || undefined}
                  taskId={task.id}
                  taskAttachments={task.attachments}
                />
              )}
            </ResizablePanel>
          )}
        </ResizablePanelGroup>
        {overlays}
      </div>
    );
  }

  // Normal layout for other courses
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-xl border border-border overflow-hidden shadow-sm">
          {header}
        </div>
        {isQuizType ? (
          <>
            {isStale ? <ContentSkeleton /> : (
              <>
                <LessonContent
                  title={task.title}
                  lessonTitle={lesson.title}
                  description={task.description}
                  content={null}
                  contentType={task.content_type || 'text'}
                  videoUrl={null}
                  slidesUrl={null}
                  images={[]}
                  hideHeading
                />
                <div className="px-2 sm:px-6 pb-6">
                  <QuizTask key={task.id} content={task.content} storageKey={task.id} onFinish={() => completeTask(task.id)} />
                </div>
              </>
            )}
          </>
        ) : (
          taskContent(task.slides_url)
        )}
        {navigation()}
      </div>
      {overlays}
    </Layout>
  );
}
