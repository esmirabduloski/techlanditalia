import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AdminNav } from '@/components/admin/AdminNav';
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
  LogOut, Loader2, Plus, Edit, Trash2, ArrowLeft, BookOpen, ClipboardList 
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
  emoji: string;
  total_lessons: number;
}

interface Lesson {
  id: string;
  lesson_number: number;
  title: string;
  description: string | null;
  content_type: string | null;
  points_reward: number;
  created_at: string;
}

export default function AdminLessons() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
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
    if (user && isAdmin && courseId) {
      fetchData();
    }
  }, [user, isAdmin, courseId]);

  const fetchData = async () => {
    // Fetch course
    const { data: courseData } = await supabase
      .from('courses')
      .select('id, title, emoji, total_lessons')
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
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/corsi">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Corsi
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{course.emoji} {course.title}</span>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Lezioni</h1>
            <p className="text-muted-foreground mt-1">{lessons.length} lezioni</p>
          </div>
          <Button asChild>
            <Link to={`/admin/corsi/${courseId}/lezioni/nuova`}>
              <Plus className="w-4 h-4 mr-2" />
              Nuova Lezione
            </Link>
          </Button>
        </div>

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
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{lesson.points_reward} punti</span>
                      <span>•</span>
                      <span>{new Date(lesson.created_at).toLocaleDateString('it-IT')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" asChild title="Task">
                    <Link to={`/admin/corsi/${courseId}/lezioni/${lesson.id}/task`}>
                      <ClipboardList className="w-4 h-4" />
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
                          Sei sicuro di voler eliminare la lezione "{lesson.title}"? Questa azione non può essere annullata.
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
