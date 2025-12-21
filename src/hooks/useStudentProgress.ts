import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Profile {
  id: string;
  full_name: string;
  role: string;
  avatar_id: number;
  total_points: number;
  parent_id: string | null;
}

interface Enrollment {
  id: string;
  course_id: string;
  status: string;
  enrolled_at: string;
  course: {
    id: string;
    title: string;
    slug: string;
    emoji: string;
    total_lessons: number;
    level: string;
    description: string | null;
  };
}

interface LessonProgress {
  id: string;
  lesson_id: string;
  completed_at: string;
  points_earned: number;
}

interface HomeworkSubmission {
  id: string;
  homework_id: string;
  status: string;
  submitted_at: string;
  points_earned: number;
}

export function useStudentProgress() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [lessonProgress, setLessonProgress] = useState<LessonProgress[]>([]);
  const [homeworkSubmissions, setHomeworkSubmissions] = useState<HomeworkSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStudentData();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchStudentData = async () => {
    if (!user) return;

    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as Profile);
      }

      // Fetch enrollments with course info
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select(`
          id,
          course_id,
          status,
          enrolled_at,
          course:courses (
            id,
            title,
            slug,
            emoji,
            total_lessons,
            level,
            description
          )
        `)
        .eq('student_id', user.id)
        .eq('status', 'active');

      if (enrollmentsData) {
        // Transform the data to match our interface
        const transformedEnrollments = enrollmentsData
          .filter(e => e.course !== null)
          .map(e => ({
            ...e,
            course: Array.isArray(e.course) ? e.course[0] : e.course,
          })) as Enrollment[];
        setEnrollments(transformedEnrollments);
      }

      // Fetch lesson progress
      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('student_id', user.id);

      if (progressData) {
        setLessonProgress(progressData as LessonProgress[]);
      }

      // Fetch homework submissions
      const { data: submissionsData } = await supabase
        .from('homework_submissions')
        .select('*')
        .eq('student_id', user.id);

      if (submissionsData) {
        setHomeworkSubmissions(submissionsData as HomeworkSubmission[]);
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateAvatar = async (avatarId: number) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_id: avatarId })
        .eq('id', user.id);

      if (!error) {
        setProfile(prev => prev ? { ...prev, avatar_id: avatarId } : null);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Points are automatically calculated by database trigger - no client value accepted
  const completeLesson = async (lessonId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('lesson_progress')
        .insert({
          student_id: user.id,
          lesson_id: lessonId,
          // points_earned is set by database trigger from lessons.points_reward
        });

      if (!error) {
        await fetchStudentData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Points are automatically calculated by database trigger - no client value accepted
  const submitHomework = async (homeworkId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('homework_submissions')
        .insert({
          student_id: user.id,
          homework_id: homeworkId,
          // points_earned is set by database trigger from homework.points_reward
        });

      if (!error) {
        await fetchStudentData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const getCourseProgress = (courseId: string, totalLessons: number) => {
    const completedCount = lessonProgress.filter(p => {
      // This is a simplified check - in production you'd want to join with lessons table
      return true; // Will be refined when we fetch lessons for specific course
    }).length;

    return {
      completed: completedCount,
      total: totalLessons,
      percentage: totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0,
    };
  };

  return {
    profile,
    enrollments,
    lessonProgress,
    homeworkSubmissions,
    isLoading,
    updateAvatar,
    completeLesson,
    submitHomework,
    getCourseProgress,
    refetch: fetchStudentData,
  };
}
