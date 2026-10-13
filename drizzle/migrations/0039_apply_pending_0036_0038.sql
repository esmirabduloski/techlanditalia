GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_proposals TO authenticated;
GRANT ALL ON public.course_proposals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_reports TO authenticated;
GRANT ALL ON public.monthly_reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.satisfaction_surveys TO authenticated;
GRANT ALL ON public.satisfaction_surveys TO service_role;