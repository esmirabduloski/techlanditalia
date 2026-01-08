-- Add default code columns to homework table for compiler support
ALTER TABLE public.homework
ADD COLUMN IF NOT EXISTS default_python_code TEXT,
ADD COLUMN IF NOT EXISTS default_html_code TEXT,
ADD COLUMN IF NOT EXISTS default_css_code TEXT,
ADD COLUMN IF NOT EXISTS default_js_code TEXT;