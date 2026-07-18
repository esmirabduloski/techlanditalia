CREATE OR REPLACE FUNCTION public.ensure_blog_post_in_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- If the post is scheduled (has a publish date) and not yet published,
  -- it MUST be in the auto-publish queue.
  IF NEW.scheduled_publish_at IS NOT NULL AND COALESCE(NEW.published, false) = false THEN
    NEW.auto_publish_queue := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_blog_post_in_queue ON public.blog_posts;
CREATE TRIGGER trg_ensure_blog_post_in_queue
  BEFORE INSERT OR UPDATE OF scheduled_publish_at, published, auto_publish_queue
  ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_blog_post_in_queue();