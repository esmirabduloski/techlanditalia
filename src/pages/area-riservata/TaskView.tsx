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
import { LessonWorkspace } from '@/components/lesson/LessonWorkspace';
import { getTaskSidePanel, type TaskAttachment } from '@/components/lesson/taskSidePanel';
import { useLessonKeyboardNav } from '@/hooks/useLessonKeyboardNav';
import { QuizTask } from '@/components/lesson/QuizTask';
import { Skeleton } from '@/components/ui/skeleton';
import { LessonPageSkeleton } from '@/components/lesson/LessonPageSkeleton';
import { getCourseThemeClass } from '@/lib/lessonTheme';
import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Course {
  id: string;
  slug: string;
  title: string;
  emoji: string;
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
  content_type: string | null;
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
  const { isTaskCompleted, completeTask, completeLesson, lessonProgress, effectiveUserId, isLoading: progressLoading } = useStudentProgress();
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
  const [pointsGained, setPointsGained] = useState<{ id: number; points: number } | null>(null);

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

  const fetchData = async () => {
    if (!courseId || !lessonNumber || !taskNumber) return;
    const key = `${courseId}/${lessonNumber}/${taskNumber}`;
    latestRequest.current = key;
    const isCurrent = () => latestRequest.current === key;

    try {
      // Fetch course
      const { data: courseData } = await supabase
        .from('courses')
        .select('id, slug, title, emoji')
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
        .select('id, task_number, title, content_type')
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

  /**
   * Segna il task come completato e, se è la prima volta, mostra i punti guadagnati:
   * "+N" animato nell'intestazione, oppure un toast se lo stepper non è visibile.
   */
  const completeWithFeedback = async (target: Task, feedback: 'pop' | 'toast') => {
    // Finché i progressi non sono caricati non sappiamo se il task era già fatto
    const isFirstCompletion = !progressLoading && !isTaskCompleted(target.id);
    const ok = await completeTask(target.id);
    if (!ok || !isFirstCompletion || !target.points_reward) return;
    if (feedback === 'pop' && visibleTasks.length > 1) {
      setPointsGained({ id: Date.now(), points: target.points_reward });
    } else {
      toast({ title: `+${target.points_reward} punti ⚡`, description: `Task completato: ${target.title}` });
    }
  };

  const goToTask = (newTaskNumber: number) => {
    // Andando avanti il task corrente viene segnato come completato.
    // Non blocchiamo la navigazione in attesa del salvataggio.
    if (task && newTaskNumber > task.task_number) {
      void completeWithFeedback(task, 'pop');
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
      void completeWithFeedback(task, 'toast');
    }
    setCompleteDialogOpen(true);
  };

  const lessonAccess = useMemo(
    () => computeLessonAccess(outlineLessons, new Set(lessonProgress.map(p => p.lesson_id)), schedule),
    [outlineLessons, lessonProgress, schedule],
  );

  const taskCompleted = task ? isTaskCompleted(task.id) : false;

  // Frecce ← → tra i task visibili (calcolate qui: gli hook vanno prima dei return)
  const keyboardIndex = task ? visibleTasks.findIndex(t => t.task_number === task.task_number) : -1;
  useLessonKeyboardNav({
    enabled: !!task && !isStale,
    onPrevious: keyboardIndex > 0 ? () => goToTask(visibleTasks[keyboardIndex - 1].task_number) : undefined,
    onNext: keyboardIndex >= 0 && keyboardIndex < visibleTasks.length - 1
      ? () => goToTask(visibleTasks[keyboardIndex + 1].task_number)
      : undefined,
  });

  if (authLoading || (isLoading && !task)) {
    return (
      <Layout>
        <LessonPageSkeleton />
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

  // Navigation among visible tasks only
  const currentIndex = visibleTasks.findIndex(t => t.task_number === task.task_number);
  const previousTaskNumber = currentIndex > 0 ? visibleTasks[currentIndex - 1].task_number : undefined;
  const nextTaskNumber = currentIndex >= 0 && currentIndex < visibleTasks.length - 1
    ? visibleTasks[currentIndex + 1].task_number
    : undefined;
  const displayPosition = currentIndex >= 0 ? currentIndex + 1 : 1;
  const totalTasks = visibleTasks.length || 1;
  const showScratch = task.content_type === 'scratch' && !!task.scratch_url;
  const isQuizType = task.content_type === 'quiz';

  const themeClass = getCourseThemeClass(course.slug);
  const outlineIndex = outlineLessons.findIndex(l => l.id === lesson.id);
  const nextOutlineLesson = outlineIndex >= 0 ? outlineLessons[outlineIndex + 1] : undefined;

  const header = (
    <LessonHeader
      courseTitle={course.title}
      courseEmoji={course.emoji}
      lessonNumber={lesson.lesson_number}
      lessonTitle={lesson.title}
      taskTitle={task.title}
      taskPosition={displayPosition}
      taskType={task.content_type}
      pointsGained={pointsGained}
      steps={visibleTasks.map(t => ({
        key: t.id,
        title: t.title,
        completed: isTaskCompleted(t.id),
        current: t.task_number === task.task_number,
        contentType: t.content_type,
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
        className={themeClass}
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
        className={themeClass}
      />
    </>
  );

  const sidePanel = getTaskSidePanel(course.slug, task, { saveDrafts: true });

  const content = isStale ? (
    <ContentSkeleton />
  ) : (
    <>
      <LessonContent
        title={task.title}
        lessonTitle={lesson.title}
        description={task.description}
        content={isQuizType ? null : task.content}
        contentType={task.content_type || 'text'}
        videoUrl={null}
        slidesUrl={isQuizType || showScratch ? null : task.slides_url}
        images={[]}
        hideHeading
      />
      {isQuizType && (
        <div className="px-2 sm:px-6 pb-6">
          <QuizTask key={task.id} content={task.content} storageKey={task.id} onFinish={() => completeWithFeedback(task, 'pop')} />
        </div>
      )}
    </>
  );

  return (
    <LessonWorkspace
      header={header}
      content={content}
      renderNavigation={variant => navigation(variant === 'split' ? 'px-6 mt-0' : undefined)}
      sidePanel={sidePanel}
      layoutId={`lesson-split-${showScratch ? 'scratch' : 'code'}`}
      resetKey={task.id}
      themeClass={themeClass}
      overlays={overlays}
    />
  );
}
