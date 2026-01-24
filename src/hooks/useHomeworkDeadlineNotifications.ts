import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface HomeworkDeadline {
  id: string;
  title: string;
  dueDate: Date;
  courseTitle: string;
  courseEmoji: string;
  hoursRemaining: number;
}

export function useHomeworkDeadlineNotifications() {
  const { user } = useAuth();
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<HomeworkDeadline[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    // Load dismissed notifications from localStorage
    const stored = localStorage.getItem('dismissed_homework_notifications');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Clear old dismissed IDs (older than 48 hours)
        const now = Date.now();
        const validIds = Object.entries(parsed)
          .filter(([_, timestamp]) => now - (timestamp as number) < 48 * 60 * 60 * 1000)
          .map(([id]) => id);
        return new Set(validIds);
      } catch {
        return new Set();
      }
    }
    return new Set();
  });

  const dismissNotification = useCallback((homeworkId: string) => {
    setDismissedIds(prev => {
      const newSet = new Set(prev);
      newSet.add(homeworkId);
      
      // Save to localStorage with timestamp
      const stored = localStorage.getItem('dismissed_homework_notifications');
      const parsed = stored ? JSON.parse(stored) : {};
      parsed[homeworkId] = Date.now();
      localStorage.setItem('dismissed_homework_notifications', JSON.stringify(parsed));
      
      return newSet;
    });
    
    // Remove from upcoming deadlines
    setUpcomingDeadlines(prev => prev.filter(d => d.id !== homeworkId));
  }, []);

  const fetchUpcomingDeadlines = useCallback(async () => {
    if (!user) return;

    try {
      // Get student's enrolled courses
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', user.id)
        .eq('status', 'active');

      if (!enrollments || enrollments.length === 0) return;

      const courseIds = enrollments.map(e => e.course_id);

      // Get student's group to determine group-specific deadlines
      const { data: studentGroup } = await supabase
        .from('group_students')
        .select('group_id')
        .eq('student_id', user.id)
        .maybeSingle();

      // Get lessons for enrolled courses
      const { data: lessons } = await supabase
        .from('lessons')
        .select('id, course_id, courses(title, emoji)')
        .in('course_id', courseIds);

      if (!lessons || lessons.length === 0) return;

      const lessonIds = lessons.map(l => l.id);

      // Get homework (with or without global due dates)
      const { data: homeworkData } = await supabase
        .from('homework')
        .select('id, title, due_date, lesson_id')
        .in('lesson_id', lessonIds);

      if (!homeworkData) return;

      // Get group-specific deadlines if student is in a group
      let groupDeadlinesMap = new Map<string, string>();
      if (studentGroup?.group_id) {
        const { data: groupDeadlines } = await supabase
          .from('homework_group_deadlines')
          .select('homework_id, due_date')
          .eq('group_id', studentGroup.group_id);
        
        groupDeadlinesMap = new Map(
          groupDeadlines?.map((d) => [d.homework_id, d.due_date]) || []
        );
      }

      // Get student's submissions
      const { data: submissions } = await supabase
        .from('homework_submissions')
        .select('homework_id')
        .eq('student_id', user.id);

      const submittedIds = new Set(submissions?.map(s => s.homework_id) || []);

      const now = new Date();
      const deadlines: HomeworkDeadline[] = [];

      for (const hw of homeworkData) {
        // Skip already submitted homework
        if (submittedIds.has(hw.id)) continue;
        
        // Skip dismissed notifications
        if (dismissedIds.has(hw.id)) continue;

        // Use group-specific deadline if available, otherwise fall back to global due_date
        const effectiveDueDate = groupDeadlinesMap.get(hw.id) || hw.due_date;
        
        // Skip if no deadline at all
        if (!effectiveDueDate) continue;

        const dueDate = new Date(effectiveDueDate);
        const hoursRemaining = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        // Only show notifications for homework due within 72 hours and not expired
        if (hoursRemaining > 0 && hoursRemaining <= 72) {
          const lesson = lessons.find(l => l.id === hw.lesson_id);
          const course = lesson?.courses as { title: string; emoji: string } | null;

          deadlines.push({
            id: hw.id,
            title: hw.title,
            dueDate,
            courseTitle: course?.title || 'Corso',
            courseEmoji: course?.emoji || '📚',
            hoursRemaining,
          });
        }
      }

      // Sort by urgency (least time remaining first)
      deadlines.sort((a, b) => a.hoursRemaining - b.hoursRemaining);

      setUpcomingDeadlines(deadlines);
    } catch (error) {
      console.error('Error fetching homework deadlines:', error);
    }
  }, [user, dismissedIds]);

  useEffect(() => {
    fetchUpcomingDeadlines();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchUpcomingDeadlines, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fetchUpcomingDeadlines]);

  return {
    upcomingDeadlines,
    dismissNotification,
    refetch: fetchUpcomingDeadlines,
  };
}
