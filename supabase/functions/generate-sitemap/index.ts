import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = 'https://techlanditalia.it';

interface UrlEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

const STATIC_PAGES: UrlEntry[] = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/corsi', changefreq: 'weekly', priority: '0.9' },
  { loc: '/prenota', changefreq: 'monthly', priority: '0.9' },
  { loc: '/blog', changefreq: 'daily', priority: '0.8' },
  { loc: '/faq', changefreq: 'monthly', priority: '0.7' },
  { loc: '/chi-siamo', changefreq: 'monthly', priority: '0.6' },
  { loc: '/contatti', changefreq: 'monthly', priority: '0.6' },
  { loc: '/lavora-con-noi', changefreq: 'monthly', priority: '0.5' },
  { loc: '/accessibilita', changefreq: 'yearly', priority: '0.4' },
  { loc: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { loc: '/termini', changefreq: 'yearly', priority: '0.3' },
  { loc: '/cookie', changefreq: 'yearly', priority: '0.3' },
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toUrlXml(entry: UrlEntry): string {
  const parts = [`    <loc>${escapeXml(BASE_URL + entry.loc)}</loc>`];
  if (entry.lastmod) parts.push(`    <lastmod>${entry.lastmod}</lastmod>`);
  if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  if (entry.priority) parts.push(`    <priority>${entry.priority}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date().toISOString().split('T')[0];
    const urls: UrlEntry[] = STATIC_PAGES.map(p => ({ ...p, lastmod: p.lastmod || today }));

    // Fetch courses (visible only)
    const { data: courses } = await supabase
      .from('courses')
      .select('slug, created_at')
      .eq('is_visible', true);

    if (courses) {
      for (const c of courses) {
        urls.push({
          loc: `/corsi/${c.slug}`,
          lastmod: (c.created_at || today).split('T')[0],
          changefreq: 'monthly',
          priority: '0.8',
        });
      }
    }

    // Fetch published blog posts
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at')
      .eq('published', true);

    if (posts) {
      for (const p of posts) {
        urls.push({
          loc: `/blog/${p.slug}`,
          lastmod: (p.updated_at || today).split('T')[0],
          changefreq: 'monthly',
          priority: '0.7',
        });
      }
    }

    // Fetch active landing pages
    const { data: landings } = await supabase
      .from('landing_pages')
      .select('slug, updated_at')
      .eq('is_active', true);

    if (landings) {
      for (const l of landings) {
        urls.push({
          loc: `/lp/${l.slug}`,
          lastmod: (l.updated_at || today).split('T')[0],
          changefreq: 'weekly',
          priority: '0.7',
        });
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(toUrlXml).join('\n')}
</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
      status: 200,
    });
  } catch (error) {
    console.error('Sitemap generation error:', error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<error>${(error as Error).message}</error>`,
      { headers: { ...corsHeaders, 'Content-Type': 'application/xml' }, status: 500 }
    );
  }
});
