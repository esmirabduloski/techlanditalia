/**
 * Gruppi e lezioni dell'insegnante da mettere nel suo calendario: li usano il
 * file .ics (teacher-calendar-feed) e il collegamento a Google Calendar
 * (google-calendar, google-calendar-sync). Va chiamato con il service role.
 *
 * Chi non ha più il ruolo di insegnante non ha lezioni: il suo calendario
 * Google si svuota e il link .ics risponde 404.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type FeedGroup, type FeedLesson, feedWindow } from "./teachercalendar.ts";

const PAGE = 1000;

export async function isTeacher(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "teacher")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function loadTeacherLessons(
  supabase: SupabaseClient,
  teacherId: string,
  now: Date,
): Promise<{ groups: FeedGroup[]; lessons: FeedLesson[] }> {
  const { data: groupRows, error: groupsError } = await supabase
    .from("student_groups")
    .select("id, title, status, archived_at, lesson_time, teacher_meeting_link, updated_at, courses(title, emoji)")
    .eq("teacher_id", teacherId);
  if (groupsError) throw groupsError;

  const groups: FeedGroup[] = (groupRows ?? []).map((g) => {
    const course = (Array.isArray(g.courses) ? g.courses[0] : g.courses) as
      | { title: string | null; emoji: string | null }
      | null;
    return {
      id: g.id,
      title: g.title,
      status: g.status,
      archived_at: g.archived_at,
      lesson_time: g.lesson_time,
      teacher_meeting_link: g.teacher_meeting_link,
      updated_at: g.updated_at,
      course_title: course?.title ?? null,
      course_emoji: course?.emoji ?? null,
    };
  });

  const lessons: FeedLesson[] = [];
  if (groups.length === 0) return { groups, lessons };

  const { from, to } = feedWindow(now);
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("group_lesson_schedule")
      .select("id, group_id, lesson_number, lesson_date, lesson_time, lesson_title, updated_at")
      .in("group_id", groups.map((g) => g.id))
      .gte("lesson_date", from)
      .lte("lesson_date", to)
      .order("lesson_date")
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    lessons.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { groups, lessons };
}
