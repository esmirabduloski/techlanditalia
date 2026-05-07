
-- Allow admins to update any profile (needed for lesson_balance changes)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger function: decrement lesson_balance when group attendance is marked 'present'
CREATE OR REPLACE FUNCTION public.decrement_lesson_balance_on_group_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_balance integer;
  should_decrement boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'present' THEN
      should_decrement := true;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'present' AND (OLD.status IS DISTINCT FROM 'present') THEN
      should_decrement := true;
    ELSIF OLD.status = 'present' AND (NEW.status IS DISTINCT FROM 'present') THEN
      -- Refund a lesson if attendance changed from present to something else
      SELECT lesson_balance INTO current_balance FROM profiles WHERE id = NEW.student_id;
      UPDATE profiles SET lesson_balance = COALESCE(current_balance,0) + 1 WHERE id = NEW.student_id;
      INSERT INTO lesson_balance_log (student_id, operation_type, amount, balance_before, balance_after, performed_by, notes)
      VALUES (NEW.student_id, 'credit_added', 1, COALESCE(current_balance,0), COALESCE(current_balance,0)+1, NEW.marked_by, 'Rimborso: presenza modificata da present');
      RETURN NEW;
    END IF;
  END IF;

  IF should_decrement THEN
    SELECT lesson_balance INTO current_balance FROM profiles WHERE id = NEW.student_id;
    UPDATE profiles SET lesson_balance = GREATEST(COALESCE(current_balance,0) - 1, 0) WHERE id = NEW.student_id;
    INSERT INTO lesson_balance_log (student_id, operation_type, amount, balance_before, balance_after, performed_by, notes)
    VALUES (
      NEW.student_id, 'lesson_completed', -1,
      COALESCE(current_balance,0),
      GREATEST(COALESCE(current_balance,0) - 1, 0),
      NEW.marked_by,
      'Lezione del calendario segnata come presente (lezione ' || NEW.lesson_number || ')'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS decrement_balance_on_group_attendance ON public.group_attendance;
CREATE TRIGGER decrement_balance_on_group_attendance
AFTER INSERT OR UPDATE ON public.group_attendance
FOR EACH ROW
EXECUTE FUNCTION public.decrement_lesson_balance_on_group_attendance();

-- Recompute current balance for all students based on log history
-- (This fixes Esmir's balance and any others affected by the missing UPDATE policy)
UPDATE public.profiles p
SET lesson_balance = sub.computed
FROM (
  SELECT student_id, GREATEST(COALESCE(SUM(amount),0), 0)::int AS computed
  FROM public.lesson_balance_log
  GROUP BY student_id
) sub
WHERE p.id = sub.student_id
  AND p.lesson_balance <> sub.computed;
