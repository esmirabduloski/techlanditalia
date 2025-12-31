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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  LogOut, Loader2, BookOpen, FileText, Mail, User, BarChart3, 
  GraduationCap, ChevronRight, Plus, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

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

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [newCourse, setNewCourse] = useState({
    title: '',
    emoji: '💻',
    level: 'base',
    description: '',
    age_range: '',
    duration: '',
  });

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

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleCreateCourse = async () => {
    if (!newCourse.title.trim()) {
      toast.error('Inserisci un titolo per il corso');
      return;
    }

    setIsCreating(true);

    const slug = generateSlug(newCourse.title);

    const { data, error } = await supabase
      .from('courses')
      .insert({
        title: newCourse.title.trim(),
        slug,
        emoji: newCourse.emoji,
        level: newCourse.level,
        description: newCourse.description.trim() || null,
        age_range: newCourse.age_range.trim() || null,
        duration: newCourse.duration.trim() || null,
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
      setNewCourse({
        title: '',
        emoji: '💻',
        level: 'base',
        description: '',
        age_range: '',
        duration: '',
      });
      setIsDialogOpen(false);
    }

    setIsCreating(false);
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
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/area-riservata">
                <User className="w-4 h-4 mr-2" />
                Dashboard
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
            <Link 
              to="/admin" 
              className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
            >
              <FileText className="w-4 h-4" />
              Blog
            </Link>
            <Link 
              to="/admin/corsi" 
              className="py-3 px-2 border-b-2 border-primary text-primary font-medium flex items-center gap-2 whitespace-nowrap"
            >
              <GraduationCap className="w-4 h-4" />
              Corsi
            </Link>
            <Link 
              to="/admin/prenotazioni" 
              className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4" />
              Prenotazioni
            </Link>
            <Link 
              to="/admin/contatti" 
              className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
            >
              <Mail className="w-4 h-4" />
              Contatti
            </Link>
            <Link 
              to="/admin/utenti" 
              className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
            >
              <User className="w-4 h-4" />
              Utenti
            </Link>
            <Link 
              to="/admin/statistiche" 
              className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
            >
              <BarChart3 className="w-4 h-4" />
              Statistiche
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestione Corsi</h1>
            <p className="text-muted-foreground mt-1">{courses.length} corsi totali</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Crea Corso
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Crea Nuovo Corso
                </DialogTitle>
                <DialogDescription>
                  Inserisci le informazioni per creare un nuovo corso.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                {/* Emoji Selection */}
                <div className="space-y-2">
                  <Label>Emoji del corso</Label>
                  <div className="grid grid-cols-10 gap-2 p-3 border rounded-lg bg-muted/30">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewCourse({ ...newCourse, emoji })}
                        className={`text-2xl p-1 rounded-lg transition-all hover:bg-primary/10 ${
                          newCourse.emoji === emoji 
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
                    value={newCourse.title}
                    onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  />
                  {newCourse.title && (
                    <p className="text-xs text-muted-foreground">
                      Slug: {generateSlug(newCourse.title)}
                    </p>
                  )}
                </div>

                {/* Level */}
                <div className="space-y-2">
                  <Label htmlFor="level">Livello</Label>
                  <Select
                    value={newCourse.level}
                    onValueChange={(value) => setNewCourse({ ...newCourse, level: value })}
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
                      value={newCourse.age_range}
                      onChange={(e) => setNewCourse({ ...newCourse, age_range: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Durata</Label>
                    <Input
                      id="duration"
                      placeholder="es. 3 mesi"
                      value={newCourse.duration}
                      onChange={(e) => setNewCourse({ ...newCourse, duration: e.target.value })}
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
                    value={newCourse.description}
                    onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isCreating}
                >
                  Annulla
                </Button>
                <Button 
                  onClick={handleCreateCourse}
                  disabled={isCreating || !newCourse.title.trim()}
                >
                  {isCreating ? (
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
        </div>

        {/* Courses Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{course.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{course.title}</CardTitle>
                    <CardDescription className="truncate">{course.slug}</CardDescription>
                  </div>
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
                <div className="space-y-2">
                  <Button asChild variant="default" className="w-full">
                    <Link to={`/admin/corsi/${course.id}/lezioni`}>
                      <BookOpen className="w-4 h-4 mr-2" />
                      Gestisci Lezioni
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
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Crea il tuo primo corso
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
