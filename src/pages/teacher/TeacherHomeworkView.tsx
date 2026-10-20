 import { useEffect, useState } from 'react';
 import { useNavigate, useParams } from 'react-router-dom';
 import { useAuth } from '@/hooks/useAuth';
 import { usePreviewAccess, type PreviewScope } from '@/hooks/useLessonPreview';
 import { supabase } from '@/integrations/supabase/client';
 import { Layout } from '@/components/layout/Layout';
 import { LessonContent } from '@/components/lesson/LessonContent';
 import { PythonCompiler } from '@/components/lesson/PythonCompiler';
 import { TurtleCompiler } from '@/components/lesson/TurtleCompiler';
 import { PgzeroCompiler } from '@/components/lesson/PgzeroCompiler';
 import { WebCompiler } from '@/components/lesson/WebCompiler';
 import { EditViewTabs } from '@/components/lesson/ViewModeSwitch';
 import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Loader2, ArrowLeft, Trophy } from 'lucide-react';
 import { resolveCompiler } from '@/lib/compilerKind';
 import { SeasonalBadge } from '@/components/homework/SeasonalBadge';
 
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
   attachments: Attachment[];
   default_python_code: string | null;
   default_html_code: string | null;
   default_css_code: string | null;
   default_js_code: string | null;
   python_env: string | null;
   replit_url: string | null;
   preview_only: boolean;
   /** Compito stagionale (0066) */
   seasonal_theme_id: string | null;
   /** Un compito stagionale in archivio non ha lezione: id e numero sono null */
   lesson: {
     id: string | null;
     title: string;
     lesson_number: number | null;
     course: {
       id: string;
       title: string;
       emoji: string;
       slug: string;
     };
   };
 }
 
 export default function TeacherHomeworkView() {
   return <HomeworkPreviewPage scope="teacher" />;
 }

 /** Compito in sola lettura: vista insegnante oppure anteprima admin ("Visualizza"). */
 export function HomeworkPreviewPage({ scope }: { scope: PreviewScope }) {
   const { homeworkId } = useParams();
   const navigate = useNavigate();
   const { user, isLoading: authLoading } = useAuth();
   const { hasAccess, isLoading: accessLoading, courseHref, deniedHref } = usePreviewAccess(scope);
   
   const [homework, setHomework] = useState<HomeworkDetails | null>(null);
   const [isLoading, setIsLoading] = useState(true);
 
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
     if (user && homeworkId && hasAccess) {
       fetchHomeworkDetails();
     }
   }, [user, homeworkId, hasAccess]);
 
   const fetchHomeworkDetails = async () => {
     if (!user || !homeworkId) return;
     
     try {
       const { data: homeworkData, error: homeworkError } = await supabase
         .from('homework')
         .select(`
           *,
           lessons (
             id,
             title,
             lesson_number,
             courses (
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
 
       const row = homeworkData as typeof homeworkData & { seasonal_theme_id?: string | null; course_id?: string | null };
       // Compito stagionale in archivio: niente lezione, il corso è sul compito
       const lesson = (homeworkData.lessons as any) ?? { id: null, title: 'Compito stagionale', lesson_number: null };
       let course = lesson.courses;
       if (!course && row.course_id) {
         const { data: courseData } = await supabase
           .from('courses')
           .select('id, title, emoji, slug')
           .eq('id', row.course_id)
           .maybeSingle();
         course = courseData;
       }
       if (!course) throw new Error('Corso del compito non trovato');
 
       setHomework({
         id: homeworkData.id,
         title: homeworkData.title,
         description: homeworkData.description,
         instructions: homeworkData.instructions,
         points_reward: homeworkData.points_reward,
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
         seasonal_theme_id: row.seasonal_theme_id ?? null,
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
     } catch (error) {
       console.error('Error fetching homework:', error);
     } finally {
       setIsLoading(false);
     }
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
 
   if (!user || !homework || !hasAccess) {
     return (
       <Layout>
         <div className="min-h-screen flex items-center justify-center">
           <p className="text-muted-foreground">Compito non trovato</p>
         </div>
       </Layout>
     );
   }
 
   const { lesson } = homework;
   // Admin: "indietro" torna all'elenco compiti della lezione, "Modifica" all'editor.
   // Un compito stagionale in archivio non ha lezione: si torna ai compiti stagionali.
   const seasonalHref = `/admin/compiti-stagionali?tema=${homework.seasonal_theme_id}`;
   const backHref = scope !== 'admin' ? courseHref
     : lesson.id ? `/admin/corsi/${lesson.course.id}/lezioni/${lesson.id}/compiti`
     : seasonalHref;
   const editHref = lesson.id
     ? `/admin/corsi/${lesson.course.id}/lezioni/${lesson.id}/compiti/${homework.id}/modifica`
     : `/admin/compiti-stagionali/${homework.seasonal_theme_id}/compito/${homework.id}/modifica`;
   const editTabs = scope === 'admin' && (
     <EditViewTabs
       mode="view"
       compact
       onEdit={() => navigate(editHref)}
     />
   );
   const lessonLabel = (
     <>
       <span>{lesson.lesson_number ? `Lezione ${lesson.lesson_number}` : 'Non inserito in una lezione'}</span>
       <SeasonalBadge themeId={homework.seasonal_theme_id} />
     </>
   );
   const teacherBadge = scope === 'teacher' && <Badge variant="outline" className="ml-2">Vista Insegnante</Badge>;

   const compiler = resolveCompiler(homework.lesson.course.slug, homework);
   const isPythonCourse = compiler === 'python' || compiler === 'turtle' || compiler === 'pgzero';
   const isWebCourse = compiler === 'web';
   const hasCompiler = isPythonCourse || isWebCourse;
 
   // Preview-only mode for Web courses
   if (isWebCourse && homework.preview_only) {
     return (
       <div className="h-screen flex flex-col bg-background">
         <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
           <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(backHref)}>
               <ArrowLeft className="w-5 h-5" />
             </Button>
             <div>
               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                 <span>{homework.lesson.course.emoji}</span>
                 <span>{homework.lesson.course.title}</span>
                 <span>·</span>
                 {lessonLabel}
                 {teacherBadge}
               </div>
               <h1 className="font-semibold">{homework.title}</h1>
             </div>
           </div>
           <div className="flex items-center gap-2">
             {editTabs}
             <Badge variant="secondary" className="gap-1">
               <Trophy className="w-3 h-3" />
               {homework.points_reward} punti
             </Badge>
           </div>
         </div>
 
         <PreviewOnlyFrame
           htmlCode={homework.default_html_code || ''}
           cssCode={homework.default_css_code || ''}
           jsCode={homework.default_js_code || ''}
         />
       </div>
     );
   }
 
   if (hasCompiler) {
     return (
       <div className="h-screen flex flex-col bg-background">
         <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
           <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(backHref)}>
               <ArrowLeft className="w-5 h-5" />
             </Button>
             <div>
               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                 <span>{homework.lesson.course.emoji}</span>
                 <span>{homework.lesson.course.title}</span>
                 <span>·</span>
                 {lessonLabel}
                 {teacherBadge}
               </div>
               <h1 className="font-semibold">{homework.title}</h1>
             </div>
           </div>
           <div className="flex items-center gap-2">
             {editTabs}
             <Badge variant="secondary" className="gap-1">
               <Trophy className="w-3 h-3" />
               {homework.points_reward} punti
             </Badge>
           </div>
         </div>
 
         <ResizablePanelGroup direction="horizontal" className="flex-1">
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
             </div>
           </ResizablePanel>
 
           <ResizableHandle withHandle />
 
           <ResizablePanel defaultSize={50} minSize={30}>
             {isPythonCourse && (
               compiler === 'turtle' ? (
                 <TurtleCompiler defaultCode={homework.default_python_code || undefined} />
               ) : compiler === 'pgzero' ? (
                 <PgzeroCompiler defaultCode={homework.default_python_code || undefined} replitUrl={homework.replit_url || undefined} attachments={homework.attachments} />
               ) : (
                 <PythonCompiler defaultCode={homework.default_python_code || undefined} />
               )
             )}
             {isWebCourse && (
               <WebCompiler 
                 defaultHtmlCode={homework.default_html_code || undefined}
                 defaultCssCode={homework.default_css_code || undefined}
                 defaultJsCode={homework.default_js_code || undefined}
               />
             )}
           </ResizablePanel>
         </ResizablePanelGroup>
       </div>
     );
   }
 
   // Non-compiler courses - show simple view
   return (
     <Layout>
       <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <Button variant="ghost" onClick={() => navigate(backHref)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {scope === 'admin' ? 'Torna ai compiti' : 'Torna al corso'}
          </Button>
          <div className="flex items-center gap-2">
            <SeasonalBadge themeId={homework.seasonal_theme_id} />
            {editTabs || <Badge variant="outline">Vista Insegnante</Badge>}
          </div>
        </div>
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
       </div>
     </Layout>
   );
 }
 
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