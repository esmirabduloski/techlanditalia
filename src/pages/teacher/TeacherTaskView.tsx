 import { useEffect, useState } from 'react';
 import { useNavigate, useParams } from 'react-router-dom';
 import { useAuth } from '@/hooks/useAuth';
 import { useTeacherCourseAccess } from '@/hooks/useTeacherCourseAccess';
 import { supabase } from '@/integrations/supabase/client';
 import { Layout } from '@/components/layout/Layout';
 import { LessonContent } from '@/components/lesson/LessonContent';
 import { TaskNavigation } from '@/components/lesson/TaskNavigation';
 import { PythonCompiler } from '@/components/lesson/PythonCompiler';
 import { TurtleCompiler } from '@/components/lesson/TurtleCompiler';
 import { PgzeroCompiler } from '@/components/lesson/PgzeroCompiler';
 import { WebCompiler } from '@/components/lesson/WebCompiler';
 import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft } from 'lucide-react';
 
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
   default_python_code: string | null;
   default_html_code: string | null;
   default_css_code: string | null;
   default_js_code: string | null;
   python_env: string | null;
   replit_url: string | null;
   attachments: TaskAttachment[];
 }
 
 const PYTHON_COURSES = ['python-base', 'python-ai'];
 const WEB_COURSES = ['web-development'];
 
 export default function TeacherTaskView() {
  const { courseSlug, lessonNumber, taskNumber } = useParams<{ courseSlug: string; lessonNumber: string; taskNumber: string }>();
   const { user, isLoading: authLoading } = useAuth();
  const { hasAccess, isLoading: accessLoading, courseId } = useTeacherCourseAccess(courseSlug);
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
     if (!accessLoading && !hasAccess && user) {
       navigate('/insegnante');
     }
   }, [hasAccess, accessLoading, user, navigate]);
 
   useEffect(() => {
    if (courseSlug && courseId && lessonNumber && taskNumber && hasAccess) {
       fetchData();
     }
  }, [courseSlug, courseId, lessonNumber, taskNumber, hasAccess]);
 
   const fetchData = async () => {
    if (!courseSlug || !courseId || !lessonNumber || !taskNumber) return;
 
     try {
       const { data: courseData } = await supabase
         .from('courses')
         .select('id, slug, title')
         .eq('id', courseId)
         .maybeSingle();
 
       if (courseData) {
         setCourse(courseData);
       }
 
       const { data: lessonData } = await supabase
         .from('lessons')
         .select('id, lesson_number, title')
         .eq('course_id', courseId)
         .eq('lesson_number', parseInt(lessonNumber))
         .maybeSingle();
 
       if (lessonData) {
         setLesson(lessonData);
 
         const { count } = await supabase
           .from('lesson_tasks')
           .select('*', { count: 'exact', head: true })
           .eq('lesson_id', lessonData.id);
 
         setTotalTasks(count || 0);
 
         const { data: taskData } = await supabase
           .from('lesson_tasks')
           .select('*')
           .eq('lesson_id', lessonData.id)
           .eq('task_number', parseInt(taskNumber))
           .maybeSingle();
 
         if (taskData) {
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
         }
       }
     } catch (error) {
       console.error('Error fetching task:', error);
     } finally {
       setIsLoading(false);
     }
   };
 
   const navigateToTask = (newTaskNumber: number) => {
    navigate(`/insegnante/corso/${courseSlug}/lezione/${lessonNumber}/task/${newTaskNumber}`);
   };
 
   const handleNavigateToCourse = () => {
    navigate(`/insegnante/corso/${courseSlug}`);
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
 
   if (!user || !course || !lesson || !task || !hasAccess) {
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
   const isMixedType = task.content_type === 'mixed';
   const isScratchType = task.content_type === 'scratch';
   const showCompiler = (isPythonCourse || isWebCourse) && isMixedType;
   const showScratch = isScratchType && task.scratch_url;
 
   const getScratchEmbedUrl = (url: string): string => {
     if (url.includes('/embed')) {
       return url;
     }
     const match = url.match(/scratch\.mit\.edu\/projects\/(\d+)/);
     if (match) {
       return `https://scratch.mit.edu/projects/${match[1]}/embed`;
     }
     return url;
   };
 
   if (showScratch) {
     return (
       <div className="h-screen flex flex-col bg-background">
        {/* Header with back button */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-background">
          <Button variant="ghost" size="icon" onClick={handleNavigateToCourse}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{course.title}</span>
              <span>·</span>
              <span>Lezione {lesson.lesson_number}</span>
              <Badge variant="outline" className="ml-2">Vista Insegnante</Badge>
            </div>
            <h1 className="font-semibold">Task {task.task_number}: {task.title}</h1>
          </div>
        </div>

         <ResizablePanelGroup direction="horizontal" className="flex-1">
           <ResizablePanel defaultSize={40} minSize={25}>
             <div className="h-full overflow-y-auto">
               <LessonContent
                 title={task.title}
                 description={task.description}
                 content={task.content}
                 contentType={task.content_type || 'text'}
                 videoUrl={null}
                 slidesUrl={null}
                 images={[]}
               />
               <div className="px-6 pb-6">
                 <TaskNavigation
                   courseId={course.id}
                   lessonNumber={lesson.lesson_number}
                   currentTaskNumber={task.task_number}
                   totalTasks={totalTasks}
                   onPrevious={task.task_number > 1 ? () => navigateToTask(task.task_number - 1) : undefined}
                   onNext={task.task_number < totalTasks ? () => navigateToTask(task.task_number + 1) : undefined}
                   onComplete={handleNavigateToCourse}
                  basePath={`/insegnante/corso/${courseSlug}`}
                 />
               </div>
             </div>
           </ResizablePanel>
 
           <ResizableHandle withHandle />
 
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
         </ResizablePanelGroup>
       </div>
     );
   }
 
   if (showCompiler) {
     return (
       <div className="h-screen flex flex-col bg-background">
        {/* Header with back button */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-background">
          <Button variant="ghost" size="icon" onClick={handleNavigateToCourse}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{course.title}</span>
              <span>·</span>
              <span>Lezione {lesson.lesson_number}</span>
              <Badge variant="outline" className="ml-2">Vista Insegnante</Badge>
            </div>
            <h1 className="font-semibold">Task {task.task_number}: {task.title}</h1>
          </div>
        </div>

         <ResizablePanelGroup direction="horizontal" className="flex-1">
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
                 <TaskNavigation
                   courseId={course.id}
                   lessonNumber={lesson.lesson_number}
                   currentTaskNumber={task.task_number}
                   totalTasks={totalTasks}
                   onPrevious={task.task_number > 1 ? () => navigateToTask(task.task_number - 1) : undefined}
                   onNext={task.task_number < totalTasks ? () => navigateToTask(task.task_number + 1) : undefined}
                   onComplete={handleNavigateToCourse}
                  basePath={`/insegnante/corso/${courseSlug}`}
                 />
               </div>
             </div>
           </ResizablePanel>
 
           <ResizableHandle withHandle />
 
           <ResizablePanel defaultSize={50} minSize={30}>
             {isPythonCourse && (
               task.python_env === 'turtle' ? (
                 <TurtleCompiler defaultCode={task.default_python_code || undefined} />
               ) : task.python_env === 'pgzero' ? (
                 <PgzeroCompiler defaultCode={task.default_python_code || undefined} replitUrl={task.replit_url || undefined} />
               ) : (
                 <PythonCompiler defaultCode={task.default_python_code || undefined} />
               )
             )}
             {isWebCourse && (
               <WebCompiler 
                 defaultHtmlCode={task.default_html_code || undefined}
                 defaultCssCode={task.default_css_code || undefined}
                 defaultJsCode={task.default_js_code || undefined}
                 taskAttachments={task.attachments}
               />
             )}
           </ResizablePanel>
         </ResizablePanelGroup>
       </div>
     );
   }
 
   return (
     <Layout>
       <div className="max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={handleNavigateToCourse} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Torna al corso
        </Button>
        <Badge variant="outline" className="mb-4">Vista Insegnante</Badge>
         <LessonContent
           title={task.title}
           description={task.description}
           content={task.content}
           contentType={task.content_type || 'text'}
           videoUrl={null}
           slidesUrl={task.slides_url}
           images={[]}
         />
         <TaskNavigation
           courseId={course.id}
           lessonNumber={lesson.lesson_number}
           currentTaskNumber={task.task_number}
           totalTasks={totalTasks}
           onPrevious={task.task_number > 1 ? () => navigateToTask(task.task_number - 1) : undefined}
           onNext={task.task_number < totalTasks ? () => navigateToTask(task.task_number + 1) : undefined}
           onComplete={handleNavigateToCourse}
          basePath={`/insegnante/corso/${courseSlug}`}
         />
       </div>
     </Layout>
   );
 }