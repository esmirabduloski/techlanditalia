
-- Table for teacher lesson reports
CREATE TABLE public.lesson_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
  lesson_number integer NOT NULL,
  teacher_id uuid NOT NULL,
  topics_covered text NOT NULL DEFAULT '',
  topics_not_covered text NOT NULL DEFAULT '',
  students_needing_support uuid[] NOT NULL DEFAULT '{}',
  support_notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(group_id, lesson_number)
);

ALTER TABLE public.lesson_reports ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage lesson reports"
  ON public.lesson_reports FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Teachers can manage their own reports
CREATE POLICY "Teachers can insert own reports"
  ON public.lesson_reports FOR INSERT
  WITH CHECK (auth.uid() = teacher_id AND public.is_teacher_of_group(auth.uid(), group_id));

CREATE POLICY "Teachers can view own reports"
  ON public.lesson_reports FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update own reports"
  ON public.lesson_reports FOR UPDATE
  USING (auth.uid() = teacher_id);
