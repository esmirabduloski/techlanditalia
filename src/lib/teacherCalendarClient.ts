import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { CalendarFeed } from '@/lib/teacherCalendar';

// Reuse the authenticated client; do not change generated types for a pending migration.
// 0067_teacher_calendar_feed: link segreto del calendario lezioni dell'insegnante.
type CalendarFeedDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Database['public']['Functions'] & {
      teacher_calendar_feed: {
        Args: { p_rotate?: boolean };
        Returns: CalendarFeed[];
      };
    };
  };
};

const calendarClient = supabase as unknown as SupabaseClient<CalendarFeedDatabase>;

export type CalendarFeedResult =
  | { status: 'ok'; feed: CalendarFeed }
  /** La migrazione 0067 non è ancora applicata */
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

/** Il link dell'insegnante collegato (lo crea la prima volta); `rotate` ne crea uno nuovo. */
export async function fetchCalendarFeed(rotate = false): Promise<CalendarFeedResult> {
  const { data, error } = await calendarClient.rpc('teacher_calendar_feed', { p_rotate: rotate });
  if (error) {
    if (['42883', 'PGRST202'].includes(error.code ?? '')) return { status: 'unavailable' };
    return { status: 'error', message: error.message };
  }
  const feed = data?.[0];
  return feed ? { status: 'ok', feed } : { status: 'error', message: 'Link non disponibile' };
}
