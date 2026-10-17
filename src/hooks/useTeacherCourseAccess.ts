 import { useEffect, useState } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from './useAuth';
 
export function useTeacherCourseAccess(courseSlug: string | undefined) {
   const { user, isAdmin, isLoading: authLoading } = useAuth();
   const [hasAccess, setHasAccess] = useState(false);
   const [isLoading, setIsLoading] = useState(true);
  const [courseId, setCourseId] = useState<string | null>(null);
 
   useEffect(() => {
     const checkAccess = async () => {
      // Aspetta utente e ruolo: altrimenti, aprendo direttamente la pagina, chi la usa
      // vede "nessun accesso" per un attimo e rimanda alla dashboard
      if (authLoading) return;
      if (!user || !courseSlug) {
         setHasAccess(false);
         setIsLoading(false);
         return;
       }
      setIsLoading(true);
 
      // First resolve the course slug to course ID
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('id')
        .eq('slug', courseSlug)
        .maybeSingle();

      if (courseError || !courseData) {
        setHasAccess(false);
        setIsLoading(false);
        return;
      }

      setCourseId(courseData.id);

       // Admins always have access
       if (isAdmin) {
         setHasAccess(true);
         setIsLoading(false);
         return;
       }
 
       // Check if user is a teacher with this course assigned
       const { data, error } = await supabase
         .from('teacher_courses')
         .select('id')
         .eq('teacher_id', user.id)
        .eq('course_id', courseData.id)
         .maybeSingle();
 
       if (!error && data) {
         setHasAccess(true);
       } else {
         setHasAccess(false);
       }
       setIsLoading(false);
     };
 
     checkAccess();
  }, [user, courseSlug, isAdmin, authLoading]);
 
  return { hasAccess, isLoading, courseId };
 }