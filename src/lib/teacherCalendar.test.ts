import { describe, expect, it } from 'vitest';
import { calendarFeedUrls } from './teacherCalendar';

const TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef';

describe('calendarFeedUrls', () => {
  it('link https, webcal e iscrizione a Google Calendar', () => {
    const urls = calendarFeedUrls('https://abc.supabase.co/', TOKEN);
    expect(urls.https).toBe(`https://abc.supabase.co/functions/v1/teacher-calendar-feed/${TOKEN}.ics`);
    expect(urls.webcal).toBe(`webcal://abc.supabase.co/functions/v1/teacher-calendar-feed/${TOKEN}.ics`);
    expect(urls.google).toBe(
      `https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fabc.supabase.co%2Ffunctions%2Fv1%2Fteacher-calendar-feed%2F${TOKEN}.ics`,
    );
    expect(new URL(urls.google).searchParams.get('cid')).toBe(urls.webcal);
  });
});
