import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date().toISOString();
  const published: string[] = [];

  // 1) Publish posts with scheduled_publish_at <= now
  const { data: scheduled } = await supabase
    .from('blog_posts')
    .select('id, title')
    .eq('published', false)
    .not('scheduled_publish_at', 'is', null)
    .lte('scheduled_publish_at', now);

  for (const post of scheduled ?? []) {
    const { error } = await supabase
      .from('blog_posts')
      .update({ published: true })
      .eq('id', post.id);
    if (!error) published.push(`scheduled: ${post.title}`);
  }

  // 2) Auto-publish queue: 1 per day at configured hour
  const { data: settings } = await supabase
    .from('blog_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (settings?.auto_publish_enabled) {
    const nowDate = new Date();
    const currentHour = nowDate.getUTCHours();
    const targetHour = settings.publish_hour ?? 12;
    // Allow ±1h window to avoid double-publish; also check last_auto_publish_at date
    const lastPub = settings.last_auto_publish_at ? new Date(settings.last_auto_publish_at) : null;
    const today = nowDate.toISOString().slice(0, 10);
    const lastPubDay = lastPub ? lastPub.toISOString().slice(0, 10) : null;

    if (currentHour >= targetHour && lastPubDay !== today) {
      const { data: next } = await supabase
        .from('blog_posts')
        .select('id, title')
        .eq('published', false)
        .eq('auto_publish_queue', true)
        .order('queue_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (next) {
        const { error } = await supabase
          .from('blog_posts')
          .update({ published: true })
          .eq('id', next.id);
        if (!error) {
          published.push(`queue: ${next.title}`);
          await supabase
            .from('blog_settings')
            .update({ last_auto_publish_at: now })
            .eq('id', settings.id);
        }
      }
    }
  }

  return new Response(JSON.stringify({ published, count: published.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
