import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { EditViewTabs } from '@/components/lesson/ViewModeSwitch';
import { SeasonalBadge } from '@/components/homework/SeasonalBadge';
import { seasonalClient } from '@/lib/seasonalHomeworkClient';
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
  LogOut, Loader2, ArrowLeft, Plus, Edit, Trash2, ClipboardList, Paperclip, Calendar, MonitorPlay, Sparkles, Undo2
} from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  lesson_number: number;
}

interface Attachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface Homework {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  points_reward: number;
  attachments: Attachment[];
  due_date: string | null;
  created_at: string;
  /** Compito stagionale (0066): si toglie dalla lezione invece di cancellarlo */
  seasonal_theme_id?: string | null;
}

export default function AdminHomework() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [homework, setHomework] = useState<Homework[]>([]);
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
    if (user && isAdmin && lessonId) {
      fetchData();
    }
  }, [user, isAdmin, lessonId]);

  const fetchData = async () => {
    if (!lessonId) return;
    // Fetch lesson
    const { data: lessonData } = await supabase
      .from('lessons')
      .select('id, title, lesson_number')
      .eq('id', lessonId)
      .maybeSingle();

    if (lessonData) {
      setLesson(lessonData);
    }

    // Fetch homework
    const { data: homeworkData } = await supabase
      .from('homework')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('created_at');

    if (homeworkData) {
      const parsedHomework: Homework[] = homeworkData.map(h => ({
        ...h,
        attachments: Array.isArray(h.attachments) ? (h.attachments as unknown as Attachment[]) : []
      }));
      setHomework(parsedHomework);
    }

    setIsLoading(false);
  };

  const deleteHomework = async (id: string) => {
    const { error } = await supabase.from('homework').delete().eq('id', id);
    
    if (error) {
      toast({ title: 'Errore', description: 'Impossibile eliminare il compito', variant: 'destructive' });
    } else {
      setHomework(homework.filter(h => h.id !== id));
      toast({ title: 'Successo', description: 'Compito eliminato' });
    }
  };

  // Il compito stagionale torna in archivio, pronto per la prossima volta: testo e consegne restano
  const removeFromLesson = async (hw: Homework) => {
    const { error } = await seasonalClient.from('homework').update({ lesson_id: null }).eq('id', hw.id);

    if (error) {
      toast({ title: 'Errore', description: 'Impossibile togliere il compito dalla lezione', variant: 'destructive' });
    } else {
      setHomework(homework.filter(h => h.id !== hw.id));
      toast({ title: 'Compito tolto dalla lezione', description: 'È tornato nei compiti stagionali' });
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

  if (!isAdmin || !lesson) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <AdminHeader />

      {/* Navigation */}
      <AdminNav />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admin/corsi/${courseId}/lezioni`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Lezioni
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">Lezione {lesson.lesson_number}: {lesson.title}</span>
          <EditViewTabs
            mode="edit"
            className="ml-auto"
            viewDisabledReason={homework.length === 0 ? 'Nessun compito da visualizzare' : undefined}
            onView={() => navigate(`/admin/corsi/${courseId}/anteprima/compito/${homework[0].id}`)}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Compiti</h1>
            <p className="text-muted-foreground mt-1">{homework.length} compiti</p>
          </div>
          <Button asChild>
            <Link to={`/admin/corsi/${courseId}/lezioni/${lessonId}/compiti/nuovo`}>
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Compito
            </Link>
          </Button>
        </div>

        {/* Homework List */}
        {homework.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nessun compito</h3>
              <p className="text-muted-foreground mb-6">Crea il primo compito per questa lezione</p>
              <Button asChild>
                <Link to={`/admin/corsi/${courseId}/lezioni/${lessonId}/compiti/nuovo`}>
                  <Plus className="w-4 h-4 mr-2" />
                  Crea Compito
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {homework.map((hw) => (
              <Card key={hw.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-semibold truncate">{hw.title}</h3>
                        <SeasonalBadge themeId={hw.seasonal_theme_id} className="hidden sm:inline-flex" />
                      </div>
                      {hw.description && (
                        <p className="text-sm text-muted-foreground truncate">{hw.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>{hw.points_reward} punti</span>
                        <span>•</span>
                        <span>{new Date(hw.created_at).toLocaleDateString('it-IT')}</span>
                        {hw.due_date && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Scadenza: {new Date(hw.due_date).toLocaleDateString('it-IT')}
                            </span>
                          </>
                        )}
                        {hw.attachments && hw.attachments.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                              {hw.attachments.length} allegati
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" asChild title="Visualizza come gli studenti">
                        <Link to={`/admin/corsi/${courseId}/anteprima/compito/${hw.id}`}>
                          <MonitorPlay className="w-4 h-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/admin/corsi/${courseId}/lezioni/${lessonId}/compiti/${hw.id}/modifica`}>
                          <Edit className="w-4 h-4" />
                        </Link>
                      </Button>
                      {hw.seasonal_theme_id ? (
                        <>
                          <Button variant="ghost" size="icon" asChild title="Gestisci nei compiti stagionali">
                            <Link to={`/admin/compiti-stagionali?tema=${hw.seasonal_theme_id}`} aria-label="Gestisci nei compiti stagionali">
                              <Sparkles className="w-4 h-4" />
                            </Link>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Togli dalla lezione" aria-label={`Togli "${hw.title}" dalla lezione`}>
                                <Undo2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Togli dalla lezione</AlertDialogTitle>
                                <AlertDialogDescription>
                                  "{hw.title}" è un compito stagionale: non viene cancellato ma torna in archivio nei Compiti stagionali,
                                  pronto per la prossima volta. Gli alunni non lo vedono più; le consegne già fatte restano da correggere.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeFromLesson(hw)}>Togli</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Elimina compito</AlertDialogTitle>
                              <AlertDialogDescription>
                                Sei sicuro di voler eliminare "{hw.title}"? Questa azione non può essere annullata.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteHomework(hw.id)} 
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
