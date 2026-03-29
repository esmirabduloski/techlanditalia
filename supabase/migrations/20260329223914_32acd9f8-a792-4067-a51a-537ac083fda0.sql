-- 1. Remove trial_bookings from Realtime publication (contains PII)
ALTER PUBLICATION supabase_realtime DROP TABLE public.trial_bookings;

-- 2. Also remove contact_submissions (contains PII)
ALTER PUBLICATION supabase_realtime DROP TABLE public.contact_submissions;