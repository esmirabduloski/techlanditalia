 import { useEffect, useState } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from './useAuth';
 
 export function useTeacherCourseAccess(courseId: string | undefined) {
   const { user, isAdmin } = useAuth();
   const [hasAccess, setHasAccess] = useState(false);
   const [isLoading, setIsLoading] = useState(true);
 
   useEffect(() => {
     const checkAccess = async () => {
       if (!user || !courseId) {
         setHasAccess(false);
         setIsLoading(false);
         return;
       }
 
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
         .eq('course_id', courseId)
         .maybeSingle();
 
       if (!error && data) {
         setHasAccess(true);
       } else {
         setHasAccess(false);
       }
       setIsLoading(false);
     };
 
     checkAccess();
   }, [user, courseId, isAdmin]);
 
   return { hasAccess, isLoading };
 }