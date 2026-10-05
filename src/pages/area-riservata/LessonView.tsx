import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useStudentProgress } from '@/hooks/useStudentProgress';
import { computeLessonAccess, useCourseOutline } from '@/hooks/useCourseOutline';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { LessonContent } from '@/components/lesson/LessonContent';
import { LessonNavigation } from '@/components/lesson/LessonNavigation';
import { LessonHeader } from '@/components/lesson/LessonHeader';
import { CourseOutlineSheet } from '@/components/lesson/CourseOutlineSheet';
import { BookmarkButton } from '@/components/dashboard/BookmarkButton';
import { LessonWorkspace } from '@/components/lesson/LessonWorkspace';
import { getLessonSidePanel } from '@/components/lesson/taskSidePanel';
import { useLessonKeyboardNav } from '@/hooks/useLessonKeyboardNav';
import { Skeleton } from '@/components/ui/skeleton';
import { LessonPageSkeleton } from '@/components/lesson/LessonPageSkeleton';
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
  points_reward: number;
}


export default function LessonView() {
  const { courseId, lessonNumber } = useParams<{ courseId: string; lessonNumber: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { trackLessonStart, trackLessonComplete, startLessonTimer, getLessonTime } = useAnalytics();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const { isTaskCompleted, lessonProgress, effectiveUserId } = useStudentProgress();
  const { lessons: outlineLessons, schedule } = useCourseOutline(courseId, effectiveUserId);
  const navigate = useNavigate();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const lessonTracked = useRef(false);

  // Il componente resta montato passando da una lezione all'altra: ignoriamo le
  // risposte in ritardo e non mostriamo la lezione precedente mentre carica.
  const requestKey = `${courseId}/${lessonNumber}`;
  const latestRequest = useRef(requestKey);
  const isStale = loadedKey !== requestKey;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (courseId && lessonNumber) {
      fetchData();
    }
  }, [courseId, lessonNumber]);

  const fetchData = async () => {
    if (!courseId || !lessonNumber) return;
    const key = `${courseId}/${lessonNumber}`;
    latestRequest.current = key;
    const isCurrent = () => latestRequest.current === key;

    try {
      // Fetch course
      const { data: courseData } = await supabase
        .from('courses')
        .select('id, slug, title, emoji, total_lessons')
        .eq('id', courseId)
        .maybeSingle();
      if (!isCurrent()) return;

      if (courseData) {
        setCourse(courseData);
      }

      // Fetch lesson by lesson_number
      const { data: lessonData } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .eq('lesson_number', parseInt(lessonNumber))
        .maybeSingle();
      if (!isCurrent()) return;

      if (!lessonData) {
        setLesson(null);
      } else {
        // Check if lesson has visible tasks
        const { data: visibleTasks } = await supabase
          .from('lesson_tasks')
          .select('task_number')
          .eq('lesson_id', lessonData.id)
          .eq('is_visible', true)
          .order('task_number')
          .limit(1);
        if (!isCurrent()) return;

        // If lesson has visible tasks, redirect to the first visible one
        if (visibleTasks && visibleTasks.length > 0) {
          navigate(`/area-riservata/corso/${courseId}/lezione/${lessonNumber}/task/${visibleTasks[0].task_number}`, { replace: true });
          return;
        }

        // Parse images from JSONB
        const images = lessonData.images 
          ? (Array.isArray(lessonData.images) ? lessonData.images : [])
          : [];
        setLesson({ ...lessonData, images } as Lesson);
      }
    } catch (error) {
      console.error('Error fetching lesson:', error);
    } finally {
      if (isCurrent()) {
        setIsLoading(false);
        setLoadedKey(key);
      }
    }
  };

  const lessonAccess = useMemo(
    () => computeLessonAccess(outlineLessons, new Set(lessonProgress.map(p => p.lesson_id)), schedule),
    [outlineLessons, lessonProgress, schedule],
  );

  // Track lesson start
  useEffect(() => {
    if (lesson && course && !lessonTracked.current) {
      lessonTracked.current = true;
      startLessonTimer();
      trackLessonStart(lesson.id, lesson.title, course.id);
    }
  }, [lesson, course, startLessonTimer, trackLessonStart]);

  // Track lesson time on unmount or navigation
  useEffect(() => {
    return () => {
      if (lesson && course && lessonTracked.current) {
        const timeSpent = getLessonTime();
        if (timeSpent > 5) { // Only track if spent more than 5 seconds
          trackLessonComplete(lesson.id, lesson.title, course.id, timeSpent);
        }
      }
    };
  }, [lesson, course, getLessonTime, trackLessonComplete]);

  const navigateToLesson = (newLessonNumber: number) => {
    // Track current lesson before navigating
    if (lesson && course) {
      const timeSpent = getLessonTime();
      if (timeSpent > 5) {
        trackLessonComplete(lesson.id, lesson.title, course.id, timeSpent);
      }
    }
    lessonTracked.current = false;
    navigate(`/area-riservata/corso/${courseId}/lezione/${newLessonNumber}`);
  };

  // Frecce ← → tra le lezioni (gli hook vanno prima dei return)
  useLessonKeyboardNav({
    enabled: !!lesson && !!course && !isStale,
    onPrevious: lesson && lesson.lesson_number > 1 ? () => navigateToLesson(lesson.lesson_number - 1) : undefined,
    onNext: lesson && course && lesson.lesson_number < course.total_lessons
      ? () => navigateToLesson(lesson.lesson_number + 1)
      : undefined,
  });

  if (authLoading || (isLoading && !lesson)) {
    return (
      <Layout>
        <LessonPageSkeleton />
      </Layout>
    );
  }

  if (!user || !course || !lesson) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Lezione non trovata</p>
        </div>
      </Layout>
    );
  }

  const themeClass = getCourseThemeClass(course.slug);

  const header = (
    <LessonHeader
      courseTitle={course.title}
      courseEmoji={course.emoji}
      lessonNumber={lesson.lesson_number}
      lessonTitle={lesson.title}
      onBack={() => navigate(`/area-riservata/corso/${courseId}`)}
      onOpenOutline={outlineLessons.length > 0 ? () => setOutlineOpen(true) : undefined}
      actions={
        <BookmarkButton
          isBookmarked={isBookmarked('lesson', lesson.id)}
          onToggle={() => toggleBookmark('lesson', lesson.id, course.id)}
          size="sm"
        />
      }
    />
  );

  const content = isStale ? (
    <div className="p-6 space-y-4" aria-busy="true" aria-label="Caricamento lezione">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-40 w-full" />
    </div>
  ) : (
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
  );

  const navigation = (className?: string) => (
    <LessonNavigation
      courseId={course.id}
      currentLessonNumber={lesson.lesson_number}
      totalLessons={course.total_lessons}
      onPrevious={lesson.lesson_number > 1 ? () => navigateToLesson(lesson.lesson_number - 1) : undefined}
      onNext={lesson.lesson_number < course.total_lessons ? () => navigateToLesson(lesson.lesson_number + 1) : undefined}
      className={className}
    />
  );

  const outline = (
    <CourseOutlineSheet
      open={outlineOpen}
      onOpenChange={setOutlineOpen}
      courseTitle={course.title}
      lessons={outlineLessons}
      access={lessonAccess}
      currentLessonId={lesson.id}
      isTaskCompleted={isTaskCompleted}
      onSelectLesson={navigateToLesson}
      onSelectTask={(taskNumber) => navigate(`/area-riservata/corso/${courseId}/lezione/${lesson.lesson_number}/task/${taskNumber}`)}
      className={themeClass}
    />
  );

  return (
    <LessonWorkspace
      header={header}
      content={content}
      renderNavigation={variant => navigation(variant === 'split' ? 'px-6 mt-0' : undefined)}
      sidePanel={getLessonSidePanel(course.slug)}
      layoutId="lesson-split-code"
      resetKey={lesson.id}
      themeClass={themeClass}
      overlays={outline}
    />
  );
}
