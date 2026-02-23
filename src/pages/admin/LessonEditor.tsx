import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminNav } from '@/components/admin/AdminNav';
import { useToast } from '@/hooks/use-toast';
import { LogOut, Loader2, ArrowLeft, Save, User } from 'lucide-react';
import { useAutoBackup } from '@/hooks/useAutoBackup';

interface Course {
  id: string;
  title: string;
  emoji: string;
}

interface LessonData {
  title: string;
  description: string;
  content: string;
  content_type: string;
  video_url: string;
  slides_url: string;
  images: string[];
  points_reward: number;
  lesson_number: number;
}

export default function LessonEditor() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const isEditing = Boolean(lessonId);
  
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { createCourseSnapshot } = useAutoBackup();
  
  
  const [formData, setFormData] = useState<LessonData>({
    title: '',
    description: '',
    content: '',
    content_type: 'text',
    video_url: '',
    slides_url: '',
    images: [],
    points_reward: 50,
    lesson_number: 1,
  });

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

    // If editing, fetch lesson
    if (lessonId) {
      const { data: lessonData } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .maybeSingle();

      if (lessonData) {
        setFormData({
          title: lessonData.title || '',
          description: lessonData.description || '',
          content: lessonData.content || '',
          content_type: lessonData.content_type || 'text',
          video_url: lessonData.video_url || '',
          slides_url: lessonData.slides_url || '',
          images: Array.isArray(lessonData.images) ? (lessonData.images as string[]) : [],
          points_reward: lessonData.points_reward || 50,
          lesson_number: lessonData.lesson_number || 1,
        });
      }
    } else {
      // Get next lesson number
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('lesson_number')
        .eq('course_id', courseId)
        .order('lesson_number', { ascending: false })
        .limit(1);

      const nextNumber = lessonsData && lessonsData.length > 0 
        ? lessonsData[0].lesson_number + 1 
        : 1;
      
      setFormData(prev => ({ ...prev, lesson_number: nextNumber }));
    }

    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({ title: 'Errore', description: 'Il titolo è obbligatorio', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    // Auto-backup before editing
    if (isEditing && courseId) {
      await createCourseSnapshot(courseId, `Auto-backup prima di modifica lezione "${formData.title}"`);
    }

    const lessonPayload = {
      course_id: courseId,
      title: formData.title,
      description: formData.description || null,
      content: formData.content || null,
      content_type: formData.content_type,
      video_url: formData.video_url || null,
      slides_url: formData.slides_url || null,
      images: formData.images,
      points_reward: formData.points_reward,
      lesson_number: formData.lesson_number,
    };

    try {
      if (isEditing) {
        const { error } = await supabase
          .from('lessons')
          .update(lessonPayload)
          .eq('id', lessonId);

        if (error) throw error;
        toast({ title: 'Successo', description: 'Lezione aggiornata' });
      } else {
        const { error } = await supabase
          .from('lessons')
          .insert(lessonPayload);

        if (error) throw error;
        toast({ title: 'Successo', description: 'Lezione creata' });
      }

      navigate(`/admin/corsi/${courseId}/lezioni`);
    } catch (error: any) {
      toast({ 
        title: 'Errore', 
        description: error.message || 'Impossibile salvare la lezione', 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
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

      <AdminNav />

      {/* Main Content */}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admin/corsi/${courseId}/lezioni`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Lezioni
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{isEditing ? 'Modifica' : 'Nuova'} Lezione</span>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{isEditing ? 'Modifica Lezione' : 'Nuova Lezione'}</CardTitle>
              <CardDescription>
                {course.emoji} {course.title}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Titolo *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Introduzione a Python"
                  />
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="lesson_number">Numero Lezione</Label>
                    <Input
                      id="lesson_number"
                      type="number"
                      min={1}
                      value={formData.lesson_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, lesson_number: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="points">Punti</Label>
                    <Input
                      id="points"
                      type="number"
                      min={0}
                      value={formData.points_reward}
                      onChange={(e) => setFormData(prev => ({ ...prev, points_reward: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrizione</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Breve descrizione della lezione..."
                  rows={2}
                />
              </div>

              <p className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
                💡 Il contenuto della lezione viene gestito tramite i Task. Dopo aver creato la lezione, potrai aggiungere i Task dalla pagina delle lezioni.
              </p>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" asChild>
              <Link to={`/admin/corsi/${courseId}/lezioni`}>Annulla</Link>
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isEditing ? 'Salva Modifiche' : 'Crea Lezione'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
