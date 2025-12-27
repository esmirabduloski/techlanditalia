import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useStudentRole() {
  const { user } = useAuth();
  const [isStudent, setIsStudent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setIsStudent(false);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && data?.role === 'student') {
        setIsStudent(true);
      } else {
        setIsStudent(false);
      }
      setIsLoading(false);
    };

    checkRole();
  }, [user]);

  return { isStudent, isLoading };
}
