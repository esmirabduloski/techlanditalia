import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTeacherCourseAccess } from '@/hooks/useTeacherCourseAccess';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { LessonContent } from '@/components/lesson/LessonContent';
import { LessonNavigation } from '@/components/lesson/LessonNavigation';
import { PythonCompiler } from '@/components/lesson/PythonCompiler';
import { WebCompiler } from '@/components/lesson/WebCompiler';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft } from 'lucide-react';

interface Course {
  id: string;
  slug: string;
  title: string;
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

const PYTHON_COURSES = ['python-base', 'python-ai'];
const WEB_COURSES = ['web-development'];
const SPLIT_LAYOUT_COURSES = [...PYTHON_COURSES, ...WEB_COURSES];

export default function TeacherLessonView() {
  const { courseSlug, lessonNumber } = useParams<{ courseSlug: string; lessonNumber: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { hasAccess, isLoading: accessLoading, courseId } = useTeacherCourseAccess(courseSlug);
  const navigate = useNavigate();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        .select('id, slug, title, total_lessons')
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
        const { count } = await supabase
          .from('lesson_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('lesson_id', lessonData.id);

        if (count && count > 0) {
          navigate(`/insegnante/corso/${courseSlug}/lezione/${lessonNumber}/task/1`, { replace: true });
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

  if (authLoading || accessLoading || isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
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

  const isSplitLayout = SPLIT_LAYOUT_COURSES.includes(course.slug);
  const isPythonCourse = PYTHON_COURSES.includes(course.slug);
  const isWebCourse = WEB_COURSES.includes(course.slug);

  if (isSplitLayout) {
    return (
      <div className="h-screen flex flex-col bg-background">
        {/* Header with back button */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-background">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/insegnante/corso/${courseSlug}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{course.title}</span>
              <Badge variant="outline">Vista Insegnante</Badge>
            </div>
            <h1 className="font-semibold">Lezione {lesson.lesson_number}: {lesson.title}</h1>
          </div>
        </div>

        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full overflow-y-auto">
              <LessonContent
                title={lesson.title}
                description={lesson.description}
                content={lesson.content}
                contentType={lesson.content_type || 'text'}
                videoUrl={lesson.video_url}
                slidesUrl={lesson.slides_url}
                images={lesson.images || []}
              />
              <div className="px-6 pb-6">
                <LessonNavigation
                  courseId={course.id}
                  currentLessonNumber={lesson.lesson_number}
                  totalLessons={course.total_lessons}
                  onPrevious={lesson.lesson_number > 1 ? () => navigateToLesson(lesson.lesson_number - 1) : undefined}
                  onNext={lesson.lesson_number < course.total_lessons ? () => navigateToLesson(lesson.lesson_number + 1) : undefined}
                  basePath={`/insegnante/corso/${courseSlug}`}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={50} minSize={30}>
            {isPythonCourse && <PythonCompiler />}
            {isWebCourse && <WebCompiler />}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate(`/insegnante/corso/${courseSlug}`)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Torna al corso
        </Button>
        <Badge variant="outline" className="mb-4">Vista Insegnante</Badge>
        <LessonContent
          title={lesson.title}
          description={lesson.description}
          content={lesson.content}
          contentType={lesson.content_type || 'text'}
          videoUrl={lesson.video_url}
          slidesUrl={lesson.slides_url}
          images={lesson.images || []}
        />
        <LessonNavigation
          courseId={course.id}
          currentLessonNumber={lesson.lesson_number}
          totalLessons={course.total_lessons}
          onPrevious={lesson.lesson_number > 1 ? () => navigateToLesson(lesson.lesson_number - 1) : undefined}
          onNext={lesson.lesson_number < course.total_lessons ? () => navigateToLesson(lesson.lesson_number + 1) : undefined}
          basePath={`/insegnante/corso/${courseSlug}`}
        />
      </div>
    </Layout>
  );
}