-- Create contact_submissions table for audit and troubleshooting
CREATE TABLE public.contact_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  oggetto TEXT NOT NULL,
  messaggio TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  email_sent BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Only admins can view submissions
CREATE POLICY "Admins can view all submissions"
ON public.contact_submissions
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Only admins can delete submissions
CREATE POLICY "Admins can delete submissions"
ON public.contact_submissions
FOR DELETE
USING (has_role(auth.uid(), 'admin'));