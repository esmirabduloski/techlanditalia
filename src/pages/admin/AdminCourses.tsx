import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  LogOut, Loader2, ChevronRight, Plus, Sparkles, Pencil, Trash2, User, BookOpen, GraduationCap, Eye, EyeOff, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { useAutoBackup } from '@/hooks/useAutoBackup';
import { JsonImportExport } from '@/components/admin/JsonImportExport';

interface Course {
  id: string;
  title: string;
  slug: string;
  emoji: string;
  level: string;
  total_lessons: number;
  description: string | null;
  age_range: string | null;
  duration: string | null;
  is_visible: boolean;
}

interface CourseFormData {
  title: string;
  emoji: string;
  level: string;
  description: string;
  age_range: string;
  duration: string;
}

const EMOJI_OPTIONS = [
  '💻', '🐍', '🎮', '🤖', '🚀', '⚡', '🎨', '🔧', '📱', '🌐',
  '🎯', '💡', '🔥', '⭐', '🏆', '📚', '🎓', '🧩', '🔮', '🌈',
  '🎪', '🎭', '🎬', '🎵', '🎹', '🎸', '🥁', '🎺', '🎻', '🪘'
];

const LEVEL_OPTIONS = [
  { value: 'base', label: 'Base' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzato', label: 'Avanzato' },
];

const initialFormState: CourseFormData = {
  title: '',
  emoji: '💻',
  level: 'base',
  description: '',
  age_range: '',
  duration: '',
};

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

interface CourseFormFieldsProps {
  formData: CourseFormData;
  setFormData: React.Dispatch<React.SetStateAction<CourseFormData>>;
}

function CourseFormFields({ formData, setFormData }: CourseFormFieldsProps) {
  return (
    <div className="grid gap-4 py-4">
      {/* Emoji Selection */}
      <div className="space-y-2">
        <Label>Emoji del corso</Label>
        <div className="grid grid-cols-10 gap-2 p-3 border rounded-lg bg-muted/30">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, emoji }))}
              className={`text-2xl p-1 rounded-lg transition-all hover:bg-primary/10 ${
                formData.emoji === emoji 
                  ? 'bg-primary/20 ring-2 ring-primary ring-offset-2' 
                  : ''
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Titolo *</Label>
        <Input
          id="title"
          placeholder="es. Corso Python per Principianti"
          value={formData.title}
          onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
        />
        {formData.title && (
          <p className="text-xs text-muted-foreground">
            Slug: {generateSlug(formData.title)}
          </p>
        )}
      </div>

      {/* Level */}
      <div className="space-y-2">
        <Label htmlFor="level">Livello</Label>
        <Select
          value={formData.level}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, level: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleziona livello" />
          </SelectTrigger>
          <SelectContent>
            {LEVEL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Age Range & Duration */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="age_range">Fascia d'età</Label>
          <Input
            id="age_range"
            placeholder="es. 8-12 anni"
            value={formData.age_range}
            onChange={(e) => setFormData((prev) => ({ ...prev, age_range: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="duration">Durata</Label>
          <Input
            id="duration"
            placeholder="es. 3 mesi"
            value={formData.duration}
            onChange={(e) => setFormData((prev) => ({ ...prev, duration: e.target.value }))}
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Descrizione</Label>
        <Textarea
          id="description"
          placeholder="Descrivi brevemente il corso..."
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
        />
      </div>
    </div>
  );
}

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState<CourseFormData>(initialFormState);
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { createCourseSnapshot } = useAutoBackup();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchCourses();
    }
  }, [user, isAdmin]);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('title');

    if (!error && data) {
      setCourses(data);
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setEditingCourse(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      emoji: course.emoji,
      level: course.level,
      description: course.description || '',
      age_range: course.age_range || '',
      duration: course.duration || '',
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (course: Course) => {
    setEditingCourse(course);
    setIsDeleteDialogOpen(true);
  };

  const handleCreateCourse = async () => {
    if (!formData.title.trim()) {
      toast.error('Inserisci un titolo per il corso');
      return;
    }

    setIsSaving(true);

    const slug = generateSlug(formData.title);

    const { data, error } = await supabase
      .from('courses')
      .insert({
        title: formData.title.trim(),
        slug,
        emoji: formData.emoji,
        level: formData.level,
        description: formData.description.trim() || null,
        age_range: formData.age_range.trim() || null,
        duration: formData.duration.trim() || null,
        total_lessons: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating course:', error);
      if (error.code === '23505') {
        toast.error('Esiste già un corso con questo slug');
      } else {
        toast.error('Errore durante la creazione del corso');
      }
    } else {
      toast.success('Corso creato con successo!');
      setCourses([...courses, data]);
      resetForm();
      setIsCreateDialogOpen(false);
    }

    setIsSaving(false);
  };

  const handleUpdateCourse = async () => {
    if (!editingCourse || !formData.title.trim()) {
      toast.error('Inserisci un titolo per il corso');
      return;
    }

    setIsSaving(true);

    // Auto-backup before editing course
    await createCourseSnapshot(editingCourse.id, `Auto-backup prima di modifica corso "${editingCourse.title}"`);

    const slug = generateSlug(formData.title);

    const { error } = await supabase
      .from('courses')
      .update({
        title: formData.title.trim(),
        slug,
        emoji: formData.emoji,
        level: formData.level,
        description: formData.description.trim() || null,
        age_range: formData.age_range.trim() || null,
        duration: formData.duration.trim() || null,
      })
      .eq('id', editingCourse.id);

    if (error) {
      console.error('Error updating course:', error);
      if (error.code === '23505') {
        toast.error('Esiste già un corso con questo slug');
      } else {
        toast.error('Errore durante la modifica del corso');
      }
    } else {
      toast.success('Corso modificato con successo!');
      setCourses(courses.map(c => 
        c.id === editingCourse.id 
          ? { 
              ...c, 
              title: formData.title.trim(),
              slug,
              emoji: formData.emoji,
              level: formData.level,
              description: formData.description.trim() || null,
              age_range: formData.age_range.trim() || null,
              duration: formData.duration.trim() || null,
            } 
          : c
      ));
      resetForm();
      setIsEditDialogOpen(false);
    }

    setIsSaving(false);
  };

  const handleToggleVisibility = async (course: Course) => {
    const newVisibility = !course.is_visible;
    
    const { error } = await supabase
      .from('courses')
      .update({ is_visible: newVisibility })
      .eq('id', course.id);

    if (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Errore durante la modifica della visibilità');
    } else {
      setCourses(courses.map(c => 
        c.id === course.id ? { ...c, is_visible: newVisibility } : c
      ));
      toast.success(newVisibility ? 'Corso ora visibile' : 'Corso nascosto');
    }
  };

  const handleDeleteCourse = async () => {
    if (!editingCourse) return;

    setIsDeleting(true);

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', editingCourse.id);

    if (error) {
      console.error('Error deleting course:', error);
      toast.error('Errore durante l\'eliminazione del corso. Assicurati che non ci siano lezioni o iscrizioni associate.');
    } else {
      toast.success('Corso eliminato con successo!');
      setCourses(courses.filter(c => c.id !== editingCourse.id));
      setIsDeleteDialogOpen(false);
      resetForm();
    }

    setIsDeleting(false);
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
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Gestione Corsi</h1>
            <p className="text-muted-foreground mt-1">{courses.length} corsi totali</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <JsonImportExport
              filePrefix="courses"
              tableName="courses"
              conflictColumn="slug"
              entityLabel="corsi"
              onImported={fetchCourses}
            />
            <Button className="gap-2" onClick={openCreateDialog}>
              <Plus className="w-4 h-4" />
              Crea Corso
            </Button>
          </div>
        </div>

        {/* Create Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Crea Nuovo Corso
              </DialogTitle>
              <DialogDescription>
                Inserisci le informazioni per creare un nuovo corso.
              </DialogDescription>
            </DialogHeader>
            
            <CourseFormFields formData={formData} setFormData={setFormData} />

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isSaving}
              >
                Annulla
              </Button>
              <Button 
                onClick={handleCreateCourse}
                disabled={isSaving || !formData.title.trim()}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creazione...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Crea Corso
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary" />
                Modifica Corso
              </DialogTitle>
              <DialogDescription>
                Modifica le informazioni del corso.
              </DialogDescription>
            </DialogHeader>
            
            <CourseFormFields formData={formData} setFormData={setFormData} />

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button 
                variant="destructive" 
                onClick={() => {
                  setIsEditDialogOpen(false);
                  openDeleteDialog(editingCourse!);
                }}
                disabled={isSaving}
                className="sm:mr-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Elimina
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isSaving}
              >
                Annulla
              </Button>
              <Button 
                onClick={handleUpdateCourse}
                disabled={isSaving || !formData.title.trim()}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  'Salva Modifiche'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-destructive" />
                Elimina Corso
              </AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler eliminare il corso "{editingCourse?.title}"? 
                Questa azione non può essere annullata e rimuoverà tutte le lezioni associate.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteCourse}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Eliminazione...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Elimina Corso
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Courses Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id} className={`hover:shadow-md transition-shadow group ${!course.is_visible ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{course.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg truncate">{course.title}</CardTitle>
                      {!course.is_visible && (
                        <Badge variant="secondary" className="text-xs">
                          <EyeOff className="w-3 h-3 mr-1" />
                          Nascosto
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="truncate">{course.slug}</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => openEditDialog(course)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="outline">{course.level}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {course.total_lessons} lezioni
                  </span>
                </div>
                {course.age_range && (
                  <p className="text-sm text-muted-foreground mb-2">
                    Età: {course.age_range}
                  </p>
                )}
                
                {/* Visibility Toggle */}
                <div className="flex items-center justify-between py-2 mb-2 border-t border-b border-border/50">
                  <div className="flex items-center gap-2 text-sm">
                    {course.is_visible ? (
                      <Eye className="w-4 h-4 text-tech-green" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className={course.is_visible ? 'text-tech-green' : 'text-muted-foreground'}>
                      {course.is_visible ? 'Visibile' : 'Nascosto'}
                    </span>
                  </div>
                  <Switch
                    checked={course.is_visible}
                    onCheckedChange={() => handleToggleVisibility(course)}
                  />
                </div>

                <div className="space-y-2">
                  <Button asChild variant="default" className="w-full">
                    <Link to={`/admin/corsi/${course.id}/lezioni`}>
                      <BookOpen className="w-4 h-4 mr-2" />
                      Gestisci Lezioni
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link to={`/admin/corsi/${course.id}/contenuto`}>
                      <FileText className="w-4 h-4 mr-2" />
                      Modifica contenuto pagina
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {courses.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Nessun corso trovato</h3>
            <p className="text-muted-foreground mb-6">Inizia creando il tuo primo corso!</p>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Crea il tuo primo corso
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
