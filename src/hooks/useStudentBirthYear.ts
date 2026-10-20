import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Anno di nascita dell'alunno indicato dal genitore (null se manca). Con
 * studentId vuoto non legge niente: serve a chi lo chiede solo in certi casi.
 * Da passare a canSelfConsent per sapere se ha 14 anni certi.
 */
export function useStudentBirthYear(studentId: string | null | undefined): number | null {
  const [birthYear, setBirthYear] = useState<number | null>(null);

  useEffect(() => {
    if (!studentId) {
      setBirthYear(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('student_birth_years')
      .select('birth_year')
      .eq('student_id', studentId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setBirthYear(data?.birth_year ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return birthYear;
}
