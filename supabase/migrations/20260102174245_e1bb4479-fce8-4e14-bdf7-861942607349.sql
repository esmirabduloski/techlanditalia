-- Create notifications table for teachers
CREATE TABLE public.teacher_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teacher_notifications ENABLE ROW LEVEL SECURITY;

-- Teachers can view their own notifications
CREATE POLICY "Teachers can view their notifications"
ON public.teacher_notifications
FOR SELECT
USING (auth.uid() = teacher_id);

-- Teachers can update their notifications (mark as read)
CREATE POLICY "Teachers can update their notifications"
ON public.teacher_notifications
FOR UPDATE
USING (auth.uid() = teacher_id);

-- Admins can manage all notifications
CREATE POLICY "Admins can manage all notifications"
ON public.teacher_notifications
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_teacher_notifications_teacher_id ON public.teacher_notifications(teacher_id);
CREATE INDEX idx_teacher_notifications_is_read ON public.teacher_notifications(teacher_id, is_read);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_notifications;

-- Create function to notify teacher when assigned to a group
CREATE OR REPLACE FUNCTION public.notify_teacher_group_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  group_title TEXT;
  course_title TEXT;
BEGIN
  -- Only trigger when teacher_id is set or changed
  IF NEW.teacher_id IS NOT NULL AND (OLD.teacher_id IS NULL OR OLD.teacher_id != NEW.teacher_id) THEN
    -- Get group and course info
    SELECT sg.title, c.title INTO group_title, course_title
    FROM student_groups sg
    JOIN courses c ON c.id = sg.course_id
    WHERE sg.id = NEW.id;
    
    -- Create notification for the teacher
    INSERT INTO public.teacher_notifications (teacher_id, type, title, message, metadata)
    VALUES (
      NEW.teacher_id,
      'group_assignment',
      'Nuovo Gruppo Assegnato',
      'Ti è stato assegnato il gruppo "' || group_title || '" per il corso "' || course_title || '"',
      jsonb_build_object('group_id', NEW.id, 'group_title', group_title, 'course_title', course_title)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for group assignment
CREATE TRIGGER on_group_teacher_assignment
  AFTER INSERT OR UPDATE ON public.student_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_teacher_group_assignment();