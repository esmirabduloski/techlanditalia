-- Aggiunge campi per codice predefinito nei compilatori per le task
ALTER TABLE public.lesson_tasks
ADD COLUMN default_python_code TEXT DEFAULT NULL,
ADD COLUMN default_html_code TEXT DEFAULT NULL,
ADD COLUMN default_css_code TEXT DEFAULT NULL,
ADD COLUMN default_js_code TEXT DEFAULT NULL;

-- Commento esplicativo
COMMENT ON COLUMN public.lesson_tasks.default_python_code IS 'Codice Python predefinito da caricare nel compilatore per questa task';
COMMENT ON COLUMN public.lesson_tasks.default_html_code IS 'Codice HTML predefinito da caricare nel compilatore web per questa task';
COMMENT ON COLUMN public.lesson_tasks.default_css_code IS 'Codice CSS predefinito da caricare nel compilatore web per questa task';
COMMENT ON COLUMN public.lesson_tasks.default_js_code IS 'Codice JavaScript predefinito da caricare nel compilatore web per questa task';