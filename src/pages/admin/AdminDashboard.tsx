import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AdminNav } from '@/components/admin/AdminNav';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  LogOut,
  FileText,
  Loader2,
  User
} from 'lucide-react';
import { BugReportButton } from '@/components/BugReportButton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: string;
  published: boolean;
  created_at: string;
  scheduled_publish_at: string | null;
  auto_publish_queue: boolean;
  queue_order: number | null;
}

interface BlogSettings {
  id: string;
  auto_publish_enabled: boolean;
  publish_hour: number;
}

export default function AdminDashboard() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [settings, setSettings] = useState<BlogSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchPosts();
      fetchSettings();
    }
  }, [user, isAdmin]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('blog_settings').select('*').limit(1).maybeSingle();
    if (data) setSettings(data as BlogSettings);
  };

  const updateSettings = async (updates: Partial<BlogSettings>) => {
    if (!settings) return;
    const { error } = await supabase.from('blog_settings').update(updates).eq('id', settings.id);
    if (!error) {
      setSettings({ ...settings, ...updates });
      toast({ title: 'Impostazioni aggiornate' });
    }
  };

  const updateSchedule = async (id: string, scheduled_publish_at: string | null) => {
    const { error } = await supabase.from('blog_posts').update({ scheduled_publish_at }).eq('id', id);
    if (!error) {
      setPosts(posts.map(p => p.id === id ? { ...p, scheduled_publish_at } : p));
      toast({ title: scheduled_publish_at ? 'Pubblicazione programmata' : 'Programmazione rimossa' });
    }
  };

  const toggleQueue = async (id: string, current: boolean) => {
    const { error } = await supabase.from('blog_posts').update({ auto_publish_queue: !current }).eq('id', id);
    if (!error) {
      setPosts(posts.map(p => p.id === id ? { ...p, auto_publish_queue: !current } : p));
    }
  };

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, title, slug, category, published, created_at, scheduled_publish_at, auto_publish_queue, queue_order')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Errore', description: 'Impossibile caricare i post', variant: 'destructive' });
    } else {
      setPosts(data || []);
    }
    setIsLoading(false);
  };

  const togglePublished = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('blog_posts')
      .update({ published: !currentStatus })
      .eq('id', id);

    if (error) {
      toast({ title: 'Errore', description: 'Impossibile aggiornare lo stato', variant: 'destructive' });
    } else {
      setPosts(posts.map(p => p.id === id ? { ...p, published: !currentStatus } : p));
      toast({ title: 'Successo', description: `Articolo ${!currentStatus ? 'pubblicato' : 'nascosto'}` });
    }
  };

  const deletePost = async (id: string) => {
    const { error } = await supabase.from('blog_posts').delete().eq('id', id);
    
    if (error) {
      toast({ title: 'Errore', description: 'Impossibile eliminare l\'articolo', variant: 'destructive' });
    } else {
      setPosts(posts.filter(p => p.id !== id));
      toast({ title: 'Successo', description: 'Articolo eliminato' });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
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
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-2xl font-bold">
              <span className="text-primary">TECH</span>
              <span className="text-tech-teal">LAND</span>
            </Link>
            <Badge variant="secondary">Admin</Badge>
          </div>
          <div className="flex items-center gap-4">
            <BugReportButton />
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/insegnante">
                <User className="w-4 h-4 mr-2" />
                Insegnante
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <AdminNav />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Gestione Blog</h1>
            <p className="text-muted-foreground mt-1">{posts.length} articoli totali</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">UTC oggi: {new Date().toISOString().slice(0, 10)}</Badge>
              <Badge variant="outline">Locale: {new Date().toLocaleString('it-IT')}</Badge>
            </div>
          </div>
          <Button asChild>
            <Link to="/admin/blog/nuovo">
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Articolo
            </Link>
          </Button>
        </div>

        {/* Posts List */}
        {posts.length === 0 ? (
          <div className="tech-card p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nessun articolo</h3>
            <p className="text-muted-foreground mb-6">Inizia creando il tuo primo post</p>
            <Button asChild>
              <Link to="/admin/blog/nuovo">
                <Plus className="w-4 h-4 mr-2" />
                Crea Articolo
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="tech-card p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{post.title}</h3>
                    <Badge variant={post.published ? 'default' : 'secondary'}>
                      {post.published ? 'Pubblicato' : 'Bozza'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{post.category}</span>
                    <span>•</span>
                    <span>{new Date(post.created_at).toLocaleDateString('it-IT')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => togglePublished(post.id, post.published)}
                    title={post.published ? 'Nascondi' : 'Pubblica'}
                  >
                    {post.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <Link to={`/admin/blog/${post.id}/modifica`}>
                      <Edit className="w-4 h-4" />
                    </Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Elimina articolo</AlertDialogTitle>
                        <AlertDialogDescription>
                          Sei sicuro di voler eliminare "{post.title}"? Questa azione non può essere annullata.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deletePost(post.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Elimina
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
