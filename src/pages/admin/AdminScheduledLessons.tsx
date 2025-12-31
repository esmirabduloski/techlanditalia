import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Loader2, Plus, Pencil, Trash2, LogOut, User, FileText, GraduationCap,
  BookOpen, Mail, BarChart3, Eye, Calendar as CalendarIcon, ClipboardCheck, Award
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
  emoji: string;
}

interface ScheduledLesson {
  id: string;
  course_id: string;
  lesson_date: string;
  title: string;
  description: string | null;
  created_at: string;
  course: Course;
}

export default function AdminScheduledLessons() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const [scheduledLessons, setScheduledLessons] = useState<ScheduledLesson[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<ScheduledLesson | null>(null);
  const [filterCourse, setFilterCourse] = useState<string>('all');

  // Form state
  const [formCourseId, setFormCourseId] = useState('');
  const [formDate, setFormDate] = useState<Date>();
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/admin/login');
    } else if (!authLoading && user && !isAdmin) {
      navigate('/area-riservata');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [lessonsRes, coursesRes] = await Promise.all([
      supabase
        .from('scheduled_lessons')
        .select('*, course:courses(id, title, emoji)')
        .order('lesson_date', { ascending: false }),
      supabase.from('courses').select('id, title, emoji')
    ]);

    if (lessonsRes.data) {
      setScheduledLessons(lessonsRes.data.map(l => ({
        ...l,
        course: l.course as unknown as Course
      })));
    }
    if (coursesRes.data) {
      setCourses(coursesRes.data);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormCourseId('');
    setFormDate(undefined);
    setFormTitle('');
    setFormDescription('');
    setEditingLesson(null);
  };

  const openEditDialog = (lesson: ScheduledLesson) => {
    setEditingLesson(lesson);
    setFormCourseId(lesson.course_id);
    setFormDate(new Date(lesson.lesson_date));
    setFormTitle(lesson.title);
    setFormDescription(lesson.description || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formCourseId || !formDate || !formTitle) {
      toast.error('Compila tutti i campi obbligatori');
      return;
    }

    setSaving(true);
    const lessonData = {
      course_id: formCourseId,
      lesson_date: format(formDate, 'yyyy-MM-dd'),
      title: formTitle,
      description: formDescription || null,
      created_by: user?.id
    };

    if (editingLesson) {
      const { error } = await supabase
        .from('scheduled_lessons')
        .update(lessonData)
        .eq('id', editingLesson.id);

      if (error) {
        toast.error('Errore durante l\'aggiornamento');
      } else {
        toast.success('Lezione aggiornata');
        setDialogOpen(false);
        resetForm();
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from('scheduled_lessons')
        .insert(lessonData);

      if (error) {
        toast.error('Errore durante la creazione');
      } else {
        toast.success('Lezione programmata creata');
        setDialogOpen(false);
        resetForm();
        fetchData();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa lezione programmata?')) return;

    const { error } = await supabase.from('scheduled_lessons').delete().eq('id', id);
    if (error) {
      toast.error('Errore durante l\'eliminazione');
    } else {
      toast.success('Lezione eliminata');
      fetchData();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const filteredLessons = filterCourse === 'all'
    ? scheduledLessons
    : scheduledLessons.filter(l => l.course_id === filterCourse);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/area-riservata">
                <User className="w-4 h-4 mr-2" />
                Area Riservata
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
      <div className="border-b bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-4 overflow-x-auto">
            <Link to="/admin" className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap">
              <FileText className="w-4 h-4" />
              Blog
            </Link>
            <Link to="/admin/corsi" className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap">
              <GraduationCap className="w-4 h-4" />
              Corsi
            </Link>
            <Link to="/admin/prenotazioni" className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap">
              <BookOpen className="w-4 h-4" />
              Prenotazioni
            </Link>
            <Link to="/admin/contatti" className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap">
              <Mail className="w-4 h-4" />
              Contatti
            </Link>
            <Link to="/admin/newsletter" className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap">
              <Mail className="w-4 h-4" />
              Newsletter
            </Link>
            <Link to="/admin/utenti" className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap">
              <User className="w-4 h-4" />
              Utenti
            </Link>
            <Link to="/admin/valutazioni" className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap">
              <Award className="w-4 h-4" />
              Valutazioni
            </Link>
            <Link to="/admin/lezioni-programmate" className="py-3 px-2 border-b-2 border-primary text-primary font-medium flex items-center gap-2 whitespace-nowrap">
              <CalendarIcon className="w-4 h-4" />
              Calendario
            </Link>
            <Link to="/admin/presenze" className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap">
              <ClipboardCheck className="w-4 h-4" />
              Presenze
            </Link>
            <Link to="/admin/statistiche" className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap">
              <BarChart3 className="w-4 h-4" />
              Statistiche
            </Link>
            <Link to="/admin/simulatore" className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap">
              <Eye className="w-4 h-4" />
              Simulatore
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lezioni Programmate</h1>
            <p className="text-muted-foreground">Gestisci le lezioni con date programmate per il registro presenze</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuova Lezione
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingLesson ? 'Modifica Lezione' : 'Nuova Lezione Programmata'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Corso *</Label>
                  <Select value={formCourseId} onValueChange={setFormCourseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un corso" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.emoji} {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formDate ? format(formDate, 'PPP', { locale: it }) : 'Seleziona una data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formDate}
                        onSelect={setFormDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Titolo *</Label>
                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Es. Lezione 1 - Introduzione"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrizione</Label>
                  <Textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Descrizione opzionale..."
                  />
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingLesson ? 'Aggiorna' : 'Crea'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="mb-4">
          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Filtra per corso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i corsi</SelectItem>
              {courses.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.emoji} {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lessons list */}
        <div className="grid gap-4">
          {filteredLessons.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nessuna lezione programmata trovata
              </CardContent>
            </Card>
          ) : (
            filteredLessons.map((lesson) => (
              <Card key={lesson.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">{lesson.course.emoji}</div>
                      <div>
                        <h3 className="font-semibold text-foreground">{lesson.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {lesson.course.title} • {format(new Date(lesson.lesson_date), 'EEEE d MMMM yyyy', { locale: it })}
                        </p>
                        {lesson.description && (
                          <p className="text-sm text-muted-foreground mt-1">{lesson.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(lesson)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(lesson.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
