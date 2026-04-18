import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  LogOut,
  FileText,
  Loader2,
  User,
  Calendar,
  Clock,
  ListOrdered,
  Info,
  X
} from 'lucide-react';
import { BugReportButton } from '@/components/BugReportButton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
      <AdminHeader />

      {/* Navigation */}
      <AdminNav />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Gestione Blog</h1>
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

        {/* Info Box: 3 modalità di pubblicazione */}
        <div className="tech-card p-5 mb-6 border-l-4 border-l-primary">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <h3 className="font-semibold text-base">Come funziona la pubblicazione</h3>
              <ul className="space-y-1 text-muted-foreground">
                <li><strong className="text-foreground">1. Pubblica subito</strong> → attiva il toggle "Pubblicato" sull'articolo</li>
                <li><strong className="text-foreground">2. Data programmata</strong> → bozza + scegli data/ora nel campo "Programma" (si pubblica automaticamente)</li>
                <li><strong className="text-foreground">3. Coda automatica</strong> → bozza + attiva "Aggiungi alla coda" (uno al giorno all'orario impostato qui sotto)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Pannello Auto-publish globale */}
        {settings && (
          <div className="tech-card p-5 mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ListOrdered className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Coda Auto-publish</h3>
                  <p className="text-xs text-muted-foreground">Pubblica automaticamente un articolo dalla coda ogni giorno</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="auto-publish"
                    checked={settings.auto_publish_enabled}
                    onCheckedChange={(checked) => updateSettings({ auto_publish_enabled: checked })}
                  />
                  <Label htmlFor="auto-publish" className="text-sm">
                    {settings.auto_publish_enabled ? 'Attivo' : 'Disattivato'}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="publish-hour" className="text-sm whitespace-nowrap">Ora (UTC):</Label>
                  <Input
                    id="publish-hour"
                    type="number"
                    min={0}
                    max={23}
                    value={settings.publish_hour}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(23, parseInt(e.target.value) || 0));
                      setSettings({ ...settings, publish_hour: val });
                    }}
                    onBlur={() => updateSettings({ publish_hour: settings.publish_hour })}
                    className="w-20"
                  />
                </div>
              </div>
            </div>
            {settings.auto_publish_enabled && (() => {
              const queued = posts.filter(p => !p.published && p.auto_publish_queue).sort((a, b) => (a.queue_order ?? 999) - (b.queue_order ?? 999));
              if (queued.length === 0) {
                return <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">Nessun articolo in coda.</p>;
              }
              return (
                <div className="mt-3 pt-3 border-t text-xs">
                  <span className="font-medium">Prossimo: </span>
                  <span className="text-muted-foreground">"{queued[0].title}" — {String(settings.publish_hour).padStart(2, '0')}:00 UTC</span>
                  <span className="ml-2 text-muted-foreground">({queued.length} in coda)</span>
                </div>
              );
            })()}
          </div>
        )}

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
            {posts.map((post) => {
              const isScheduled = !post.published && post.scheduled_publish_at;
              const isInQueue = !post.published && post.auto_publish_queue;
              const scheduledLocal = post.scheduled_publish_at
                ? (() => {
                    const d = new Date(post.scheduled_publish_at);
                    const pad = (n: number) => String(n).padStart(2, '0');
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                  })()
                : '';
              return (
                <div key={post.id} className="tech-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold truncate">{post.title}</h3>
                        {post.published ? (
                          <Badge variant="default">Pubblicato</Badge>
                        ) : isScheduled ? (
                          <Badge variant="secondary" className="gap-1">
                            <Calendar className="w-3 h-3" />
                            Programmato {new Date(post.scheduled_publish_at!).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </Badge>
                        ) : isInQueue ? (
                          <Badge variant="secondary" className="gap-1">
                            <ListOrdered className="w-3 h-3" />
                            In coda{post.queue_order ? ` (#${post.queue_order})` : ''}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Bozza</Badge>
                        )}
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

                  {/* Controlli scheduling (solo bozze) */}
                  {!post.published && (
                    <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <Label htmlFor={`sched-${post.id}`} className="text-xs whitespace-nowrap">Programma:</Label>
                        <Input
                          id={`sched-${post.id}`}
                          type="datetime-local"
                          value={scheduledLocal}
                          onChange={(e) => {
                            const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                            updateSchedule(post.id, val);
                          }}
                          className="w-auto h-8 text-xs"
                        />
                        {post.scheduled_publish_at && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateSchedule(post.id, null)}
                            title="Rimuovi programmazione"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`queue-${post.id}`}
                          checked={post.auto_publish_queue}
                          onCheckedChange={() => toggleQueue(post.id, post.auto_publish_queue)}
                        />
                        <Label htmlFor={`queue-${post.id}`} className="text-xs cursor-pointer">
                          Aggiungi alla coda automatica
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
