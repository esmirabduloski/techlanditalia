import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { 
  LogOut,
  Loader2,
  Mail,
  User,
  Download,
  Send,
  Trash2,
  CheckCircle,
  Clock,
  Users,
  GraduationCap
} from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Subscriber {
  id: string;
  email: string;
  confirmed: boolean;
  confirmed_at: string | null;
  created_at: string;
}

export default function AdminNewsletter() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [newsletterSubject, setNewsletterSubject] = useState('');
  const [newsletterContent, setNewsletterContent] = useState('');
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
      fetchSubscribers();
    }
  }, [user, isAdmin]);

  const fetchSubscribers = async () => {
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('id, email, confirmed, confirmed_at, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Errore', description: 'Impossibile caricare gli iscritti', variant: 'destructive' });
    } else {
      setSubscribers(data || []);
    }
    setIsLoading(false);
  };

  const deleteSubscriber = async (id: string) => {
    const { error } = await supabase.from('newsletter_subscribers').delete().eq('id', id);
    
    if (error) {
      toast({ title: 'Errore', description: 'Impossibile eliminare l\'iscritto', variant: 'destructive' });
    } else {
      setSubscribers(subscribers.filter(s => s.id !== id));
      toast({ title: 'Successo', description: 'Iscritto eliminato' });
    }
  };

  const exportToCSV = () => {
    const confirmedSubscribers = subscribers.filter(s => s.confirmed);
    const csvContent = [
      ['Email', 'Data Iscrizione', 'Data Conferma'].join(','),
      ...confirmedSubscribers.map(s => [
        s.email,
        new Date(s.created_at).toLocaleDateString('it-IT'),
        s.confirmed_at ? new Date(s.confirmed_at).toLocaleDateString('it-IT') : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `newsletter_subscribers_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast({ title: 'Esportazione completata', description: `${confirmedSubscribers.length} iscritti esportati` });
  };

  const sendNewsletter = async () => {
    if (!newsletterSubject.trim() || !newsletterContent.trim()) {
      toast({ title: 'Errore', description: 'Compila oggetto e contenuto', variant: 'destructive' });
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('newsletter-send', {
        body: { 
          subject: newsletterSubject.trim(),
          content: newsletterContent.trim()
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({ 
          title: 'Newsletter inviata!', 
          description: `Email inviata a ${data.sentCount} iscritti` 
        });
        setSendDialogOpen(false);
        setNewsletterSubject('');
        setNewsletterContent('');
      } else {
        toast({ title: 'Errore', description: data.error || 'Errore durante l\'invio', variant: 'destructive' });
      }
    } catch (error: any) {
      console.error('Send newsletter error:', error);
      toast({ title: 'Errore', description: 'Errore durante l\'invio della newsletter', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const confirmedCount = subscribers.filter(s => s.confirmed).length;
  const pendingCount = subscribers.filter(s => !s.confirmed).length;

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
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Gestione Newsletter</h1>
            <p className="text-muted-foreground mt-1">{subscribers.length} iscritti totali</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCSV} disabled={confirmedCount === 0}>
              <Download className="w-4 h-4 mr-2" />
              Esporta CSV
            </Button>
            <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={confirmedCount === 0}>
                  <Send className="w-4 h-4 mr-2" />
                  Invia Newsletter
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Invia Newsletter</DialogTitle>
                  <DialogDescription>
                    La newsletter verrà inviata a {confirmedCount} iscritti confermati.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Oggetto</Label>
                    <Input
                      id="subject"
                      value={newsletterSubject}
                      onChange={(e) => setNewsletterSubject(e.target.value)}
                      placeholder="Novità da TECHLAND..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">Contenuto</Label>
                    <Textarea
                      id="content"
                      value={newsletterContent}
                      onChange={(e) => setNewsletterContent(e.target.value)}
                      placeholder="Scrivi il contenuto della newsletter..."
                      rows={10}
                    />
                    <p className="text-xs text-muted-foreground">
                      Puoi usare HTML per formattare il contenuto.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button onClick={sendNewsletter} disabled={isSending}>
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Invio in corso...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Invia a {confirmedCount} iscritti
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <div className="tech-card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{subscribers.length}</p>
                <p className="text-sm text-muted-foreground">Totale iscritti</p>
              </div>
            </div>
          </div>
          <div className="tech-card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-tech-green/10 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-tech-green" />
              </div>
              <div>
                <p className="text-2xl font-bold">{confirmedCount}</p>
                <p className="text-sm text-muted-foreground">Confermati</p>
              </div>
            </div>
          </div>
          <div className="tech-card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">In attesa</p>
              </div>
            </div>
          </div>
        </div>

        {/* Subscribers List */}
        {subscribers.length === 0 ? (
          <div className="tech-card p-12 text-center">
            <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nessun iscritto</h3>
            <p className="text-muted-foreground">Gli iscritti alla newsletter appariranno qui</p>
          </div>
        ) : (
          <div className="tech-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium">Email</th>
                    <th className="text-left p-4 font-medium">Stato</th>
                    <th className="text-left p-4 font-medium">Data Iscrizione</th>
                    <th className="text-left p-4 font-medium">Data Conferma</th>
                    <th className="text-right p-4 font-medium">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {subscribers.map((subscriber) => (
                    <tr key={subscriber.id} className="hover:bg-muted/30">
                      <td className="p-4">
                        <span className="font-medium">{subscriber.email}</span>
                      </td>
                      <td className="p-4">
                        <Badge variant={subscriber.confirmed ? 'default' : 'secondary'}>
                          {subscriber.confirmed ? 'Confermato' : 'In attesa'}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(subscriber.created_at).toLocaleDateString('it-IT', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {subscriber.confirmed_at 
                          ? new Date(subscriber.confirmed_at).toLocaleDateString('it-IT', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })
                          : '-'
                        }
                      </td>
                      <td className="p-4 text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Elimina iscritto</AlertDialogTitle>
                              <AlertDialogDescription>
                                Sei sicuro di voler rimuovere "{subscriber.email}" dalla newsletter?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteSubscriber(subscriber.id)} 
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
