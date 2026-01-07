import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStudentProgress } from '@/hooks/useStudentProgress';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { LessonContent } from '@/components/lesson/LessonContent';
import { TaskNavigation } from '@/components/lesson/TaskNavigation';
import { PythonCompiler } from '@/components/lesson/PythonCompiler';
import { WebCompiler } from '@/components/lesson/WebCompiler';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
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
}

interface Task {
  id: string;
  task_number: number;
  title: string;
  description: string | null;
  content: string | null;
  content_type: string | null;
  slides_url: string | null;
  points_reward: number;
  default_python_code: string | null;
  default_html_code: string | null;
  default_css_code: string | null;
  default_js_code: string | null;
}

const PYTHON_COURSES = ['python-base', 'python-ai'];
const WEB_COURSES = ['web-development'];
const SPLIT_LAYOUT_COURSES = [...PYTHON_COURSES, ...WEB_COURSES];

export default function TaskView() {
  const { courseId, lessonNumber, taskNumber } = useParams<{ courseId: string; lessonNumber: string; taskNumber: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { isTaskCompleted, completeTask } = useStudentProgress();
  const navigate = useNavigate();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [totalTasks, setTotalTasks] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

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

    try {
      // Fetch course
      const { data: courseData } = await supabase
        .from('courses')
        .select('id, slug, title')
        .eq('id', courseId)
        .maybeSingle();

      if (courseData) {
        setCourse(courseData);
      }

      // Fetch lesson by lesson_number
      const { data: lessonData } = await supabase
        .from('lessons')
        .select('id, lesson_number, title')
        .eq('course_id', courseId)
        .eq('lesson_number', parseInt(lessonNumber))
        .maybeSingle();

      if (lessonData) {
        setLesson(lessonData);

        // Fetch total tasks count
        const { count } = await supabase
          .from('lesson_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('lesson_id', lessonData.id);

        setTotalTasks(count || 0);

        // Fetch the specific task
        const { data: taskData } = await supabase
          .from('lesson_tasks')
          .select('*')
          .eq('lesson_id', lessonData.id)
          .eq('task_number', parseInt(taskNumber))
          .maybeSingle();

        if (taskData) {
          setTask(taskData);
        }
      }
    } catch (error) {
      console.error('Error fetching task:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToTask = async (newTaskNumber: number) => {
    // Mark current task as completed when navigating to next
    if (task && newTaskNumber > task.task_number) {
      await completeTask(task.id);
    }
    navigate(`/area-riservata/corso/${courseId}/lezione/${lessonNumber}/task/${newTaskNumber}`);
  };

  const handleNavigateToCourse = async () => {
    // Mark last task as completed when going back to course
    if (task) {
      await completeTask(task.id);
    }
    navigate(`/area-riservata/corso/${courseId}`);
  };

  const taskCompleted = task ? isTaskCompleted(task.id) : false;

  if (authLoading || isLoading) {
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
  const isMistoType = task.content_type === 'misto';
  const showCompiler = (isPythonCourse || isWebCourse) && isMistoType;

  // Split layout only when task is of type "misto" and course supports compiler
  if (showCompiler) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Left Panel - Task Content */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full overflow-y-auto">
              <LessonContent
                title={task.title}
                description={task.description}
                content={task.content}
                contentType={task.content_type || 'text'}
                videoUrl={null}
                slidesUrl={task.slides_url}
                images={[]}
              />
              <div className="px-6 pb-6">
                {taskCompleted && (
                  <Badge variant="outline" className="mb-4 text-primary border-primary">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Task completato
                  </Badge>
                )}
                <TaskNavigation
                  courseId={course.id}
                  lessonNumber={lesson.lesson_number}
                  currentTaskNumber={task.task_number}
                  totalTasks={totalTasks}
                  onPrevious={task.task_number > 1 ? () => navigateToTask(task.task_number - 1) : undefined}
                  onNext={task.task_number < totalTasks ? () => navigateToTask(task.task_number + 1) : undefined}
                  onComplete={handleNavigateToCourse}
                />
              </div>
            </div>
          </ResizablePanel>

          {/* Resize Handle */}
          <ResizableHandle withHandle />

          {/* Right Panel - Compiler */}
          <ResizablePanel defaultSize={50} minSize={30}>
            {isPythonCourse && <PythonCompiler defaultCode={task.default_python_code || undefined} taskId={task.id} />}
            {isWebCourse && (
              <WebCompiler 
                defaultHtmlCode={task.default_html_code || undefined}
                defaultCssCode={task.default_css_code || undefined}
                defaultJsCode={task.default_js_code || undefined}
                taskId={task.id}
              />
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  }

  // Normal layout for other courses
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <LessonContent
          title={task.title}
          description={task.description}
          content={task.content}
          contentType={task.content_type || 'text'}
          videoUrl={null}
          slidesUrl={task.slides_url}
          images={[]}
        />
        {taskCompleted && (
          <Badge variant="outline" className="mb-4 text-primary border-primary">
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Task completato
          </Badge>
        )}
        <TaskNavigation
          courseId={course.id}
          lessonNumber={lesson.lesson_number}
          currentTaskNumber={task.task_number}
          totalTasks={totalTasks}
          onPrevious={task.task_number > 1 ? () => navigateToTask(task.task_number - 1) : undefined}
          onNext={task.task_number < totalTasks ? () => navigateToTask(task.task_number + 1) : undefined}
          onComplete={handleNavigateToCourse}
        />
      </div>
    </Layout>
  );
}