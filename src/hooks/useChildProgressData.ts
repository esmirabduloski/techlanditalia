/**
 * Dati di un figlio per l'area genitore (calendario, compiti, presenze, saldo,
 * commenti), con react-query: la scheda «In breve» e le sezioni di dettaglio
 * usano le stesse chiavi, così ogni dato si scarica una volta sola.
 *
 * Gli stati (mancante, assente...) vengono da src/lib/childProgress.ts.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  attendanceStats,
  attendanceStatus,
  homeworkCounts,
  homeworkStatus,
  type AttendanceComputedStatus,
  type AttendanceStats,
  type HomeworkComputedStatus,
  type HomeworkCounts,
} from '@/lib/childProgress';
import type { CourseCertificate } from '@/lib/certificate';
import { certificateClient } from '@/lib/certificateClient';

const STALE_TIME = 60_000;

type CourseRef = { id: string; title: string; emoji: string };
type ScheduleRow = {
  id: string;
  lesson_number: number;
  lesson_date: string;
  lesson_title: string | null;
  lesson_time: string | null;
  group: { id: string; title: string; lesson_time: string | null; status: string | null; student_meeting_link: string | null; course: CourseRef };
};
type LessonRow = { id: string; lesson_number: number; title: string | null; course_id: string; course: { title: string; emoji: string } };
type SubmissionRow = { homework_id: string; submitted_at: string | null; status: string | null; grade: number | null; teacher_feedback: string | null };
type CommentRow = { id: string; content: string; created_at: string; author: { full_name: string; role: string } | null };

/** Gruppi del figlio: quelli passati dal genitore oppure tutti quelli a cui è iscritto. */
async function resolveGroupIds(childId: string, groupIds?: string[]): Promise<string[]> {
  if (groupIds) return groupIds;
  const { data, error } = await supabase.from('group_students').select('group_id').eq('student_id', childId);
  if (error) throw new Error(`Errore di caricamento gruppi: ${error.message}`);
  return (data || []).map((gs) => gs.group_id);
}

// --- Calendario ---------------------------------------------------------------

export interface ScheduledLesson {
  id: string;
  lesson_number: number;
  lesson_date: string;
  lesson_title: string | null;
  lesson_time: string | null;
  group: {
    id: string;
    title: string;
    lesson_time: string | null;
    status: string;
    student_meeting_link: string | null;
    course: { id: string; title: string; emoji: string };
  };
  /** Esiste il materiale della lezione (riga in `lessons`). */
  hasMaterial: boolean;
  objective: string | null;
}

export function useChildSchedule(childId: string, groupIds?: string[]) {
  return useQuery({
    queryKey: ['child-schedule', childId, groupIds?.join(',') ?? '*'],
    enabled: !!childId,
    staleTime: STALE_TIME,
    queryFn: async (): Promise<ScheduledLesson[]> => {
      const ids = await resolveGroupIds(childId, groupIds);
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from('group_lesson_schedule')
        .select(`
          id,
          lesson_number,
          lesson_date,
          lesson_title,
          lesson_time,
          group:group_id (
            id,
            title,
            lesson_time,
            status,
            student_meeting_link,
            course:course_id (
              id,
              title,
              emoji
            )
          )
        `)
        .in('group_id', ids)
        .order('lesson_date', { ascending: true });
      if (error) throw new Error(`Errore di caricamento calendario: ${error.message}`);

      const rows = (data || []) as unknown as ScheduleRow[];
      const courseIds = [...new Set(rows.map((s) => s.group.course.id))];
      const lessonInfo = new Map<string, string | null>();
      if (courseIds.length > 0) {
        const { data: lessonData } = await supabase
          .from('lessons')
          .select('course_id, lesson_number, objective')
          .in('course_id', courseIds);
        lessonData?.forEach((l) => lessonInfo.set(`${l.course_id}_${l.lesson_number}`, l.objective?.trim() || null));
      }

      return rows.map((s) => {
        const key = `${s.group.course.id}_${s.lesson_number}`;
        return {
          id: s.id,
          lesson_number: s.lesson_number,
          lesson_date: s.lesson_date,
          lesson_title: s.lesson_title,
          lesson_time: s.lesson_time,
          group: {
            id: s.group.id,
            title: s.group.title,
            lesson_time: s.group.lesson_time,
            status: s.group.status || 'active',
            student_meeting_link: s.group.student_meeting_link || null,
            course: { id: s.group.course.id, title: s.group.course.title, emoji: s.group.course.emoji },
          },
          hasMaterial: lessonInfo.has(key),
          objective: lessonInfo.get(key) ?? null,
        };
      });
    },
  });
}

// --- Compiti ------------------------------------------------------------------

export interface HomeworkItem {
  lessonNumber: number;
  lessonTitle: string | null;
  hasHomework: boolean;
  homeworkId?: string;
  homeworkTitle?: string;
  submittedAt?: string;
  grade?: number;
  teacherFeedback?: string | null;
  lessonDate?: string;
  dueDate?: string;
  computedStatus: HomeworkComputedStatus;
}

export interface ChildHomeworkData {
  /** Chiave = "emoji titolo corso". */
  byCourse: Record<string, HomeworkItem[]>;
  counts: HomeworkCounts;
}

export function useChildHomework(childId: string, courseIds?: string[]) {
  return useQuery({
    queryKey: ['child-homework', childId, courseIds?.join(',') ?? '*'],
    enabled: !!childId,
    staleTime: STALE_TIME,
    queryFn: async (): Promise<ChildHomeworkData> => {
      const empty = { byCourse: {}, counts: homeworkCounts([]) };

      // Gruppi del figlio: servono sempre per date e scadenze
      const { data: groupStudents, error: groupError } = await supabase
        .from('group_students')
        .select('group_id, group:group_id ( id, course_id )')
        .eq('student_id', childId);
      if (groupError) throw new Error(`Errore di caricamento gruppi: ${groupError.message}`);

      const groupIds = (groupStudents || []).map((gs) => gs.group_id);
      const ids = courseIds ?? [...new Set((groupStudents as unknown as { group: { course_id: string } | null }[] || []).map((gs) => gs.group?.course_id).filter((id): id is string => !!id))];
      if (ids.length === 0) return empty;

      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('id, lesson_number, title, course_id, course:course_id ( title, emoji )')
        .in('course_id', ids)
        .order('lesson_number', { ascending: true });

      const lessonIds = lessonsData?.map((l) => l.id) || [];
      const { data: homeworkData } = await supabase.from('homework').select('id, lesson_id, title').in('lesson_id', lessonIds);

      const homeworkIds = homeworkData?.map((h) => h.id) || [];
      const { data: submissionsData } = await supabase
        .from('homework_submissions')
        .select('homework_id, submitted_at, status, grade, teacher_feedback')
        .eq('student_id', childId)
        .in('homework_id', homeworkIds);

      const lessonDateMap = new Map<string, string>();
      const nextLessonDateMap = new Map<string, string>();
      const deadlineMap = new Map<string, string>();

      if (groupIds.length > 0) {
        const { data: scheduleData } = await supabase
          .from('group_lesson_schedule')
          .select('group_id, lesson_number, lesson_date')
          .in('group_id', groupIds)
          .order('lesson_number', { ascending: true });
        const { data: groupsData } = await supabase.from('student_groups').select('id, course_id').in('id', groupIds);

        const groupToCourse = new Map<string, string>();
        groupsData?.forEach((g) => groupToCourse.set(g.id, g.course_id));

        const courseSchedules = new Map<string, { lessonNumber: number; date: string }[]>();
        scheduleData?.forEach((s) => {
          const cId = groupToCourse.get(s.group_id);
          if (!cId) return;
          lessonDateMap.set(`${cId}-${s.lesson_number}`, s.lesson_date);
          if (!courseSchedules.has(cId)) courseSchedules.set(cId, []);
          courseSchedules.get(cId)!.push({ lessonNumber: s.lesson_number, date: s.lesson_date });
        });
        // Scadenza predefinita: la lezione successiva
        courseSchedules.forEach((schedule, cId) => {
          schedule.sort((a, b) => a.lessonNumber - b.lessonNumber);
          for (let i = 0; i < schedule.length - 1; i++) {
            nextLessonDateMap.set(`${cId}-${schedule[i].lessonNumber}`, schedule[i + 1].date);
          }
        });

        if (homeworkIds.length > 0) {
          const { data: deadlines } = await supabase
            .from('homework_group_deadlines')
            .select('homework_id, due_date')
            .in('group_id', groupIds)
            .in('homework_id', homeworkIds);
          deadlines?.forEach((d) => deadlineMap.set(d.homework_id, d.due_date));
        }
      }

      const homeworkByLesson = new Map<string, { id: string; title: string }>();
      homeworkData?.forEach((hw) => homeworkByLesson.set(hw.lesson_id, { id: hw.id, title: hw.title }));
      const submissionsByHomework = new Map<string, SubmissionRow>();
      (submissionsData as SubmissionRow[] | null)?.forEach((sub) => submissionsByHomework.set(sub.homework_id, sub));

      const byCourse: Record<string, HomeworkItem[]> = {};
      const statuses: HomeworkComputedStatus[] = [];
      (lessonsData as unknown as LessonRow[] | null)?.forEach((lesson) => {
        const courseKey = `${lesson.course.emoji} ${lesson.course.title}`;
        if (!byCourse[courseKey]) byCourse[courseKey] = [];

        const homework = homeworkByLesson.get(lesson.id);
        const submission = homework ? submissionsByHomework.get(homework.id) : undefined;
        const dateKey = `${lesson.course_id}-${lesson.lesson_number}`;
        const lessonDate = lessonDateMap.get(dateKey);
        const dueDate = (homework && deadlineMap.get(homework.id)) || nextLessonDateMap.get(dateKey);
        const computedStatus = homeworkStatus({ hasHomework: !!homework, submission, lessonDate, dueDate });
        statuses.push(computedStatus);

        byCourse[courseKey].push({
          lessonNumber: lesson.lesson_number,
          lessonTitle: lesson.title,
          hasHomework: !!homework,
          homeworkId: homework?.id,
          homeworkTitle: homework?.title,
          submittedAt: submission?.submitted_at ?? undefined,
          grade: submission?.grade ?? undefined,
          teacherFeedback: submission?.teacher_feedback ?? null,
          lessonDate,
          dueDate,
          computedStatus,
        });
      });

      return { byCourse, counts: homeworkCounts(statuses) };
    },
  });
}

// --- Presenze -----------------------------------------------------------------

export interface AttendanceItem {
  lessonNumber: number;
  lessonDate: string;
  lessonTitle: string | null;
  status: AttendanceComputedStatus;
}

export interface ChildAttendanceData {
  byCourse: Record<string, AttendanceItem[]>;
  stats: AttendanceStats;
}

export function useChildAttendance(childId: string, groupIds?: string[]) {
  return useQuery({
    queryKey: ['child-attendance', childId, groupIds?.join(',') ?? '*'],
    enabled: !!childId,
    staleTime: STALE_TIME,
    queryFn: async (): Promise<ChildAttendanceData> => {
      const ids = await resolveGroupIds(childId, groupIds);
      if (ids.length === 0) return { byCourse: {}, stats: attendanceStats([]) };

      const { data: scheduleData, error: scheduleError } = await supabase
        .from('group_lesson_schedule')
        .select(`
          id,
          lesson_number,
          lesson_date,
          lesson_title,
          group:group_id (
            id,
            title,
            course:course_id (
              title,
              emoji
            )
          )
        `)
        .in('group_id', ids)
        .order('lesson_number', { ascending: true });
      if (scheduleError) throw new Error(`Errore di caricamento calendario: ${scheduleError.message}`);

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('group_attendance')
        .select('group_id, lesson_number, status')
        .eq('student_id', childId)
        .in('group_id', ids);
      if (attendanceError) throw new Error(`Errore di caricamento presenze: ${attendanceError.message}`);

      const recorded = new Map<string, string>();
      attendanceData?.forEach((a) => recorded.set(`${a.group_id}-${a.lesson_number}`, a.status));

      const byCourse: Record<string, AttendanceItem[]> = {};
      const statuses: AttendanceComputedStatus[] = [];
      (scheduleData as unknown as ScheduleRow[] | null)?.forEach((lesson) => {
        const courseKey = `${lesson.group.course.emoji} ${lesson.group.course.title}`;
        if (!byCourse[courseKey]) byCourse[courseKey] = [];
        const status = attendanceStatus(recorded.get(`${lesson.group.id}-${lesson.lesson_number}`), lesson.lesson_date);
        statuses.push(status);
        byCourse[courseKey].push({
          lessonNumber: lesson.lesson_number,
          lessonDate: lesson.lesson_date,
          lessonTitle: lesson.lesson_title,
          status,
        });
      });

      return { byCourse, stats: attendanceStats(statuses) };
    },
  });
}

// --- Saldo lezioni ------------------------------------------------------------

export interface BalanceLogEntry {
  id: string;
  operation_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  notes: string | null;
  created_at: string;
}

export function useChildBalance(childId: string) {
  return useQuery({
    queryKey: ['child-balance', childId],
    enabled: !!childId,
    staleTime: STALE_TIME,
    queryFn: async (): Promise<{ balance: number; logs: BalanceLogEntry[] }> => {
      const [logsRes, profileRes] = await Promise.all([
        supabase
          .from('lesson_balance_log')
          .select('*')
          .eq('student_id', childId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('profiles').select('lesson_balance').eq('id', childId).single(),
      ]);
      return { balance: profileRes.data?.lesson_balance ?? 0, logs: (logsRes.data || []) as BalanceLogEntry[] };
    },
  });
}

// --- Commenti degli insegnanti ------------------------------------------------

export interface TeacherComment {
  id: string;
  content: string;
  created_at: string;
  author: { full_name: string; role: string } | null;
}

export function useChildComments(childId: string) {
  return useQuery({
    queryKey: ['child-comments', childId],
    enabled: !!childId,
    staleTime: STALE_TIME,
    queryFn: async (): Promise<TeacherComment[]> => {
      const { data, error } = await supabase
        .from('student_comments')
        .select('id, content, created_at, author:author_id (full_name, role)')
        .eq('student_id', childId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data || []) as unknown as CommentRow[]).map((c) => ({ id: c.id, content: c.content, created_at: c.created_at, author: c.author ?? null }));
    },
  });
}

/** Attestati di fine corso del figlio: esistono solo dopo lo sblocco dell'insegnante. */
export function useChildCertificates(childId: string) {
  return useQuery({
    queryKey: ['child-certificates', childId],
    enabled: !!childId,
    staleTime: STALE_TIME,
    queryFn: async (): Promise<CourseCertificate[]> => {
      const { data, error } = await certificateClient
        .from('course_certificates')
        .select('*')
        .eq('student_id', childId)
        .order('issued_on', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CourseCertificate[];
    },
  });
}
