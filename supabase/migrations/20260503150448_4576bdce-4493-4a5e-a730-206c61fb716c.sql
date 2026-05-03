-- Revoke EXECUTE from anon/authenticated on trigger-only and cleanup functions.
-- These functions are intended to be invoked by triggers or service-role cron jobs only.
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'handle_new_user()',
    'update_updated_at_column()',
    'update_attendance_streak()',
    'update_group_attendance_streak()',
    'update_homework_streak()',
    'calculate_lesson_points()',
    'calculate_task_points()',
    'calculate_homework_points()',
    'calculate_graded_homework_points()',
    'check_and_award_badges()',
    'check_streak_bonuses()',
    'decrement_lesson_balance()',
    'generate_homework_deadlines()',
    'sync_crm_lead_from_newsletter()',
    'sync_crm_lead_from_trial()',
    'sync_crm_lead_from_contact()',
    'log_crm_stage_change()',
    'notify_teacher_group_assignment()',
    'enroll_admin_in_all_courses()',
    'enroll_admins_in_new_course()',
    'auto_generate_lesson_schedule()',
    'check_student_course_uniqueness()',
    'update_student_points()',
    'cleanup_old_logs()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated, public', fn);
    EXCEPTION WHEN undefined_function THEN
      -- skip missing functions
      NULL;
    END;
  END LOOP;
END $$;
