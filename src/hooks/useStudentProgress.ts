import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';

interface Profile {
  id: string;
  full_name: string;
  role: string;
  avatar_id: number;
  total_points: number;
  lesson_balance: number;
  parent_id: string | null;
  onboarding_completed: boolean | null;
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

interface TaskProgress {
  id: string;
  task_id: string;
  completed_at: string;
  points_earned: number;
}

export function useStudentProgress() {
  const { user, isAdmin } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  
  // Use impersonated user ID if admin is impersonating
  const effectiveUserId = isAdmin && isImpersonating && impersonatedUser
    ? impersonatedUser.id
    : user?.id;
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [lessonProgress, setLessonProgress] = useState<LessonProgress[]>([]);
  const [homeworkSubmissions, setHomeworkSubmissions] = useState<HomeworkSubmission[]>([]);
  const [taskProgress, setTaskProgress] = useState<TaskProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (effectiveUserId) {
      fetchStudentData();
    } else {
      setIsLoading(false);
    }
  }, [effectiveUserId]);

  const fetchStudentData = async () => {
    if (!effectiveUserId) return;

    setIsLoading(true);
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', effectiveUserId)
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
        .eq('student_id', effectiveUserId)
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
        .eq('student_id', effectiveUserId);

      if (progressData) {
        setLessonProgress(progressData as LessonProgress[]);
      }

      // Fetch homework submissions
      const { data: submissionsData } = await supabase
        .from('homework_submissions')
        .select('*')
        .eq('student_id', effectiveUserId);

      if (submissionsData) {
        setHomeworkSubmissions(submissionsData as HomeworkSubmission[]);
      }

      // Fetch task progress
      const { data: taskProgressData } = await supabase
        .from('task_progress')
        .select('*')
        .eq('student_id', effectiveUserId);

      if (taskProgressData) {
        setTaskProgress(taskProgressData as TaskProgress[]);
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateAvatar = async (avatarId: number) => {
    if (!effectiveUserId) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_id: avatarId })
        .eq('id', effectiveUserId);

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
    if (!effectiveUserId) return false;

    try {
      const { error } = await supabase
        .from('lesson_progress')
        .insert({
          student_id: effectiveUserId,
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
  const submitHomework = async (homeworkId: string, fileUrl?: string, fileName?: string, fileType?: string) => {
    if (!effectiveUserId) return false;

    try {
      const insertData: {
        student_id: string;
        homework_id: string;
        file_url?: string;
        file_name?: string;
        file_type?: string;
      } = {
        student_id: effectiveUserId,
        homework_id: homeworkId,
      };

      if (fileUrl) insertData.file_url = fileUrl;
      if (fileName) insertData.file_name = fileName;
      if (fileType) insertData.file_type = fileType;

      const { error } = await supabase
        .from('homework_submissions')
        .insert(insertData);

      if (!error) {
        await fetchStudentData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const completeTask = async (taskId: string) => {
    if (!effectiveUserId) return false;

    // Check if already completed
    if (taskProgress.some(p => p.task_id === taskId)) {
      return true;
    }

    try {
      const { error } = await supabase
        .from('task_progress')
        .insert({
          student_id: effectiveUserId,
          task_id: taskId,
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

  const isTaskCompleted = (taskId: string) => {
    return taskProgress.some(p => p.task_id === taskId);
  };

  return {
    profile,
    enrollments,
    lessonProgress,
    homeworkSubmissions,
    taskProgress,
    isLoading,
    updateAvatar,
    completeLesson,
    submitHomework,
    completeTask,
    isTaskCompleted,
    refetch: fetchStudentData,
    effectiveUserId,
    isImpersonating: isAdmin && isImpersonating,
  };
}
