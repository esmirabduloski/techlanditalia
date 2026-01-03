import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useTeacherRole() {
  const { user } = useAuth();
  const [isTeacher, setIsTeacher] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setIsTeacher(false);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'teacher')
        .maybeSingle();

      if (!error && data?.role === 'teacher') {
        setIsTeacher(true);
      } else {
        setIsTeacher(false);
      }
      setIsLoading(false);
    };

    checkRole();
  }, [user]);

  return { isTeacher, isLoading };
}
