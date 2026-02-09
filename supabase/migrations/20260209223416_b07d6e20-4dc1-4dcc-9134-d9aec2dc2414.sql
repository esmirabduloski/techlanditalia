
-- Add lesson_time to student_groups (default time for the group)
ALTER TABLE public.student_groups ADD COLUMN lesson_time time WITHOUT TIME ZONE DEFAULT NULL;

-- Add lesson_time to group_lesson_schedule (per-lesson override)
ALTER TABLE public.group_lesson_schedule ADD COLUMN lesson_time time WITHOUT TIME ZONE DEFAULT NULL;
