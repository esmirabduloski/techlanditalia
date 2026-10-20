/**
 * Link del calendario lezioni dell'insegnante (edge function
 * teacher-calendar-feed, migrazione 0067): lo stesso calendario iCalendar
 * aperto da Google Calendar, Apple Calendar o Outlook.
 */

export interface CalendarFeed {
  token: string;
  created_at: string;
  /** Ultima volta che un calendario lo ha scaricato; null se mai. */
  last_fetched_at: string | null;
}

export interface CalendarFeedUrls {
  /** Il link da incollare in "Da URL" (Google) o "Iscriviti a calendario" */
  https: string;
  /** Apre l'app calendario del computer o del telefono (Apple, Outlook) */
  webcal: string;
  /** Apre Google Calendar con l'iscrizione già pronta, da confermare */
  google: string;
}

export function calendarFeedUrls(supabaseUrl: string, token: string): CalendarFeedUrls {
  const https = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/teacher-calendar-feed/${token}.ics`;
  const webcal = https.replace(/^https?:\/\//, 'webcal://');
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
  };
}
