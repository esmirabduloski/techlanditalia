import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTeacherCourseAccess } from '@/hooks/useTeacherCourseAccess';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { LessonContent } from '@/components/lesson/LessonContent';
import { LessonNavigation } from '@/components/lesson/LessonNavigation';
import { LessonHeader } from '@/components/lesson/LessonHeader';
import { LessonWorkspace } from '@/components/lesson/LessonWorkspace';
import { LessonPageSkeleton } from '@/components/lesson/LessonPageSkeleton';
import { CourseOutlineSheet } from '@/components/lesson/CourseOutlineSheet';
import { getLessonSidePanel } from '@/components/lesson/taskSidePanel';
import { useCourseOutline, type LessonAccess } from '@/hooks/useCourseOutline';
import { useLessonKeyboardNav } from '@/hooks/useLessonKeyboardNav';
import { Badge } from '@/components/ui/badge';
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
  description: string | null;
  content: string | null;
  content_type: string | null;
  video_url: string | null;
  slides_url: string | null;
  images: string[] | null;
}

const TEACHER_ACCESS: LessonAccess = { completed: false, isNext: false, canComplete: false, accessible: true };

export default function TeacherLessonView() {
  const { courseSlug, lessonNumber } = useParams<{ courseSlug: string; lessonNumber: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { hasAccess, isLoading: accessLoading, courseId } = useTeacherCourseAccess(courseSlug);
  const { lessons: outlineLessons } = useCourseOutline(courseId ?? undefined, null, { includeHiddenTasks: true });
  const navigate = useNavigate();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!accessLoading && !hasAccess && user) {
      navigate('/insegnante');
    }
  }, [hasAccess, accessLoading, user, navigate]);

  useEffect(() => {
    if (courseSlug && courseId && lessonNumber && hasAccess) {
      fetchData();
    }
  }, [courseSlug, courseId, lessonNumber, hasAccess]);

  const fetchData = async () => {
    if (!courseSlug || !courseId || !lessonNumber) return;

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
        const { data: firstTask } = await supabase
          .from('lesson_tasks')
          .select('task_number')
          .eq('lesson_id', lessonData.id)
          .order('task_number')
          .limit(1)
          .maybeSingle();

        if (firstTask) {
          navigate(`/insegnante/corso/${courseSlug}/lezione/${lessonNumber}/task/${firstTask.task_number}`, { replace: true });
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
    navigate(`/insegnante/corso/${courseSlug}/lezione/${newLessonNumber}`);
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
  const basePath = `/insegnante/corso/${courseSlug}`;

  return (
    <LessonWorkspace
      header={
        <LessonHeader
          courseTitle={course.title}
          courseEmoji={course.emoji}
          lessonNumber={lesson.lesson_number}
          lessonTitle={lesson.title}
          onBack={() => navigate(basePath)}
          onOpenOutline={outlineLessons.length > 0 ? () => setOutlineOpen(true) : undefined}
          actions={<Badge variant="outline" className="hidden sm:inline-flex mr-1">Vista Insegnante</Badge>}
        />
      }
      content={
        <LessonContent
          title={lesson.title}
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
