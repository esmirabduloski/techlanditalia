-- Create enum for booking status
CREATE TYPE public.booking_status AS ENUM ('pending', 'contacted', 'scheduled', 'completed', 'cancelled');

-- Create trial_bookings table
CREATE TABLE public.trial_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  child_age INTEGER NOT NULL,
  interest TEXT NOT NULL,
  availability TEXT,
  message TEXT,
  status booking_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trial_bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (public form submission)
CREATE POLICY "Anyone can submit booking request"
ON public.trial_bookings
FOR INSERT
WITH CHECK (true);

-- Policy: Only admins can read all bookings
CREATE POLICY "Admins can read all bookings"
ON public.trial_bookings
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Only admins can update bookings
CREATE POLICY "Admins can update bookings"
ON public.trial_bookings
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Only admins can delete bookings
CREATE POLICY "Admins can delete bookings"
ON public.trial_bookings
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_trial_bookings_updated_at
BEFORE UPDATE ON public.trial_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();