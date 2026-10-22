import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { EditViewTabs } from '@/components/lesson/ViewModeSwitch';
import { conceptById, conceptCoverage, normalizeConcepts } from '@/lib/skillMap';
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
  LogOut, Loader2, Plus, Edit, Trash2, ArrowLeft, BookOpen, ClipboardList, FileText, MonitorPlay
} from 'lucide-react';
import { TRASH_RECOVERY_HINT } from '@/lib/trash';
import { CsvImportDialog, CsvMenu } from '@/components/admin/CsvImportDialog';
import { useAutoBackup } from '@/hooks/useAutoBackup';
import { downloadCsv } from '@/lib/csv';
import { todayStamp } from '@/lib/csvImport';
import { applyLessons, LESSON_COLUMNS, lessonsTemplateCsv, lessonsToCsv, planLessons } from '@/lib/lessonsCsv';

interface Course {
  id: string;
  title: string;
  emoji: string;
  slug: string;
  total_lessons: number;
}

interface Lesson {
  id: string;
  lesson_number: number;
  title: string;
  description: string | null;
  objective: string | null;
  content_type: string | null;
  points_reward: number;
  video_url: string | null;
  slides_url: string | null;
  created_at: string;
  /** Mappa delle competenze (migrazione 0062): assente finché non è applicata. */
  concepts?: string[];
}

export default function AdminLessons() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createCourseSnapshot } = useAutoBackup();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin && courseId) {
      fetchData();
    }
  }, [user, isAdmin, courseId]);

  const fetchData = async () => {
    if (!courseId) return;
    // Fetch course
    const { data: courseData } = await supabase
      .from('courses')
      .select('id, title, emoji, slug, total_lessons')
      .eq('id', courseId)
      .maybeSingle();

    if (courseData) {
      setCourse(courseData);
    }

    // Fetch lessons
    const { data: lessonsData } = await supabase
      .from('lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('lesson_number');

    if (lessonsData) {
      setLessons(lessonsData);
    }

    setIsLoading(false);
  };

  const deleteLesson = async (id: string) => {
    const { error } = await supabase.from('lessons').delete().eq('id', id);
    
    if (error) {
      toast({ title: 'Errore', description: 'Impossibile eliminare la lezione', variant: 'destructive' });
    } else {
      setLessons(lessons.filter(l => l.id !== id));
      toast({ title: 'Successo', description: 'Lezione eliminata' });
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

  if (!isAdmin || !course) return null;

  const coverage = conceptCoverage(lessons);
  const conceptsOf = (lesson: Lesson) => normalizeConcepts(lesson.concepts).map((id) => conceptById(id)!);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <AdminHeader />

      {/* Navigation */}
      <AdminNav />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/corsi">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Corsi
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{course.emoji} {course.title}</span>
          <EditViewTabs
            mode="edit"
            className="ml-auto"
            viewDisabledReason={lessons.length === 0 ? 'Nessuna lezione da visualizzare' : undefined}
            onView={() => navigate(`/admin/corsi/${courseId}/anteprima/lezione/${lessons[0].lesson_number}`)}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Lezioni</h1>
            <p className="text-muted-foreground mt-1">{lessons.length} lezioni</p>
            {coverage && (
              <p className="text-sm text-muted-foreground mt-1" data-testid="course-concept-coverage">
                🧩 Competenze:{' '}
                {coverage.concepts.length > 0
                  ? coverage.concepts.map((c) => `${c.concept.emoji} ${c.concept.label} (${c.lessons})`).join(' · ')
                  : 'nessuna ancora collegata'}
                {coverage.untagged > 0 && ` — ${coverage.untagged} ${coverage.untagged === 1 ? 'lezione senza' : 'lezioni senza'}`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <CsvMenu
              onExport={() => downloadCsv(`lezioni-${course.slug}-${todayStamp()}.csv`, lessonsToCsv(lessons))}
              onImport={() => setImportOpen(true)}
              onTemplate={() => downloadCsv('modello-lezioni.csv', lessonsTemplateCsv())}
            />
            <Button asChild>
              <Link to={`/admin/corsi/${courseId}/lezioni/nuova`}>
                <Plus className="w-4 h-4 mr-2" />
                Nuova Lezione
              </Link>
            </Button>
          </div>
        </div>

        <CsvImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          title={`Importa lezioni in ${course.title}`}
          description="Programma del corso: le lezioni con un numero già presente vengono aggiornate, le altre create. Contenuto, immagini, task e compiti restano come sono. Prima dell'import si salva un backup del corso."
          columns={LESSON_COLUMNS}
          plan={(rows) => planLessons(rows, lessons, { totalLessons: course.total_lessons })}
          apply={async (rows, onProgress) => {
            await createCourseSnapshot(course.id, "Auto-backup prima dell'import CSV");
            return applyLessons(course.id, rows, onProgress);
          }}
          onImported={fetchData}
        />

        {/* Lessons List */}
        {lessons.length === 0 ? (
          <div className="tech-card p-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nessuna lezione</h3>
            <p className="text-muted-foreground mb-6">Inizia creando la prima lezione del corso</p>
            <Button asChild>
              <Link to={`/admin/corsi/${courseId}/lezioni/nuova`}>
                <Plus className="w-4 h-4 mr-2" />
                Crea Lezione
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson) => (
              <div key={lesson.id} className="tech-card p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {lesson.lesson_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{lesson.title}</h3>
                      {lesson.content_type && lesson.content_type !== 'text' && (
                        <Badge variant="outline">{lesson.content_type}</Badge>
                      )}
                      {!lesson.objective?.trim() && (
                        <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400" title="Aggiungi l'obiettivo dall'editor della lezione">
                          Senza obiettivo
                        </Badge>
                      )}
                      {coverage && conceptsOf(lesson).length === 0 && (
                        <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400" title="Collega le competenze dall'editor della lezione">
                          Senza competenze
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{lesson.points_reward} punti</span>
                      <span>•</span>
                      <span>{new Date(lesson.created_at).toLocaleDateString('it-IT')}</span>
                      {conceptsOf(lesson).length > 0 && (
                        <>
                          <span>•</span>
                          <span title={conceptsOf(lesson).map((c) => c.label).join(', ')}>
                            {conceptsOf(lesson).map((c) => c.emoji).join(' ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" asChild title="Visualizza come gli studenti">
                    <Link to={`/admin/corsi/${courseId}/anteprima/lezione/${lesson.lesson_number}`}>
                      <MonitorPlay className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild title="Task">
                    <Link to={`/admin/corsi/${courseId}/lezioni/${lesson.id}/task`}>
                      <ClipboardList className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild title="Compiti">
                    <Link to={`/admin/corsi/${courseId}/lezioni/${lesson.id}/compiti`}>
                      <FileText className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild title="Modifica">
                    <Link to={`/admin/corsi/${courseId}/lezioni/${lesson.id}/modifica`}>
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
                        <AlertDialogTitle>Elimina lezione</AlertDialogTitle>
                        <AlertDialogDescription>
                          Sei sicuro di voler eliminare la lezione "{lesson.title}"? Con lei se ne vanno i suoi task e compiti. {TRASH_RECOVERY_HINT}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => deleteLesson(lesson.id)} 
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
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
