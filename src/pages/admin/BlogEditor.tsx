import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { AdminNav } from '@/components/admin/AdminNav';
import { ArrowLeft, Save, Loader2, Link2, BookOpen, GraduationCap, Copy, Check } from 'lucide-react';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const postSchema = z.object({
  title: z.string().min(3, 'Il titolo deve avere almeno 3 caratteri').max(200),
  slug: z.string().min(3, 'Lo slug deve avere almeno 3 caratteri').max(200),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(10, 'Il contenuto deve avere almeno 10 caratteri'),
  category: z.string().min(1, 'Seleziona una categoria'),
  featured_image: z.string().url('URL immagine non valido').optional().or(z.literal('')),
  read_time: z.string().optional(),
});

const categories = ['Educazione', 'Guida', 'Genitori', 'Gaming', 'Futuro', 'Sicurezza', 'Tutorial', 'Novità'];

export default function BlogEditor() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Educazione');
  const [featuredImage, setFeaturedImage] = useState('');
  const [readTime, setReadTime] = useState('5 min');
  const [published, setPublished] = useState(false);
  const [scheduledPublishAt, setScheduledPublishAt] = useState('');
  const [autoPublishQueue, setAutoPublishQueue] = useState(false);
  const [courses, setCourses] = useState<{ title: string; slug: string; emoji: string }[]>([]);
  const [blogPosts, setBlogPosts] = useState<{ title: string; slug: string; category: string }[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [linksOpen, setLinksOpen] = useState(true);
  const contentRef = React.useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchLinksData = async () => {
      const [coursesRes, postsRes] = await Promise.all([
        supabase.from('courses').select('title, slug, emoji').eq('is_visible', true).order('title'),
        supabase.from('blog_posts').select('title, slug, category').eq('published', true).order('created_at', { ascending: false }),
      ]);
      if (coursesRes.data) setCourses(coursesRes.data);
      if (postsRes.data) setBlogPosts(postsRes.data.filter(p => p.slug !== slug));
    };
    if (user && isAdmin) fetchLinksData();
  }, [user, isAdmin]);

  const insertLink = (label: string, url: string) => {
    const markdown = `[${label}](${url})`;
    const textarea = contentRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + markdown + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + markdown.length, start + markdown.length);
      }, 0);
    } else {
      setContent(prev => prev + '\n' + markdown);
    }
  };

  const copyMarkdownLink = (label: string, url: string) => {
    const markdown = `[${label}](${url})`;
    navigator.clipboard.writeText(markdown);
    setCopiedLink(url);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isEditing && user && isAdmin) {
      fetchPost();
    }
  }, [id, user, isAdmin]);

  const fetchPost = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      toast({ title: 'Errore', description: 'Articolo non trovato', variant: 'destructive' });
      navigate('/admin');
    } else {
      setTitle(data.title);
      setSlug(data.slug);
      setExcerpt(data.excerpt || '');
      setContent(data.content);
      setCategory(data.category);
      setFeaturedImage(data.featured_image || '');
      setReadTime(data.read_time || '5 min');
      setPublished(data.published);
      if (data.scheduled_publish_at) {
        const d = new Date(data.scheduled_publish_at);
        const pad = (n: number) => String(n).padStart(2, '0');
        setScheduledPublishAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
      }
      setAutoPublishQueue(data.auto_publish_queue || false);
    }
    setIsLoading(false);
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!isEditing || !slug) {
      setSlug(generateSlug(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = postSchema.safeParse({
      title,
      slug,
      excerpt,
      content,
      category,
      featured_image: featuredImage,
      read_time: readTime,
    });

    if (!validation.success) {
      toast({
        title: 'Errore di validazione',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    const postData = {
      title,
      slug,
      excerpt: excerpt || null,
      content,
      category,
      featured_image: featuredImage || null,
      read_time: readTime,
      published,
      scheduled_publish_at: scheduledPublishAt ? new Date(scheduledPublishAt).toISOString() : null,
      auto_publish_queue: autoPublishQueue,
      author_id: user?.id,
    };

    let error;

    if (isEditing) {
      const result = await supabase.from('blog_posts').update(postData).eq('id', id);
      error = result.error;
    } else {
      const result = await supabase.from('blog_posts').insert(postData);
      error = result.error;
    }

    setIsSaving(false);

    if (error) {
      toast({
        title: 'Errore',
        description: error.message.includes('duplicate') 
          ? 'Esiste già un articolo con questo slug' 
          : 'Impossibile salvare l\'articolo',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Successo',
        description: isEditing ? 'Articolo aggiornato' : 'Articolo creato',
      });
      navigate('/admin');
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/admin">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <h1 className="text-lg font-semibold">
              {isEditing ? 'Modifica Articolo' : 'Nuovo Articolo'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="published"
                checked={published}
                onCheckedChange={setPublished}
              />
              <Label htmlFor="published" className="text-sm">
                {published ? 'Pubblicato' : 'Bozza'}
              </Label>
            </div>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salva
            </Button>
          </div>
        </div>
      </header>

      <AdminNav />

      {/* Editor */}

      {/* Editor */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="tech-card p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Titolo *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Il titolo del tuo articolo"
                className="text-lg"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug URL *</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(generateSlug(e.target.value))}
                placeholder="url-del-tuo-articolo"
                required
              />
              <p className="text-xs text-muted-foreground">
                L'URL sarà: /blog/{slug || 'slug-articolo'}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria *</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  required
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="readTime">Tempo di lettura</Label>
                <Input
                  id="readTime"
                  value={readTime}
                  onChange={(e) => setReadTime(e.target.value)}
                  placeholder="5 min"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="featuredImage">Immagine di copertina (URL)</Label>
              <Input
                id="featuredImage"
                value={featuredImage}
                onChange={(e) => setFeaturedImage(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
              {featuredImage && (
                <div className="mt-2 rounded-lg overflow-hidden border aspect-video max-w-sm">
                  <img src={featuredImage} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">Estratto (opzionale)</Label>
              <Textarea
                id="excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Una breve descrizione dell'articolo..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Contenuto *</Label>

              {/* Internal Links Panel */}
              <Collapsible open={linksOpen} onOpenChange={setLinksOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" type="button" className="mb-2 gap-2">
                    <Link2 className="w-4 h-4" />
                    Link Interni
                    <Badge variant="secondary" className="ml-1">{courses.length + blogPosts.length}</Badge>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border rounded-lg p-4 mb-3 space-y-4 bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      Clicca su un link per inserirlo nel contenuto alla posizione del cursore, oppure usa l'icona copia per copiare il markdown.
                    </p>

                    {/* Courses */}
                    {courses.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                          <GraduationCap className="w-4 h-4 text-primary" />
                          Pagine Corsi
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {courses.map((c) => (
                            <div key={c.slug} className="flex items-center gap-0.5">
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                className="text-xs h-7 gap-1"
                                onClick={() => insertLink(c.title, `/corsi/${c.slug}`)}
                              >
                                {c.emoji} {c.title}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                className="h-7 w-7"
                                onClick={() => copyMarkdownLink(c.title, `/corsi/${c.slug}`)}
                              >
                                {copiedLink === `/corsi/${c.slug}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Blog Posts */}
                    {blogPosts.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                          <BookOpen className="w-4 h-4 text-primary" />
                          Altri Articoli
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {blogPosts.map((p) => (
                            <div key={p.slug} className="flex items-center gap-0.5">
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                className="text-xs h-7 gap-1"
                                onClick={() => insertLink(p.title, `/blog/${p.slug}`)}
                              >
                                📄 {p.title}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                className="h-7 w-7"
                                onClick={() => copyMarkdownLink(p.title, `/blog/${p.slug}`)}
                              >
                                {copiedLink === `/blog/${p.slug}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Textarea
                id="content"
                ref={contentRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Scrivi il contenuto del tuo articolo..."
                rows={20}
                className="font-mono text-sm"
                required
              />
              <p className="text-xs text-muted-foreground">
                Supporta formattazione Markdown — i link interni si aprono nella stessa finestra
              </p>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
