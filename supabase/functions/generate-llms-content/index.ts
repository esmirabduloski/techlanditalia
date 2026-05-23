import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const BASE_URL = 'https://techlanditalia.it';

// Very lightweight HTML -> Markdown converter (good enough for blog/course bodies)
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let s = html;
  // Strip scripts/styles
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  // Headings
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
  s = s.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
  // Bold / italic
  s = s.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  s = s.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
  // Links
  s = s.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  // Images
  s = s.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi, '![$1]($2)');
  s = s.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, '![]($1)');
  // Lists
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  s = s.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');
  // Paragraphs / breaks
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>/gi, '\n\n').replace(/<p[^>]*>/gi, '');
  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n');
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');
  // Strip remaining tags
  s = s.replace(/<[^>]+>/g, '');
  // Decode common entities
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  // Collapse whitespace
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

function notFound() {
  return new Response('# Not Found\n\nThe requested resource was not found.\n', {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}

function mdResponse(body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Robots-Tag': 'index, follow',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type'); // 'blog' | 'course'
    const slug = url.searchParams.get('slug');

    if (!type || !slug) {
      return new Response(
        '# Usage\n\n`?type=blog&slug=<slug>` or `?type=course&slug=<slug>`\n',
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/markdown; charset=utf-8' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (type === 'blog') {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('slug, title, excerpt, content, category, author, published_at, updated_at, cover_image_url, published')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();

      if (error || !data) return notFound();

      const canonical = `${BASE_URL}/blog/${data.slug}`;
      const md = `---
title: "${(data.title || '').replace(/"/g, '\\"')}"
description: "${(data.excerpt || '').replace(/"/g, '\\"').slice(0, 200)}"
canonical: "${canonical}"
category: "${data.category || ''}"
author: "${data.author || 'TECHLAND'}"
published_at: "${data.published_at || ''}"
updated_at: "${data.updated_at || ''}"
---

# ${data.title}

${data.cover_image_url ? `![${data.title}](${data.cover_image_url})\n\n` : ''}${data.excerpt ? `> ${data.excerpt}\n\n` : ''}${htmlToMarkdown(data.content || '')}

---

**Articolo originale**: [${canonical}](${canonical})
**Pubblicato da**: TECHLAND — Scuola di coding online per alunni 5-20 anni
**Sito**: https://techlanditalia.it
**Prenota lezione gratuita**: https://techlanditalia.it/prenota
`;
      return mdResponse(md);
    }

    if (type === 'course') {
      const { data, error } = await supabase
        .from('courses')
        .select('slug, title, description, age_range, level, duration, total_lessons, color, is_visible')
        .eq('slug', slug)
        .eq('is_visible', true)
        .maybeSingle();

      if (error || !data) return notFound();

      const canonical = `${BASE_URL}/corsi/${data.slug}`;
      const md = `---
title: "TECHLAND | ${(data.title || '').replace(/"/g, '\\"')}"
description: "${(data.description || '').replace(/"/g, '\\"').slice(0, 200)}"
canonical: "${canonical}"
age_range: "${data.age_range || ''}"
level: "${data.level || ''}"
duration: "${data.duration || ''}"
---

# TECHLAND — ${data.title}

> ${data.description || ''}

## Dettagli del corso

- **Età consigliata**: ${data.age_range || 'N/A'}
- **Livello**: ${data.level || 'N/A'}
- **Durata**: ${data.duration || 'N/A'}
${data.total_lessons ? `- **Lezioni totali**: ${data.total_lessons}\n` : ''}- **Modalità**: Online live, max 6 alunni per gruppo
- **Lingua**: Italiano

## Cosa imparerai

${data.description || ''}

## Perché sceglierlo con TECHLAND

- Piccoli gruppi (massimo 6 alunni) per un'attenzione personalizzata
- Docenti professionisti del settore tech, formati sulla didattica per ragazzi
- Lezioni live registrate e sempre disponibili nell'area riservata
- Dashboard genitori con report settimanali
- **Prima lezione gratuita** e senza impegno

## Come iniziare

[👉 Prenota la lezione di prova gratuita](${BASE_URL}/prenota)

Per qualsiasi domanda: 📧 info@techlanditalia.it · 📞 +39 350 581 3140

---

**Pagina originale**: [${canonical}](${canonical})
**Catalogo completo**: ${BASE_URL}/corsi
**Homepage TECHLAND**: ${BASE_URL}/
`;
      return mdResponse(md);
    }

    return new Response(
      '# Invalid type\n\nUse `type=blog` or `type=course`.\n',
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/markdown; charset=utf-8' } },
    );
  } catch (err) {
    console.error('generate-llms-content error:', err);
    return new Response(
      `# Error\n\nInternal server error\n`,
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/markdown; charset=utf-8' } },
    );
  }
});
