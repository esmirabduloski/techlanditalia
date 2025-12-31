import { useEffect, useState, useMemo } from 'react';
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/seo/SEOHead";
import { SEOBreadcrumb } from "@/components/seo/SEOBreadcrumb";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowRight, Clock, Loader2, Mail, CheckCircle, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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

const categoryConfig: Record<string, { color: string; icon: string; description: string }> = {
  Educazione: { 
    color: "bg-tech-green/10 text-tech-green border-tech-green/20", 
    icon: "📚",
    description: "Approfondimenti sull'educazione digitale e tecnologica"
  },
  Guida: { 
    color: "bg-tech-teal/10 text-tech-teal border-tech-teal/20", 
    icon: "🗺️",
    description: "Guide pratiche per iniziare con la programmazione"
  },
  Genitori: { 
    color: "bg-tech-cyan/10 text-tech-cyan border-tech-cyan/20", 
    icon: "👨‍👩‍👧‍👦",
    description: "Consigli per genitori sul mondo tech"
  },
  Gaming: { 
    color: "bg-tech-blue/10 text-tech-blue border-tech-blue/20", 
    icon: "🎮",
    description: "Gaming educativo e sviluppo videogiochi"
  },
  Futuro: { 
    color: "bg-tech-emerald/10 text-tech-emerald border-tech-emerald/20", 
    icon: "🚀",
    description: "Tendenze e futuro della tecnologia"
  },
  Sicurezza: { 
    color: "bg-tech-mint/10 text-tech-mint border-tech-mint/20", 
    icon: "🔒",
    description: "Sicurezza online per bambini e famiglie"
  },
  Tutorial: { 
    color: "bg-primary/10 text-primary border-primary/20", 
    icon: "💻",
    description: "Tutorial pratici di programmazione"
  },
  Novità: { 
    color: "bg-secondary/10 text-secondary border-secondary/20", 
    icon: "✨",
    description: "Le ultime novità da TECHLAND"
  },
  Generale: { 
    color: "bg-muted text-muted-foreground border-muted", 
    icon: "📝",
    description: "Articoli vari sul mondo della tecnologia"
  },
};

const POSTS_PER_PAGE = 9;
const defaultImage = "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=600&q=80";

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

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

  // Get unique categories from posts
  const categories = useMemo(() => {
    const cats = [...new Set(posts.map(post => post.category))];
    return cats.sort();
  }, [posts]);

  // Filter posts based on search and category
  const filteredPosts = useMemo(() => {
    let result = posts;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(post => 
        post.title.toLowerCase().includes(query) ||
        (post.excerpt?.toLowerCase().includes(query)) ||
        post.category.toLowerCase().includes(query)
      );
    }

    if (selectedCategory) {
      result = result.filter(post => post.category === selectedCategory);
    }

    return result;
  }, [posts, searchQuery, selectedCategory]);

  // Group posts by category for section view
  const postsByCategory = useMemo(() => {
    const grouped: Record<string, BlogPost[]> = {};
    filteredPosts.forEach(post => {
      if (!grouped[post.category]) {
        grouped[post.category] = [];
      }
      grouped[post.category].push(post);
    });
    return grouped;
  }, [filteredPosts]);

  // Paginated posts (when not in category view)
  const paginatedPosts = useMemo(() => {
    if (selectedCategory || searchQuery) {
      const start = (currentPage - 1) * POSTS_PER_PAGE;
      const end = start + POSTS_PER_PAGE;
      return filteredPosts.slice(start, end);
    }
    return filteredPosts;
  }, [filteredPosts, currentPage, selectedCategory, searchQuery]);

  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error("Inserisci un'email valida");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error("Formato email non valido");
      return;
    }

    setIsSubscribing(true);

    try {
      const { data, error } = await supabase.functions.invoke('newsletter-subscribe', {
        body: { email: email.trim() }
      });

      if (error) throw error;

      if (data.success) {
        setSubscribed(true);
        toast.success(data.message);
        setEmail('');
      } else if (data.message) {
        toast.info(data.message);
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch (error: any) {
      console.error('Newsletter subscribe error:', error);
      toast.error("Errore durante l'iscrizione. Riprova più tardi.");
    } finally {
      setIsSubscribing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setCurrentPage(1);
  };

  const isFiltering = searchQuery || selectedCategory;

  // Schema.org per Blog
  const blogSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Blog TECHLAND - Coding per Bambini",
    "description": "Articoli, guide e consigli sulla programmazione per bambini e ragazzi. Scopri perché il coding è importante per il futuro dei tuoi figli.",
    "url": "https://techlanditalia.it/blog",
    "publisher": {
      "@type": "Organization",
      "name": "TECHLAND",
      "logo": {
        "@type": "ImageObject",
        "url": "https://techlanditalia.it/favicon.ico"
      }
    },
    "inLanguage": "it-IT"
  };

  const BlogCard = ({ post, featured = false }: { post: BlogPost; featured?: boolean }) => {
    const config = categoryConfig[post.category] || categoryConfig.Generale;
    
    if (featured) {
      return (
        <Link to={`/blog/${post.slug}`} className="block">
          <div className="tech-card tech-card-hover overflow-hidden grid lg:grid-cols-2">
            <div className="aspect-video lg:aspect-auto">
              <img 
                src={post.featured_image || defaultImage} 
                alt={post.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="p-8 lg:p-12 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <Badge className={`${config.color} border`}>
                  <span className="mr-1">{config.icon}</span>
                  {post.category}
                </Badge>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {post.read_time || '5 min'}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">{post.title}</h2>
              <p className="text-muted-foreground mb-6">{post.excerpt || 'Scopri di più...'}</p>
              <span className="text-primary font-medium flex items-center gap-2">
                Leggi l'articolo
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        </Link>
      );
    }

    return (
      <Link 
        to={`/blog/${post.slug}`} 
        className="tech-card tech-card-hover overflow-hidden group flex flex-col"
      >
        <div className="aspect-video overflow-hidden">
          <img 
            src={post.featured_image || defaultImage} 
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </div>
        <div className="p-6 flex flex-col flex-1">
          <div className="flex items-center gap-3 mb-3">
            <Badge className={`${config.color} border text-xs`}>
              <span className="mr-1">{config.icon}</span>
              {post.category}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDate(post.created_at)}
            </span>
          </div>
          <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {post.title}
          </h3>
          <p className="text-muted-foreground text-sm mb-4 line-clamp-2 flex-1">
            {post.excerpt || 'Scopri di più...'}
          </p>
          <div className="flex items-center justify-between text-sm mt-auto">
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
    );
  };

  const CategorySection = ({ category, posts: categoryPosts }: { category: string; posts: BlogPost[] }) => {
    const config = categoryConfig[category] || categoryConfig.Generale;
    const displayPosts = categoryPosts.slice(0, 4);
    const hasMore = categoryPosts.length > 4;

    return (
      <section className="mb-16">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.icon}</span>
            <div>
              <h2 className="text-2xl font-bold">{category}</h2>
              <p className="text-sm text-muted-foreground">{config.description}</p>
            </div>
          </div>
          {hasMore && (
            <button
              onClick={() => setSelectedCategory(category)}
              className="text-primary font-medium flex items-center gap-1 hover:gap-2 transition-all"
            >
              Vedi tutti ({categoryPosts.length})
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayPosts.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      </section>
    );
  };

  return (
    <Layout>
      <SEOHead
        title="Blog Coding per Bambini: Guide e Consigli | TECHLAND"
        description="Scopri articoli, guide e risorse sulla programmazione per bambini e ragazzi. Consigli per genitori su corsi di coding, robotica e tecnologia educativa."
        canonical="https://techlanditalia.it/blog"
        keywords="blog programmazione bambini, guide coding ragazzi, consigli genitori tecnologia, articoli educazione digitale, risorse coding bambini"
        ogImage={posts[0]?.featured_image || defaultImage}
        schemaData={blogSchema}
      />
      
      {/* Hero */}
      <section className="tech-section bg-gradient-to-b from-tech-green-light to-background">
        <div className="tech-container">
          <SEOBreadcrumb 
            items={[{ label: "Blog Coding Bambini" }]} 
            className="mb-8 justify-center"
          />
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Blog Programmazione per Bambini: Guide e Risorse
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Articoli, guide e consigli per genitori che vogliono accompagnare i figli nel mondo della tecnologia e del coding.
            </p>

            {/* Search Bar */}
            <div className="max-w-xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cerca articoli..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-12 h-14 rounded-2xl text-lg border-2 focus:border-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Category Filters */}
      {!isLoading && posts.length > 0 && (
        <section className="py-6 border-b">
          <div className="tech-container">
            <div className="flex flex-wrap items-center gap-3 justify-center">
              <button
                onClick={clearFilters}
                className={`px-4 py-2 rounded-full font-medium transition-all ${
                  !selectedCategory 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                Tutti ({posts.length})
              </button>
              {categories.map((category) => {
                const config = categoryConfig[category] || categoryConfig.Generale;
                const count = posts.filter(p => p.category === category).length;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                    className={`px-4 py-2 rounded-full font-medium transition-all flex items-center gap-2 ${
                      selectedCategory === category 
                        ? 'bg-primary text-primary-foreground' 
                        : `${config.color} border hover:opacity-80`
                    }`}
                  >
                    <span>{config.icon}</span>
                    {category} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Active Filters */}
      {isFiltering && !isLoading && (
        <section className="py-4 bg-muted/30">
          <div className="tech-container">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredPosts.length} risultat{filteredPosts.length === 1 ? 'o' : 'i'} trovati
                {searchQuery && <span> per "{searchQuery}"</span>}
                {selectedCategory && <span> in {selectedCategory}</span>}
              </p>
              <button
                onClick={clearFilters}
                className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Cancella filtri
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Loading State */}
      {isLoading && (
        <section className="tech-section">
          <div className="tech-container flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </section>
      )}

      {/* Empty State */}
      {!isLoading && filteredPosts.length === 0 && (
        <section className="tech-section">
          <div className="tech-container">
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-2xl font-bold mb-4">Nessun articolo trovato</h2>
              <p className="text-muted-foreground mb-6">
                {isFiltering 
                  ? "Prova a modificare i filtri di ricerca" 
                  : "Torna presto per scoprire nuovi contenuti!"
                }
              </p>
              {isFiltering && (
                <button
                  onClick={clearFilters}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
                >
                  Mostra tutti gli articoli
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Featured Article (only when no filters) */}
      {!isLoading && posts.length > 0 && !isFiltering && (
        <section className="tech-section pt-8">
          <div className="tech-container">
            <div className="mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-3xl">⭐</span>
                In Evidenza
              </h2>
            </div>
            <BlogCard post={posts[0]} featured />
          </div>
        </section>
      )}

      {/* Category Sections (when no filters) */}
      {!isLoading && posts.length > 0 && !isFiltering && (
        <section className="tech-section">
          <div className="tech-container">
            {Object.entries(postsByCategory)
              .filter(([_, categoryPosts]) => categoryPosts.length > 0)
              .sort((a, b) => b[1].length - a[1].length)
              .slice(0, 6) // Show top 6 categories
              .map(([category, categoryPosts]) => (
                <CategorySection key={category} category={category} posts={categoryPosts} />
              ))}
          </div>
        </section>
      )}

      {/* Filtered/Paginated Grid */}
      {!isLoading && filteredPosts.length > 0 && isFiltering && (
        <section className="tech-section">
          <div className="tech-container">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedPosts.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        if (totalPages <= 5) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (Math.abs(page - currentPage) <= 1) return true;
                        return false;
                      })
                      .map((page, index, array) => (
                        <>
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <PaginationItem key={`ellipsis-${page}`}>
                              <span className="px-3 py-2">...</span>
                            </PaginationItem>
                          )}
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        </>
                      ))}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Newsletter */}
      <section className="tech-section bg-muted/30">
        <div className="tech-container">
          <div className="tech-card p-8 md:p-12 text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              {subscribed ? (
                <CheckCircle className="w-8 h-8 text-primary" />
              ) : (
                <Mail className="w-8 h-8 text-primary" />
              )}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              {subscribed ? "Grazie per l'iscrizione!" : "Resta aggiornato"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {subscribed 
                ? "Controlla la tua email per confermare l'iscrizione e iniziare a ricevere i nostri aggiornamenti."
                : "Iscriviti alla newsletter per ricevere articoli, guide e consigli direttamente nella tua inbox."
              }
            </p>
            {!subscribed && (
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="La tua email"
                  disabled={isSubscribing}
                  className="flex-1 h-12 px-4 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isSubscribing}
                  className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubscribing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Invio...
                    </>
                  ) : (
                    "Iscriviti"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
