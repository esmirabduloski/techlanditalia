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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { LogOut, Loader2, ArrowLeft, Save } from 'lucide-react';
import RichTextEditor from '@/components/editor/RichTextEditor';

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

interface TaskData {
  title: string;
  description: string;
  content: string;
  content_type: string;
  slides_url: string;
  points_reward: number;
  task_number: number;
}

export default function TaskEditor() {
  const { courseId, lessonId, taskId } = useParams<{ courseId: string; lessonId: string; taskId: string }>();
  const isEditing = Boolean(taskId);
  
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState<TaskData>({
    title: '',
    description: '',
    content: '',
    content_type: 'text',
    slides_url: '',
    points_reward: 10,
    task_number: 1,
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
    if (user && isAdmin && courseId && lessonId) {
      fetchData();
    }
  }, [user, isAdmin, courseId, lessonId, taskId]);

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

    // If editing, fetch task
    if (taskId) {
      const { data: taskData } = await supabase
        .from('lesson_tasks')
        .select('*')
        .eq('id', taskId)
        .maybeSingle();

      if (taskData) {
        setFormData({
          title: taskData.title || '',
          description: taskData.description || '',
          content: taskData.content || '',
          content_type: taskData.content_type || 'text',
          slides_url: taskData.slides_url || '',
          points_reward: taskData.points_reward || 10,
          task_number: taskData.task_number || 1,
        });
      }
    } else {
      // Get next task number
      const { data: tasksData } = await supabase
        .from('lesson_tasks')
        .select('task_number')
        .eq('lesson_id', lessonId)
        .order('task_number', { ascending: false })
        .limit(1);

      const nextNumber = tasksData && tasksData.length > 0 
        ? tasksData[0].task_number + 1 
        : 1;
      
      setFormData(prev => ({ ...prev, task_number: nextNumber }));
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

    const taskPayload = {
      lesson_id: lessonId,
      title: formData.title,
      description: formData.description || null,
      content: formData.content || null,
      content_type: formData.content_type,
      slides_url: formData.slides_url || null,
      points_reward: formData.points_reward,
      task_number: formData.task_number,
    };

    try {
      if (isEditing) {
        const { error } = await supabase
          .from('lesson_tasks')
          .update(taskPayload)
          .eq('id', taskId);

        if (error) throw error;
        toast({ title: 'Successo', description: 'Task aggiornato' });
      } else {
        const { error } = await supabase
          .from('lesson_tasks')
          .insert(taskPayload);

        if (error) throw error;
        toast({ title: 'Successo', description: 'Task creato' });
      }

      navigate(`/admin/corsi/${courseId}/lezioni/${lessonId}/task`);
    } catch (error: any) {
      toast({ 
        title: 'Errore', 
        description: error.message || 'Impossibile salvare il task', 
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

  if (!isAdmin || !course || !lesson) return null;

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
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admin/corsi/${courseId}/lezioni/${lessonId}/task`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Task
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{isEditing ? 'Modifica' : 'Nuovo'} Task</span>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{isEditing ? 'Modifica Task' : 'Nuovo Task'}</CardTitle>
              <CardDescription>
                {course.emoji} {course.title} - L{lesson.lesson_number}: {lesson.title}
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
                    placeholder="Introduzione al topic"
                  />
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="task_number">Numero Task</Label>
                    <Input
                      id="task_number"
                      type="number"
                      min={1}
                      value={formData.task_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, task_number: parseInt(e.target.value) || 1 }))}
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
                  placeholder="Breve descrizione del task..."
                  rows={2}
                />
              </div>

              {/* Content Type */}
              <div className="space-y-2">
                <Label>Tipo Contenuto</Label>
                <Select
                  value={formData.content_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, content_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Testo</SelectItem>
                    <SelectItem value="slides">Presentazione</SelectItem>
                    <SelectItem value="mixed">Misto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Content - WYSIWYG Editor */}
              <div className="space-y-2">
                <Label>Contenuto</Label>
                <RichTextEditor
                  content={formData.content}
                  onChange={(html) => setFormData(prev => ({ ...prev, content: html }))}
                />
                <p className="text-xs text-muted-foreground">
                  Usa la toolbar per formattare il testo, inserire immagini e video YouTube.
                </p>
              </div>

              {/* Slides URL - solo per tipo Presentazione */}
              {formData.content_type === 'slides' && (
                <div className="space-y-2">
                  <Label htmlFor="slides_url">URL Google Slides</Label>
                  <Input
                    id="slides_url"
                    value={formData.slides_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, slides_url: e.target.value }))}
                    placeholder="https://docs.google.com/presentation/d/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Incolla il link della presentazione Google Slides per incorporarla nel task.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" asChild>
              <Link to={`/admin/corsi/${courseId}/lezioni/${lessonId}/task`}>Annulla</Link>
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isEditing ? 'Salva Modifiche' : 'Crea Task'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}