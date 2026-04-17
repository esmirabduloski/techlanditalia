-- Add scheduling fields to blog_posts
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_publish_queue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS queue_order integer;

CREATE INDEX IF NOT EXISTS idx_blog_posts_scheduled ON public.blog_posts(scheduled_publish_at) WHERE published = false AND scheduled_publish_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_queue ON public.blog_posts(queue_order) WHERE published = false AND auto_publish_queue = true;

-- Settings table
CREATE TABLE IF NOT EXISTS public.blog_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_publish_enabled boolean NOT NULL DEFAULT false,
  publish_hour integer NOT NULL DEFAULT 12,
  last_auto_publish_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view blog settings"
  ON public.blog_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage blog settings"
  ON public.blog_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_blog_settings_updated_at
  BEFORE UPDATE ON public.blog_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed singleton row
INSERT INTO public.blog_settings (auto_publish_enabled, publish_hour)
SELECT false, 12
WHERE NOT EXISTS (SELECT 1 FROM public.blog_settings);