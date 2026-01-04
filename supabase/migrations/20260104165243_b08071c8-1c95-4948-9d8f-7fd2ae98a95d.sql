-- Create teacher_links table for admin-managed useful links
CREATE TABLE public.teacher_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'link',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teacher_links ENABLE ROW LEVEL SECURITY;

-- Admin can manage all links
CREATE POLICY "Admins can manage teacher links" ON public.teacher_links
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Teachers can view active links only
CREATE POLICY "Teachers can view active links" ON public.teacher_links
  FOR SELECT USING (has_role(auth.uid(), 'teacher'::app_role) AND is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_teacher_links_updated_at
  BEFORE UPDATE ON public.teacher_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();