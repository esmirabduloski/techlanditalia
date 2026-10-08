import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeadersFor } from "../_shared/cors.ts";
import { submitToIndexNow } from "../_shared/indexnow.ts";


Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Solo il cron orario (token interno) o un admin: prima chiunque poteva lanciarla
  // e far partire le notifiche IndexNow.
  const cronToken = req.headers.get('x-cron-token') ?? '';
  let authorized = false;
  if (cronToken) {
    const { data: ok } = await supabase.rpc('verify_cron_token', { _name: 'blog-auto-publish', _token: cronToken });
    authorized = ok === true;
  }
  if (!authorized) {
    const auth = req.headers.get('Authorization');
    if (auth?.startsWith('Bearer ')) {
      const { data: { user } } = await supabase.auth.getUser(auth.slice(7));
      if (user) {
        const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
        authorized = Boolean(role);
      }
    }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Non autorizzato' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  const published: string[] = [];
  const publishedSlugs: string[] = [];

  // 1) Publish posts with scheduled_publish_at <= now
  const { data: scheduled } = await supabase
    .from('blog_posts')
    .select('id, title, slug')
    .eq('published', false)
    .not('scheduled_publish_at', 'is', null)
    .lte('scheduled_publish_at', now);

  for (const post of scheduled ?? []) {
    const { error } = await supabase
      .from('blog_posts')
      .update({ published: true })
      .eq('id', post.id);
    if (!error) {
      published.push(`scheduled: ${post.title}`);
      publishedSlugs.push(post.slug);
    }
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
        .select('id, title, slug')
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
          publishedSlugs.push(next.slug);
          await supabase
            .from('blog_settings')
            .update({ last_auto_publish_at: now })
            .eq('id', settings.id);
        }
      }
    }
  }

  // Notifica IndexNow (Bing & co.) dei nuovi articoli + indice blog. Best effort,
  // non blocca la risposta.
  if (publishedSlugs.length) {
    await submitToIndexNow(['/blog', ...publishedSlugs.map((slug) => `/blog/${slug}`)]);
  }

  return new Response(JSON.stringify({ published, count: published.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
