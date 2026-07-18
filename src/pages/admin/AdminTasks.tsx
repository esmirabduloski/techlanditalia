import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminHeader } from '@/components/admin/AdminHeader';
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
  LogOut, Loader2, Plus, Edit, Trash2, ArrowLeft, ListChecks, Eye, EyeOff
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
  emoji: string;
}

interface Lesson {
  id: string;
  title: string;
  lesson_number: number;
}

interface Task {
  id: string;
  task_number: number;
  title: string;
  description: string | null;
  content_type: string | null;
  points_reward: number;
  is_visible: boolean;
  created_at: string;
}

export default function AdminTasks() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
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
    if (user && isAdmin && courseId && lessonId) {
      fetchData();
    }
  }, [user, isAdmin, courseId, lessonId]);

  const fetchData = async () => {
    // Fetch course
    const { data: courseData } = await supabase
      .from('courses')
      .select('id, title, emoji')
      .eq('id', courseId)
      .maybeSingle();

    if (courseData) {
      setCourse(courseData);
    }

    // Fetch lesson
    const { data: lessonData } = await supabase
      .from('lessons')
      .select('id, title, lesson_number')
      .eq('id', lessonId)
      .maybeSingle();

    if (lessonData) {
      setLesson(lessonData);
    }

    // Fetch tasks
    const { data: tasksData } = await supabase
      .from('lesson_tasks')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('task_number');

    if (tasksData) {
      setTasks(tasksData);
    }

    setIsLoading(false);
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('lesson_tasks').delete().eq('id', id);
    
    if (error) {
      toast({ title: 'Errore', description: 'Impossibile eliminare il task', variant: 'destructive' });
    } else {
      setTasks(tasks.filter(t => t.id !== id));
      toast({ title: 'Successo', description: 'Task eliminato' });
    }
  };

  const toggleVisibility = async (task: Task) => {
    const next = !task.is_visible;
    const { error } = await supabase
      .from('lesson_tasks')
      .update({ is_visible: next })
      .eq('id', task.id);
    if (error) {
      toast({ title: 'Errore', description: 'Impossibile aggiornare la visibilità', variant: 'destructive' });
      return;
    }
    setTasks(tasks.map(t => t.id === task.id ? { ...t, is_visible: next } : t));
    toast({ title: next ? 'Task visibile' : 'Task nascosto', description: next ? 'Ora è visibile agli alunni' : 'Non sarà mostrato agli alunni' });
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

  if (!isAdmin || !course || !lesson) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <AdminHeader />

      {/* Navigation */}
      <AdminNav />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/corsi">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Corsi
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admin/corsi/${courseId}/lezioni`}>
              {course.emoji} {course.title}
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">L{lesson.lesson_number}: {lesson.title}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Task della Lezione</h1>
            <p className="text-muted-foreground mt-1">{tasks.length} task</p>
          </div>
          <Button asChild>
            <Link to={`/admin/corsi/${courseId}/lezioni/${lessonId}/task/nuovo`}>
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Task
            </Link>
          </Button>
        </div>

        {/* Tasks List */}
        {tasks.length === 0 ? (
          <div className="tech-card p-12 text-center">
            <ListChecks className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nessun task</h3>
            <p className="text-muted-foreground mb-6">Inizia creando il primo task della lezione</p>
            <Button asChild>
              <Link to={`/admin/corsi/${courseId}/lezioni/${lessonId}/task/nuovo`}>
                <Plus className="w-4 h-4 mr-2" />
                Crea Task
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="tech-card p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {task.task_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{task.title}</h3>
                      {task.content_type && task.content_type !== 'text' && (
                        <Badge variant="outline">{task.content_type}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{task.points_reward} punti</span>
                      <span>•</span>
                      <span>{new Date(task.created_at).toLocaleDateString('it-IT')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link to={`/admin/corsi/${courseId}/lezioni/${lessonId}/task/${task.id}/modifica`}>
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
                        <AlertDialogTitle>Elimina task</AlertDialogTitle>
                        <AlertDialogDescription>
                          Sei sicuro di voler eliminare il task "{task.title}"? Questa azione non può essere annullata.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => deleteTask(task.id)} 
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