import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AdminNav } from '@/components/admin/AdminNav';
import { 
  LogOut,
  Loader2,
  Mail,
  CheckCircle,
  XCircle,
  Trash2,
  Home,
  GraduationCap,
  Briefcase
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ContactSubmission {
  id: string;
  nome: string;
  email: string;
  oggetto: string;
  messaggio: string;
  created_at: string;
  email_sent: boolean;
  error_message: string | null;
}

interface JobApplication {
  id: string;
  nome: string;
  email: string;
  telefono: string | null;
  posizione: string;
  messaggio: string;
  created_at: string;
  read: boolean;
}

export default function AdminContatti() {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<ContactSubmission | null>(null);
  const [jobApplications, setJobApplications] = useState<JobApplication[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobApplication | null>(null);
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
      fetchSubmissions();
      fetchJobApplications();

      // Subscribe to realtime changes for new contact submissions
      const channel = supabase
        .channel('contact-submissions-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'contact_submissions'
          },
          (payload) => {
            const newSubmission = payload.new as ContactSubmission;
            setSubmissions(prev => [newSubmission, ...prev]);
            toast({
              title: "📩 Nuovo messaggio!",
              description: `${newSubmission.nome} ha inviato un messaggio: "${newSubmission.oggetto}"`,
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'contact_submissions'
          },
          (payload) => {
            const deletedSubmission = payload.old as ContactSubmission;
            setSubmissions(prev => prev.filter(s => s.id !== deletedSubmission.id));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'job_applications'
          },
          (payload) => {
            const newApp = payload.new as JobApplication;
            setJobApplications(prev => [newApp, ...prev]);
            toast({
              title: "📋 Nuova candidatura!",
              description: `${newApp.nome} si è candidato per: "${newApp.posizione}"`,
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'job_applications'
          },
          (payload) => {
            const deleted = payload.old as JobApplication;
            setJobApplications(prev => prev.filter(j => j.id !== deleted.id));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, isAdmin]);

  const fetchSubmissions = async () => {
    const { data, error } = await supabase
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Errore', description: 'Impossibile caricare gli invii', variant: 'destructive' });
    } else {
      setSubmissions(data || []);
    }
    setIsLoading(false);
  };

  const fetchJobApplications = async () => {
    const { data, error } = await supabase
      .from('job_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Errore', description: 'Impossibile caricare le candidature', variant: 'destructive' });
    } else {
      setJobApplications(data || []);
    }
  };

  const deleteJobApplication = async (id: string) => {
    const { error } = await supabase.from('job_applications').delete().eq('id', id);
    if (error) {
      toast({ title: 'Errore', description: 'Impossibile eliminare la candidatura', variant: 'destructive' });
    } else {
      setJobApplications(jobApplications.filter(j => j.id !== id));
      toast({ title: 'Successo', description: 'Candidatura eliminata' });
    }
  };

  const deleteSubmission = async (id: string) => {
    const { error } = await supabase.from('contact_submissions').delete().eq('id', id);
    
    if (error) {
      toast({ title: 'Errore', description: 'Impossibile eliminare l\'invio', variant: 'destructive' });
    } else {
      setSubmissions(submissions.filter(s => s.id !== id));
      toast({ title: 'Successo', description: 'Invio eliminato' });
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
            <Button variant="outline" size="sm" asChild>
              <Link to="/insegnante">
                <GraduationCap className="w-4 h-4 mr-2" />
                Insegnante
              </Link>
            </Button>
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
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
            <h1 className="text-3xl font-bold">Invii Form Contatti</h1>
            <p className="text-muted-foreground mt-1">{submissions.length} invii totali</p>
          </div>
        </div>

        {/* Submissions Table */}
        {submissions.length === 0 ? (
          <div className="tech-card p-12 text-center">
            <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nessun invio</h3>
            <p className="text-muted-foreground">Gli invii del form contatti appariranno qui.</p>
          </div>
        ) : (
          <div className="tech-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Oggetto</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow 
                    key={submission.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedSubmission(submission)}
                  >
                    <TableCell className="whitespace-nowrap">
                      {new Date(submission.created_at).toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell className="font-medium">{submission.nome}</TableCell>
                    <TableCell>{submission.email}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{submission.oggetto}</TableCell>
                    <TableCell>
                      {submission.email_sent ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Inviato
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="w-3 h-3" />
                          Errore
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Elimina invio</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sei sicuro di voler eliminare questo invio? Questa azione non può essere annullata.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteSubmission(submission.id)} 
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Elimina
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}


        {/* Job Applications Section */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold flex items-center gap-2">
                <Briefcase className="w-7 h-7" />
                Invii Form Candidature
              </h2>
              <p className="text-muted-foreground mt-1">{jobApplications.length} candidature totali</p>
            </div>
          </div>

          {jobApplications.length === 0 ? (
            <div className="tech-card p-12 text-center">
              <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nessuna candidatura</h3>
              <p className="text-muted-foreground">Le candidature dalla pagina "Lavora con noi" appariranno qui.</p>
            </div>
          ) : (
            <div className="tech-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Posizione</TableHead>
                    <TableHead>Telefono</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobApplications.map((app) => (
                    <TableRow 
                      key={app.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedJob(app)}
                    >
                      <TableCell className="whitespace-nowrap">
                        {new Date(app.created_at).toLocaleDateString('it-IT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell className="font-medium">{app.nome}</TableCell>
                      <TableCell>{app.email}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{app.posizione}</TableCell>
                      <TableCell>{app.telefono || '—'}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Elimina candidatura</AlertDialogTitle>
                              <AlertDialogDescription>
                                Sei sicuro di voler eliminare questa candidatura? Questa azione non può essere annullata.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteJobApplication(app.id)} 
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>

      {/* Detail Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dettagli Messaggio</DialogTitle>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{selectedSubmission.nome}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <a href={`mailto:${selectedSubmission.email}`} className="font-medium text-primary hover:underline">
                    {selectedSubmission.email}
                  </a>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {new Date(selectedSubmission.created_at).toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stato Email</p>
                  {selectedSubmission.email_sent ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Inviato con successo
                    </Badge>
                  ) : (
                    <div>
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="w-3 h-3" />
                        Errore
                      </Badge>
                      {selectedSubmission.error_message && (
                        <p className="text-sm text-destructive mt-1">{selectedSubmission.error_message}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Oggetto</p>
                <p className="font-medium">{selectedSubmission.oggetto}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Messaggio</p>
                <div className="mt-1 p-4 bg-muted rounded-lg whitespace-pre-wrap">
                  {selectedSubmission.messaggio}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Job Application Detail Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dettagli Candidatura</DialogTitle>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{selectedJob.nome}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <a href={`mailto:${selectedJob.email}`} className="font-medium text-primary hover:underline">
                    {selectedJob.email}
                  </a>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {new Date(selectedJob.created_at).toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefono</p>
                  <p className="font-medium">{selectedJob.telefono || 'Non fornito'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Posizione</p>
                <p className="font-medium">{selectedJob.posizione}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Messaggio</p>
                <div className="mt-1 p-4 bg-muted rounded-lg whitespace-pre-wrap">
                  {selectedJob.messaggio}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
