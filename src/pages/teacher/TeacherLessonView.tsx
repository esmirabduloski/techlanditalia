import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePreviewAccess, usePreviewAudience, type PreviewScope } from '@/hooks/useLessonPreview';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { LessonContent } from '@/components/lesson/LessonContent';
import { LessonNavigation } from '@/components/lesson/LessonNavigation';
import { LessonHeader } from '@/components/lesson/LessonHeader';
import { LessonWorkspace } from '@/components/lesson/LessonWorkspace';
import { LessonPageSkeleton } from '@/components/lesson/LessonPageSkeleton';
import { CourseOutlineSheet } from '@/components/lesson/CourseOutlineSheet';
import { AudienceSwitch, EditViewTabs } from '@/components/lesson/ViewModeSwitch';
import { getLessonSidePanel } from '@/components/lesson/taskSidePanel';
import { useCourseOutline, type LessonAccess } from '@/hooks/useCourseOutline';
import { useLessonKeyboardNav } from '@/hooks/useLessonKeyboardNav';
import { getCourseThemeClass } from '@/lib/lessonTheme';

interface Course {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  total_lessons: number;
}

interface Lesson {
  id: string;
  lesson_number: number;
  title: string;
  objective: string | null;
  description: string | null;
  content: string | null;
  content_type: string | null;
  video_url: string | null;
  slides_url: string | null;
  images: string[] | null;
}

const TEACHER_ACCESS: LessonAccess = { completed: false, isNext: false, canComplete: false, accessible: true };

export default function TeacherLessonView() {
  return <LessonPreviewPage scope="teacher" />;
}

/** Lezione senza task in sola lettura: vista insegnante oppure anteprima admin ("Visualizza"). */
export function LessonPreviewPage({ scope }: { scope: PreviewScope }) {
  const { lessonNumber } = useParams<{ lessonNumber: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { hasAccess, isLoading: accessLoading, courseId, basePath, courseHref, deniedHref } = usePreviewAccess(scope);
  const [audience, setAudience] = usePreviewAudience(scope);
  const { lessons: outlineLessons } = useCourseOutline(courseId ?? undefined, null, { includeHiddenTasks: audience === 'teacher' });
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(false);

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
    if (courseId && lessonNumber && hasAccess) {
      fetchData();
    }
  }, [courseId, lessonNumber, hasAccess, audience]);

  const fetchData = async () => {
    if (!courseId || !lessonNumber) return;

    try {
      const { data: courseData } = await supabase
        .from('courses')
        .select('id, slug, title, emoji, total_lessons')
        .eq('id', courseId)
        .maybeSingle();

      if (courseData) {
        setCourse(courseData);
      }

      const { data: lessonData } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .eq('lesson_number', parseInt(lessonNumber))
        .maybeSingle();

      if (lessonData) {
        // Vista studente: solo i task visibili agli alunni
        let firstTaskQuery = supabase
          .from('lesson_tasks')
          .select('task_number')
          .eq('lesson_id', lessonData.id);
        if (audience === 'student') firstTaskQuery = firstTaskQuery.eq('is_visible', true);
        const { data: firstTask } = await firstTaskQuery
          .order('task_number')
          .limit(1)
          .maybeSingle();

        if (firstTask) {
          navigate(`${basePath}/lezione/${lessonNumber}/task/${firstTask.task_number}`, { replace: true });
          return;
        }

        const images = lessonData.images
          ? (Array.isArray(lessonData.images) ? lessonData.images : [])
          : [];
        setLesson({ ...lessonData, images } as Lesson);
      }
    } catch (error) {
      console.error('Error fetching lesson:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToLesson = (newLessonNumber: number) => {
    navigate(`${basePath}/lezione/${newLessonNumber}`);
  };

  useLessonKeyboardNav({
    enabled: !!lesson && !!course,
    onPrevious: lesson && lesson.lesson_number > 1 ? () => navigateToLesson(lesson.lesson_number - 1) : undefined,
    onNext: lesson && course && lesson.lesson_number < course.total_lessons
      ? () => navigateToLesson(lesson.lesson_number + 1)
      : undefined,
  });

  const outlineAccess = useMemo(
    () => Object.fromEntries(outlineLessons.map(l => [l.id, TEACHER_ACCESS])),
    [outlineLessons],
  );

  if (authLoading || accessLoading || (isLoading && !lesson)) {
    return (
      <Layout>
        <LessonPageSkeleton />
      </Layout>
    );
  }

  if (!user || !course || !lesson || !hasAccess) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Lezione non trovata</p>
        </div>
      </Layout>
    );
  }

  const themeClass = getCourseThemeClass(course.slug);

  return (
    <LessonWorkspace
      header={
        <LessonHeader
          courseTitle={course.title}
          courseEmoji={course.emoji}
          lessonNumber={lesson.lesson_number}
          lessonTitle={lesson.title}
          onBack={() => navigate(courseHref)}
          onOpenOutline={outlineLessons.length > 0 ? () => setOutlineOpen(true) : undefined}
          modeSwitch={
            scope === 'admin' ? (
              <EditViewTabs mode="view" onEdit={() => navigate(`/admin/corsi/${course.id}/lezioni/${lesson.id}/modifica`)} />
            ) : (
              <AudienceSwitch value={audience} onChange={setAudience} />
            )
          }
        />
      }
      content={
        <LessonContent
          title={lesson.title}
          objective={lesson.objective}
          description={lesson.description}
          content={lesson.content}
          contentType={lesson.content_type || 'text'}
          videoUrl={lesson.video_url}
          slidesUrl={lesson.slides_url}
          images={lesson.images || []}
          hideHeading
        />
      }
      renderNavigation={variant => (
        <LessonNavigation
          courseId={course.id}
          currentLessonNumber={lesson.lesson_number}
          totalLessons={course.total_lessons}
          onPrevious={lesson.lesson_number > 1 ? () => navigateToLesson(lesson.lesson_number - 1) : undefined}
          onNext={lesson.lesson_number < course.total_lessons ? () => navigateToLesson(lesson.lesson_number + 1) : undefined}
          basePath={basePath}
          courseHref={courseHref}
          className={variant === 'split' ? 'px-6 mt-0' : undefined}
        />
      )}
      sidePanel={getLessonSidePanel(course.slug)}
      layoutId="teacher-split-code"
      resetKey={lesson.id}
      themeClass={themeClass}
      overlays={
        <CourseOutlineSheet
          open={outlineOpen}
          onOpenChange={setOutlineOpen}
          courseTitle={course.title}
          lessons={outlineLessons}
          access={outlineAccess}
          currentLessonId={lesson.id}
          isTaskCompleted={() => false}
          onSelectLesson={navigateToLesson}
          onSelectTask={taskNumber => navigate(`${basePath}/lezione/${lesson.lesson_number}/task/${taskNumber}`)}
          className={themeClass}
        />
      }
    />
  );
}
