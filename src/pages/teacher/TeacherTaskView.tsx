import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePreviewAccess, usePreviewAudience, type PreviewScope } from '@/hooks/useLessonPreview';
import { useCourseOutline, type LessonAccess } from '@/hooks/useCourseOutline';
import { useLessonKeyboardNav } from '@/hooks/useLessonKeyboardNav';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { LessonContent } from '@/components/lesson/LessonContent';
import { LessonHeader } from '@/components/lesson/LessonHeader';
import { LessonWorkspace } from '@/components/lesson/LessonWorkspace';
import { LessonPageSkeleton } from '@/components/lesson/LessonPageSkeleton';
import { TaskNavigation } from '@/components/lesson/TaskNavigation';
import { CourseOutlineSheet } from '@/components/lesson/CourseOutlineSheet';
import { AudienceSwitch, EditViewTabs } from '@/components/lesson/ViewModeSwitch';
import { getTaskSidePanel, type TaskAttachment } from '@/components/lesson/taskSidePanel';
import { QuizTask } from '@/components/lesson/QuizTask';
import { Skeleton } from '@/components/ui/skeleton';
import { EyeOff } from 'lucide-react';
import { getCourseThemeClass } from '@/lib/lessonTheme';

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
  objective: string | null;
}

interface TaskSummary {
  id: string;
  task_number: number;
  title: string;
  content_type: string | null;
  is_visible: boolean;
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
  default_python_code: string | null;
  default_html_code: string | null;
  default_css_code: string | null;
  default_js_code: string | null;
  python_env: string | null;
  replit_url: string | null;
  is_visible: boolean;
  attachments: TaskAttachment[];
}

const TEACHER_ACCESS: LessonAccess = { completed: false, isNext: false, canComplete: false, accessible: true };

export default function TeacherTaskView() {
  return <TaskPreviewPage scope="teacher" />;
}

/** Task in sola lettura: vista insegnante oppure anteprima admin ("Visualizza"). */
export function TaskPreviewPage({ scope }: { scope: PreviewScope }) {
  const { lessonNumber, taskNumber } = useParams<{ lessonNumber: string; taskNumber: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { hasAccess, isLoading: accessLoading, courseId, basePath, courseHref, deniedHref } = usePreviewAccess(scope);
  const [audience, setAudience] = usePreviewAudience(scope);
  const { lessons: outlineLessons } = useCourseOutline(courseId ?? undefined, null, { includeHiddenTasks: audience === 'teacher' });
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);

  // Come in TaskView: ignora risposte in ritardo e non mostra il task precedente durante il caricamento
  const requestKey = `${courseId}/${lessonNumber}/${taskNumber}`;
  const latestRequest = useRef(requestKey);
  const isStale = loadedKey !== requestKey;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(scope === 'admin' ? deniedHref : '/auth');
    }
  }, [user, authLoading, navigate, scope, deniedHref]);

  useEffect(() => {
    if (!accessLoading && !hasAccess && user) {
      navigate(deniedHref);
    }
  }, [hasAccess, accessLoading, user, navigate, deniedHref]);

  useEffect(() => {
    if (courseId && lessonNumber && taskNumber && hasAccess) {
      fetchData();
    }
  }, [courseId, lessonNumber, taskNumber, hasAccess]);

  const fetchData = async () => {
    if (!courseId || !lessonNumber || !taskNumber) return;
    const key = `${courseId}/${lessonNumber}/${taskNumber}`;
    latestRequest.current = key;
    const isCurrent = () => latestRequest.current === key;

    try {
      const { data: courseData } = await supabase
        .from('courses')
        .select('id, slug, title, emoji')
        .eq('id', courseId)
        .maybeSingle();
      if (!isCurrent()) return;

      if (courseData) {
        setCourse(courseData);
      }

      const { data: lessonData } = await supabase
        .from('lessons')
        .select('id, lesson_number, title, objective')
        .eq('course_id', courseId)
        .eq('lesson_number', parseInt(lessonNumber))
        .maybeSingle();
      if (!isCurrent()) return;

      setLesson(lessonData);
      if (!lessonData) {
        setTask(null);
        return;
      }

      // Tutti i task, anche quelli nascosti: la vista studente li filtra dopo
      const { data: tasksData } = await supabase
        .from('lesson_tasks')
        .select('id, task_number, title, content_type, is_visible')
        .eq('lesson_id', lessonData.id)
        .order('task_number');
      if (!isCurrent()) return;

      setTasks((tasksData || []) as TaskSummary[]);

      const { data: taskData } = await supabase
        .from('lesson_tasks')
        .select('*')
        .eq('lesson_id', lessonData.id)
        .eq('task_number', parseInt(taskNumber))
        .maybeSingle();
      if (!isCurrent()) return;

      if (taskData) {
        let attachments: TaskAttachment[] = [];
        try {
          const rawAttachments = (taskData as { attachments?: unknown }).attachments;
          if (Array.isArray(rawAttachments)) {
            attachments = rawAttachments as TaskAttachment[];
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

  const navigateToTask = (newTaskNumber: number) => {
    navigate(`${basePath}/lezione/${lessonNumber}/task/${newTaskNumber}`);
  };

  const navigateToLesson = (newLessonNumber: number) => {
    navigate(`${basePath}/lezione/${newLessonNumber}`);
  };

  const handleNavigateToCourse = () => {
    navigate(courseHref);
  };

  // Vista studente: solo i task visibili agli alunni. Quello aperto resta nell'elenco
  // anche se nascosto (es. anteprima dall'editor), con un avviso sopra il contenuto.
  const shownTasks = audience === 'teacher'
    ? tasks
    : tasks.filter(t => t.is_visible || t.task_number === task?.task_number);

  // Navigazione per posizione: le task possono partire da 0 (es. quiz di ripasso)
  const currentIndex = task ? shownTasks.findIndex(t => t.task_number === task.task_number) : -1;
  const previousTaskNumber = currentIndex > 0 ? shownTasks[currentIndex - 1].task_number : undefined;
  const nextTaskNumber = currentIndex >= 0 && currentIndex < shownTasks.length - 1 ? shownTasks[currentIndex + 1].task_number : undefined;

  useLessonKeyboardNav({
    enabled: !!task && !isStale,
    onPrevious: previousTaskNumber !== undefined ? () => navigateToTask(previousTaskNumber) : undefined,
    onNext: nextTaskNumber !== undefined ? () => navigateToTask(nextTaskNumber) : undefined,
  });

  const outlineAccess = useMemo(
    () => Object.fromEntries(outlineLessons.map(l => [l.id, TEACHER_ACCESS])),
    [outlineLessons],
  );

  if (authLoading || accessLoading || (isLoading && !task)) {
    return (
      <Layout>
        <LessonPageSkeleton />
      </Layout>
    );
  }

  if (!user || !course || !lesson || !task || !hasAccess) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Task non trovato</p>
        </div>
      </Layout>
    );
  }

  const displayPosition = currentIndex >= 0 ? currentIndex + 1 : 1;
  const totalTasks = shownTasks.length || 1;
  const isQuizType = task.content_type === 'quiz';
  const showScratch = task.content_type === 'scratch' && !!task.scratch_url;
  const themeClass = getCourseThemeClass(course.slug);
  const outlineIndex = outlineLessons.findIndex(l => l.id === lesson.id);
  const nextLesson = outlineIndex >= 0 ? outlineLessons[outlineIndex + 1] : undefined;

  const header = (
    <LessonHeader
      courseTitle={course.title}
      courseEmoji={course.emoji}
      lessonNumber={lesson.lesson_number}
      lessonTitle={lesson.title}
      lessonObjective={lesson.objective}
      taskTitle={task.title}
      taskPosition={displayPosition}
      taskType={task.content_type}
      steps={shownTasks.map(t => ({
        key: t.id,
        title: t.title,
        completed: false,
        current: t.task_number === task.task_number,
        contentType: t.content_type,
        onSelect: () => navigateToTask(t.task_number),
      }))}
      onBack={handleNavigateToCourse}
      onOpenOutline={outlineLessons.length > 0 ? () => setOutlineOpen(true) : undefined}
      modeSwitch={
        scope === 'admin' ? (
          <EditViewTabs mode="view" onEdit={() => navigate(`/admin/corsi/${course.id}/lezioni/${lesson.id}/task/${task.id}/modifica`)} />
        ) : (
          <AudienceSwitch value={audience} onChange={setAudience} />
        )
      }
    />
  );

  const content = isStale ? (
    <div className="p-6 space-y-4" aria-busy="true" aria-label="Caricamento task">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-40 w-full" />
    </div>
  ) : (
    <>
      {!task.is_visible && (
        <div className="mx-2 sm:mx-6 mt-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          <EyeOff className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Task nascosto: gli studenti non lo vedono finché non viene reso visibile.</span>
        </div>
      )}
      <LessonContent
        title={task.title}
        lessonTitle={lesson.title}
        description={task.description}
        objective={displayPosition === 1 ? lesson.objective : null}
        content={isQuizType ? null : task.content}
        contentType={task.content_type || 'text'}
        videoUrl={null}
        slidesUrl={isQuizType || showScratch ? null : task.slides_url}
        images={[]}
        hideHeading
      />
      {isQuizType && (
        <div className="px-2 sm:px-6 pb-6">
          {audience === 'teacher' ? (
            <QuizTask key={`${task.id}:teacher`} content={task.content} storageKey={`teacher:${task.id}`} teacherMode />
          ) : (
            // Quiz giocabile come lo studente, con risposte salvate a parte (non contano come completamento)
            <QuizTask key={`${task.id}:student`} content={task.content} storageKey={`anteprima:${task.id}`} />
          )}
        </div>
      )}
    </>
  );

  return (
    <LessonWorkspace
      header={header}
      content={content}
      renderNavigation={variant => (
        <TaskNavigation
          courseId={course.id}
          lessonNumber={lesson.lesson_number}
          currentTaskNumber={displayPosition}
          totalTasks={totalTasks}
          onPrevious={previousTaskNumber !== undefined ? () => navigateToTask(previousTaskNumber) : undefined}
          onNext={nextTaskNumber !== undefined ? () => navigateToTask(nextTaskNumber) : undefined}
          // Ultimo task: l'insegnante passa direttamente alla lezione successiva
          onComplete={nextLesson ? () => navigateToLesson(nextLesson.lesson_number) : handleNavigateToCourse}
          basePath={basePath}
          disabled={isStale}
          className={variant === 'split' ? 'px-6 mt-0' : undefined}
        />
      )}
      sidePanel={getTaskSidePanel(course.slug, task, { saveDrafts: false })}
      layoutId={`teacher-split-${showScratch ? 'scratch' : 'code'}`}
      resetKey={task.id}
      themeClass={themeClass}
      overlays={
        <CourseOutlineSheet
          open={outlineOpen}
          onOpenChange={setOutlineOpen}
          courseTitle={course.title}
          lessons={outlineLessons}
          access={outlineAccess}
          currentLessonId={lesson.id}
          currentTaskId={task.id}
          isTaskCompleted={() => false}
          onSelectLesson={navigateToLesson}
          onSelectTask={navigateToTask}
          className={themeClass}
        />
      }
    />
  );
}
