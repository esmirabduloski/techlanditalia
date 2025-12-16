import { useEffect, useState } from 'react';
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock, Loader2 } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  category: string;
  read_time: string | null;
  created_at: string;
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

const defaultImage = "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=600&q=80";

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, featured_image, category, read_time, created_at')
        .eq('published', true)
        .order('created_at', { ascending: false });

      setPosts(data || []);
      setIsLoading(false);
    };

    fetchPosts();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="tech-section bg-gradient-to-b from-tech-green-light to-background">
        <div className="tech-container">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Blog & Risorse
            </h1>
            <p className="text-lg text-muted-foreground">
              Articoli, guide e consigli per genitori che vogliono accompagnare i figli nel mondo della tecnologia.
            </p>
          </div>
        </div>
      </section>

      {/* Loading State */}
      {isLoading && (
        <section className="tech-section">
          <div className="tech-container flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </section>
      )}

      {/* Empty State */}
      {!isLoading && posts.length === 0 && (
        <section className="tech-section">
          <div className="tech-container">
            <div className="text-center py-20">
              <h2 className="text-2xl font-bold mb-4">Nessun articolo ancora</h2>
              <p className="text-muted-foreground">
                Torna presto per scoprire nuovi contenuti!
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Featured Article */}
      {!isLoading && posts.length > 0 && (
        <section className="tech-section pt-8">
          <div className="tech-container">
            <Link to={`/blog/${posts[0].slug}`} className="block">
              <div className="tech-card tech-card-hover overflow-hidden grid lg:grid-cols-2">
                <div className="aspect-video lg:aspect-auto">
                  <img 
                    src={posts[0].featured_image || defaultImage} 
                    alt={posts[0].title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-8 lg:p-12 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge className={categoryColors[posts[0].category] || 'bg-muted'}>
                      {posts[0].category}
                    </Badge>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {posts[0].read_time || '5 min'}
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-4">{posts[0].title}</h2>
                  <p className="text-muted-foreground mb-6">{posts[0].excerpt || 'Scopri di più...'}</p>
                  <span className="text-primary font-medium flex items-center gap-2">
                    Leggi l'articolo
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Articles Grid */}
      {!isLoading && posts.length > 1 && (
        <section className="tech-section">
          <div className="tech-container">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.slice(1).map((post) => (
                <Link 
                  key={post.id}
                  to={`/blog/${post.slug}`} 
                  className="tech-card tech-card-hover overflow-hidden group"
                >
                  <div className="aspect-video overflow-hidden">
                    <img 
                      src={post.featured_image || defaultImage} 
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge className={categoryColors[post.category] || 'bg-muted'}>
                        {post.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(post.created_at)}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                      {post.excerpt || 'Scopri di più...'}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {post.read_time || '5 min'}
                      </span>
                      <span className="text-primary font-medium flex items-center gap-1">
                        Leggi
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Newsletter */}
      <section className="tech-section bg-muted/30">
        <div className="tech-container">
          <div className="tech-card p-8 md:p-12 text-center max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Resta aggiornato
            </h2>
            <p className="text-muted-foreground mb-6">
              Iscriviti alla newsletter per ricevere articoli, guide e consigli direttamente nella tua inbox.
            </p>
            <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="La tua email"
                className="flex-1 h-12 px-4 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
              >
                Iscriviti
              </button>
            </form>
          </div>
        </div>
      </section>
    </Layout>
  );
}
