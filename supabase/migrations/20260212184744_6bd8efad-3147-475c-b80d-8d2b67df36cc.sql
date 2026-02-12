
-- Add lesson_balance to profiles
ALTER TABLE public.profiles ADD COLUMN lesson_balance integer NOT NULL DEFAULT 0;

-- Create lesson balance log table
CREATE TABLE public.lesson_balance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  operation_type text NOT NULL, -- 'lesson_completed', 'credit_added', 'credit_removed'
  amount integer NOT NULL,
  balance_before integer NOT NULL,
  balance_after integer NOT NULL,
  performed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lesson_balance_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage all balance logs"
  ON public.lesson_balance_log FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can view balance logs for their students"
  ON public.lesson_balance_log FOR SELECT
  USING (public.is_teacher_of_student(auth.uid(), student_id));

CREATE POLICY "Students can view their own balance logs"
  ON public.lesson_balance_log FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Parents can view children balance logs"
  ON public.lesson_balance_log FOR SELECT
  USING (public.is_parent_of(auth.uid(), student_id));

-- Trigger: auto-decrement balance on lesson completion
CREATE OR REPLACE FUNCTION public.decrement_lesson_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance integer;
BEGIN
  SELECT lesson_balance INTO current_balance FROM profiles WHERE id = NEW.student_id;
  
  -- Decrement balance (allow going to 0 but not negative)
  UPDATE profiles SET lesson_balance = GREATEST(current_balance - 1, 0) WHERE id = NEW.student_id;
  
  -- Log the operation
  INSERT INTO lesson_balance_log (student_id, operation_type, amount, balance_before, balance_after, performed_by, notes)
  VALUES (
    NEW.student_id,
    'lesson_completed',
    -1,
    current_balance,
    GREATEST(current_balance - 1, 0),
    NEW.student_id,
    'Lezione completata automaticamente'
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_lesson_progress_decrement_balance
  AFTER INSERT ON public.lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_lesson_balance();

-- Index for performance
CREATE INDEX idx_lesson_balance_log_student ON public.lesson_balance_log(student_id);
CREATE INDEX idx_lesson_balance_log_created ON public.lesson_balance_log(created_at DESC);
