import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AdminNav } from '@/components/admin/AdminNav';
import {
  Loader2, Download, RotateCcw, Trash2, Plus, Database, BookOpen, FileText, ClipboardList,
  ChevronDown
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Snapshot {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_label: string;
  snapshot_label: string | null;
  snapshot_data: any;
  created_at: string;
}

interface Course {
  id: string;
  title: string;
}

const entityTypeLabels: Record<string, string> = {
  course: 'Corso',
  lesson: 'Lezione',
  lesson_task: 'Task',
  homework: 'Compito',
};

const entityTypeIcons: Record<string, React.ElementType> = {
  course: BookOpen,
  lesson: FileText,
  lesson_task: ClipboardList,
  homework: Database,
};

export default function AdminBackups() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate('/admin/login');
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchSnapshots();
      fetchCourses();
    }
  }, [user, isAdmin]);

  const fetchSnapshots = async () => {
    const { data, error } = await supabase
      .from('content_snapshots')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setSnapshots(data || []);
    setIsLoading(false);
  };

  const fetchCourses = async () => {
    const { data } = await supabase.from('courses').select('id, title').order('title');
    setCourses(data || []);
  };

  const createCourseSnapshot = async () => {
    if (!selectedCourse) return;
    setIsCreating(true);

    try {
      const course = courses.find(c => c.id === selectedCourse);
      if (!course) throw new Error('Corso non trovato');

      // Fetch course + lessons + tasks + homework
      const [lessonsRes, tasksRes, homeworkRes, courseRes] = await Promise.all([
        supabase.from('lessons').select('*').eq('course_id', selectedCourse).order('lesson_number'),
        supabase.from('lesson_tasks').select('*, lessons!inner(course_id)').eq('lessons.course_id', selectedCourse),
        supabase.from('homework').select('*, lessons!inner(course_id)').eq('lessons.course_id', selectedCourse),
        supabase.from('courses').select('*').eq('id', selectedCourse).single(),
      ]);

      const snapshotData = {
        course: courseRes.data,
        lessons: lessonsRes.data || [],
        tasks: tasksRes.data || [],
        homework: homeworkRes.data || [],
      };

      const { error } = await supabase.from('content_snapshots').insert({
        entity_type: 'course',
        entity_id: selectedCourse,
        entity_label: course.title,
        snapshot_label: snapshotLabel || `Backup ${new Date().toLocaleString('it-IT')}`,
        snapshot_data: snapshotData,
        created_by: user?.id,
      });

      if (error) throw error;

      toast({ title: 'Snapshot creato', description: `Backup di "${course.title}" salvato con successo` });
      setCreateDialogOpen(false);
      setSnapshotLabel('');
      setSelectedCourse('');
      fetchSnapshots();
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const restoreSnapshot = async (snapshot: Snapshot) => {
    try {
      const data = snapshot.snapshot_data;

      if (snapshot.entity_type === 'course' && data.course) {
        // Restore course
        const { id, created_at, ...courseData } = data.course;
        await supabase.from('courses').upsert({ id, ...courseData });

        // Restore lessons
        if (data.lessons?.length) {
          for (const lesson of data.lessons) {
            const { created_at: _, ...lessonData } = lesson;
            await supabase.from('lessons').upsert({ ...lessonData });
          }
        }

        // Restore tasks
        if (data.tasks?.length) {
          for (const task of data.tasks) {
            const { created_at: _, lessons, ...taskData } = task;
            await supabase.from('lesson_tasks').upsert({ ...taskData });
          }
        }

        // Restore homework
        if (data.homework?.length) {
          for (const hw of data.homework) {
            const { created_at: _, lessons, ...hwData } = hw;
            await supabase.from('homework').upsert({ ...hwData });
          }
        }
      }

      toast({ title: 'Ripristino completato', description: `"${snapshot.entity_label}" ripristinato alla versione del ${new Date(snapshot.created_at).toLocaleString('it-IT')}` });
    } catch (err: any) {
      toast({ title: 'Errore ripristino', description: err.message, variant: 'destructive' });
    }
  };

  const deleteSnapshot = async (id: string) => {
    const { error } = await supabase.from('content_snapshots').delete().eq('id', id);
    if (error) {
      toast({ title: 'Errore', description: 'Impossibile eliminare lo snapshot', variant: 'destructive' });
    } else {
      setSnapshots(s => s.filter(snap => snap.id !== id));
      toast({ title: 'Eliminato', description: 'Snapshot eliminato' });
    }
  };

  const downloadSnapshot = (snapshot: Snapshot) => {
    const blob = new Blob([JSON.stringify(snapshot.snapshot_data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${snapshot.entity_type}-${snapshot.entity_label.replace(/\s+/g, '-')}-${new Date(snapshot.created_at).toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = filterType === 'all' ? snapshots : snapshots.filter(s => s.entity_type === filterType);

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
      <header className="bg-background border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-2xl font-bold">
              <span className="text-primary">TECH</span>
              <span className="text-tech-teal">LAND</span>
            </Link>
            <Badge variant="secondary">Admin</Badge>
          </div>
        </div>
      </header>

      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Backup & Ripristino</h1>
            <p className="text-muted-foreground mt-1">{snapshots.length} snapshot salvati</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filtra tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="course">Corsi</SelectItem>
                <SelectItem value="lesson">Lezioni</SelectItem>
                <SelectItem value="lesson_task">Task</SelectItem>
                <SelectItem value="homework">Compiti</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Backup
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="tech-card p-12 text-center">
            <Database className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nessun backup</h3>
            <p className="text-muted-foreground mb-6">Crea il tuo primo snapshot per proteggere i contenuti</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Crea Backup
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((snap) => {
              const Icon = entityTypeIcons[snap.entity_type] || Database;
              const itemCount = snap.entity_type === 'course'
                ? `${snap.snapshot_data?.lessons?.length || 0} lezioni, ${snap.snapshot_data?.tasks?.length || 0} task, ${snap.snapshot_data?.homework?.length || 0} compiti`
                : '';
              return (
                <div key={snap.id} className="tech-card p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="font-semibold truncate">{snap.entity_label}</h3>
                        <Badge variant="outline" className="text-xs">{entityTypeLabels[snap.entity_type]}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        <span>{snap.snapshot_label || 'Senza etichetta'}</span>
                        <span>•</span>
                        <span>{new Date(snap.created_at).toLocaleString('it-IT')}</span>
                        {itemCount && (
                          <>
                            <span>•</span>
                            <span>{itemCount}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => downloadSnapshot(snap)} title="Scarica JSON">
                      <Download className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="Ripristina">
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Ripristina backup</AlertDialogTitle>
                          <AlertDialogDescription>
                            Vuoi ripristinare "{snap.entity_label}" alla versione del {new Date(snap.created_at).toLocaleString('it-IT')}? I dati attuali verranno sovrascritti.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={() => restoreSnapshot(snap)}>Ripristina</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Elimina">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Elimina snapshot</AlertDialogTitle>
                          <AlertDialogDescription>
                            Sei sicuro? Questa azione non può essere annullata.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteSnapshot(snap.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Backup Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crea Backup Corso</DialogTitle>
            <DialogDescription>
              Salva uno snapshot completo del corso con tutte le lezioni, task e compiti.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Corso</label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un corso" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Etichetta (opzionale)</label>
              <Input
                value={snapshotLabel}
                onChange={e => setSnapshotLabel(e.target.value)}
                placeholder="Es: Prima delle modifiche al modulo 3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Annulla</Button>
            <Button onClick={createCourseSnapshot} disabled={!selectedCourse || isCreating}>
              {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crea Backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
