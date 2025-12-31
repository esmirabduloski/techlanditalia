import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StudentStreaks {
  homework_streak: number;
  attendance_streak: number;
  best_homework_streak: number;
  best_attendance_streak: number;
  last_homework_date: string | null;
  last_attendance_date: string | null;
}

interface AttendanceRecord {
  id: string;
  status: 'present' | 'absent_unexcused' | 'absent_excused';
  notes: string | null;
  marked_at: string;
  scheduled_lesson: {
    id: string;
    title: string;
    lesson_date: string;
    course: {
      title: string;
      emoji: string;
    };
  };
}

interface AttendanceStats {
  total: number;
  present: number;
  absent_unexcused: number;
  absent_excused: number;
  percentage: number;
}

interface StreakBonus {
  id: string;
  streak_type: 'homework' | 'attendance';
  milestone: number;
  points_awarded: number;
  awarded_at: string;
}

export function useStudentStreaks(studentId?: string) {
  const [streaks, setStreaks] = useState<StudentStreaks | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({ total: 0, present: 0, absent_unexcused: 0, absent_excused: 0, percentage: 0 });
  const [bonuses, setBonuses] = useState<StreakBonus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      // Fetch streaks
      const { data: streakData } = await supabase
        .from('student_streaks')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      if (streakData) {
        setStreaks(streakData);
      } else {
        setStreaks({
          homework_streak: 0,
          attendance_streak: 0,
          best_homework_streak: 0,
          best_attendance_streak: 0,
          last_homework_date: null,
          last_attendance_date: null,
        });
      }

      // Fetch attendance records
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select(`
          id,
          status,
          notes,
          marked_at,
          scheduled_lesson:scheduled_lessons(
            id,
            title,
            lesson_date,
            course:courses(title, emoji)
          )
        `)
        .eq('student_id', studentId)
        .order('marked_at', { ascending: false });

      if (attendanceData) {
        const records: AttendanceRecord[] = attendanceData.map(a => ({
          id: a.id,
          status: a.status as 'present' | 'absent_unexcused' | 'absent_excused',
          notes: a.notes,
          marked_at: a.marked_at,
          scheduled_lesson: a.scheduled_lesson as unknown as AttendanceRecord['scheduled_lesson']
        }));
        setAttendance(records);

        // Calculate stats
        const total = records.length;
        const present = records.filter(r => r.status === 'present').length;
        const absent_unexcused = records.filter(r => r.status === 'absent_unexcused').length;
        const absent_excused = records.filter(r => r.status === 'absent_excused').length;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

        setStats({ total, present, absent_unexcused, absent_excused, percentage });
      }

      // Fetch streak bonuses
      const { data: bonusesData } = await supabase
        .from('streak_bonuses')
        .select('*')
        .eq('student_id', studentId)
        .order('awarded_at', { ascending: false });

      if (bonusesData) {
        setBonuses(bonusesData.map(b => ({
          id: b.id,
          streak_type: b.streak_type as 'homework' | 'attendance',
          milestone: b.milestone,
          points_awarded: b.points_awarded,
          awarded_at: b.awarded_at
        })));
      }

      setLoading(false);
    };

    fetchData();
  }, [studentId]);

  return { streaks, attendance, stats, bonuses, loading };
}
