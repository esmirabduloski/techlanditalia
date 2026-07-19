import { useEffect, useState } from 'react';
import { useParams, Link, useLoaderData, type LoaderFunctionArgs } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { Layout } from '@/components/layout/Layout';
import { SEOHead, generateBlogPostSchema } from '@/components/seo/SEOHead';
import { SEOBreadcrumb } from '@/components/seo/SEOBreadcrumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Clock, Calendar, Loader2 } from 'lucide-react';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image: string | null;
  category: string;
  read_time: string | null;
  created_at: string;
  updated_at?: string | null;
}

const categoryColors: Record<string, string> = {
  Educazione: "bg-tech-green/10 text-tech-green",
  Guida: "bg-tech-teal/10 text-tech-teal",
  Genitori: "bg-tech-cyan/10 text-tech-cyan",
  Gaming: "bg-tech-blue/10 text-tech-blue",
  Futuro: "bg-tech-emerald/10 text-tech-emerald",
  Sicurezza: "bg-tech-mint/10 text-tech-mint",
  Tutorial: "bg-primary/10 text-primary",
  Novità: "bg-secondary/10 text-secondary",
};

// Simple markdown parser for basic formatting.
// Note: `#` is intentionally degraded to h2 — the article page already renders the title as h1,
// keeping a single h1 per page. Editors using `#` will still see a visible heading.
function parseMarkdown(text: string): string {
  return text
    .replace(/^#### (.*$)/gim, '<h4 class="text-lg font-semibold mt-5 mb-2">$1</h4>')
    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-6 mb-3">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>')
    .replace(/^# (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-xl my-6 max-w-sm w-full shadow-md" loading="lazy" />')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(((\/[^)]+))\)/g, '<a href="$2" class="text-primary hover:underline font-medium">$1</a>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-4">')
    .replace(/\n/g, '<br>');
}

async function fetchPostBySlug(slug: string | undefined): Promise<BlogPost | null> {
  if (!slug) return null;
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  return error ? null : (data as BlogPost | null);
}

// Eseguito da vite-react-ssg a build-time (contenuto nell'HTML statico).
// Per gli articoli pubblicati DOPO l'ultima build il manifest statico restituisce
// null e il componente ripiega sul fetch client-side qui sotto.
export async function loader({ params }: LoaderFunctionArgs) {
  return fetchPostBySlug(params.slug);
}

export default function BlogArticle() {
  const { slug } = useParams();
  const loaderPost = useLoaderData() as BlogPost | null | undefined;
  const [post, setPost] = useState<BlogPost | null>(loaderPost ?? null);
  const [isLoading, setIsLoading] = useState(!loaderPost);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (loaderPost && loaderPost.slug === slug) {
      setPost(loaderPost);
      setIsLoading(false);
      setNotFound(false);
      return;
    }
    // Fallback client-side: articolo fuori dal manifest di build (es. appena pubblicato)
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);
    fetchPostBySlug(slug).then((data) => {
      if (cancelled) return;
      if (!data) setNotFound(true);
      else setPost(data);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, loaderPost]);

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (notFound || !post) {
    return (
      <Layout>
        <div className="tech-section">
          <div className="tech-container text-center">
            <h1 className="text-3xl font-bold mb-4">Articolo non trovato</h1>
            <p className="text-muted-foreground mb-8">
              L'articolo che stai cercando non esiste o non è più disponibile.
            </p>
            <Button asChild>
              <Link to="/blog">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Torna al blog
              </Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Schema.org per BlogPosting (generated centrally to avoid drift)
  const articleSchema = generateBlogPostSchema({
    title: post.title,
    description: post.excerpt || `Articolo su ${post.category} - TECHLAND`,
    slug: post.slug,
    datePublished: post.created_at,
    dateModified: post.updated_at || post.created_at,
    image: post.featured_image || undefined,
    author: 'TECHLAND',
  });

  return (
    <Layout>
      <SEOHead
        title={`${post.title} | Blog TECHLAND`}
        description={post.excerpt || `Scopri di più su ${post.title}. Articoli e guide sulla programmazione per bambini e ragazzi.`}
        canonical={`https://techlanditalia.it/blog/${post.slug}`}
        ogImage={post.featured_image || undefined}
        ogType="article"
        article={{
          publishedTime: post.created_at,
          modifiedTime: post.updated_at || post.created_at,
          author: "TECHLAND",
          section: post.category,
        }}
        schemaData={articleSchema}
      />
      
      {/* Hero */}
      <section className="tech-section bg-gradient-to-b from-tech-green-light to-background dark:from-background dark:to-background">
        <div className="tech-container">
          <div className="max-w-3xl mx-auto">
            <SEOBreadcrumb 
              items={[
                { label: "Blog", href: "/blog" },
                { label: post.title }
              ]} 
              className="mb-6"
            />
            
            <div className="flex items-center gap-3 mb-4">
              <Badge className={categoryColors[post.category] || 'bg-muted'}>
                {post.category}
              </Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {post.read_time || '5 min'}
              </span>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(post.created_at).toLocaleDateString('it-IT', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              {post.title}
            </h1>

            {post.excerpt && (
              <p className="text-lg text-muted-foreground">
                {post.excerpt}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Featured Image */}
      {post.featured_image && (
        <section className="tech-container -mt-8">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl overflow-hidden shadow-xl">
              <img
                src={post.featured_image}
                alt={post.title}
                width={1200}
                height={675}
                loading="lazy"
                className="w-full aspect-video object-cover"
              />
            </div>
          </div>
        </section>
      )}

      {/* Content */}
      <section className="tech-section">
        <div className="tech-container">
          <article className="max-w-3xl mx-auto">
            <div 
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: DOMPurify.sanitize(`<p class="mb-4">${parseMarkdown(post.content)}</p>`, {
                  ALLOWED_TAGS: ['h2', 'h3', 'h4', 'p', 'strong', 'em', 'a', 'li', 'br', 'img'],
                  ALLOWED_ATTR: ['href', 'class', 'target', 'rel', 'src', 'alt', 'loading'],
                })
              }}
            />
          </article>
        </div>
      </section>

      {/* CTA */}
      <section className="tech-section bg-muted/30">
        <div className="tech-container">
          <div className="tech-card p-8 md:p-12 text-center max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Vuoi far provare il coding a tuo figlio?
            </h2>
            <p className="text-muted-foreground mb-6">
              Prenota una lezione di prova gratuita e scopri come TECHLAND può aiutare tuo figlio a sviluppare competenze digitali.
            </p>
            <Button size="lg" asChild>
              <Link to="/prenota">Prenota Lezione Gratuita</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
