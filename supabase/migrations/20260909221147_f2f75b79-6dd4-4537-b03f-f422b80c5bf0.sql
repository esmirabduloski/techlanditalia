CREATE TABLE public.push_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_templates TO authenticated;
GRANT ALL ON public.push_templates TO service_role;

ALTER TABLE public.push_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage push templates"
ON public.push_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_push_templates_updated_at
BEFORE UPDATE ON public.push_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();