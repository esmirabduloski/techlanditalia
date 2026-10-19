import { useQuery } from '@tanstack/react-query';
import { romeToday } from '@/lib/courseProposal';
import { upcomingClosures, type SchoolClosure } from '@/lib/schoolClosures';
import { schoolClosuresClient } from '@/lib/schoolClosuresClient';

/** Chiusure e festività non ancora finite, dalla più vicina (area genitore). */
export function useUpcomingClosures() {
  const today = romeToday();
  return useQuery({
    queryKey: ['school-closures', 'upcoming', today],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<SchoolClosure[]> => {
      const { data, error } = await schoolClosuresClient
        .from('school_closures')
        .select('*')
        .gte('end_date', today)
        .order('start_date');
      if (error) throw error;
      return upcomingClosures(data ?? [], today);
    },
  });
}
