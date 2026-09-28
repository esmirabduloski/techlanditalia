ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
UPDATE public.page_views SET created_at = entered_at WHERE entered_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_page_views_session_created ON public.page_views (session_id, created_at);