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
import { AdminNav } from '@/components/admin/AdminNav';
import { useToast } from '@/hooks/use-toast';
import { LogOut, Loader2, ArrowLeft, Save, User } from 'lucide-react';
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
  scratch_url: string;
  points_reward: number;
  task_number: number;
  default_python_code: string;
  default_html_code: string;
  default_css_code: string;
  default_js_code: string;
  python_env: string;
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
    scratch_url: '',
    points_reward: 10,
    task_number: 1,
    default_python_code: '',
    default_html_code: '',
    default_css_code: '',
    default_js_code: '',
    python_env: 'standard',
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
          scratch_url: (taskData as any).scratch_url || '',
          points_reward: taskData.points_reward || 10,
          task_number: taskData.task_number || 1,
          default_python_code: (taskData as any).default_python_code || '',
          default_html_code: (taskData as any).default_html_code || '',
          default_css_code: (taskData as any).default_css_code || '',
          default_js_code: (taskData as any).default_js_code || '',
          python_env: (taskData as any).python_env || 'standard',
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

    const taskPayload: any = {
      lesson_id: lessonId,
      title: formData.title,
      description: formData.description || null,
      content: formData.content || null,
      content_type: formData.content_type,
      slides_url: formData.slides_url || null,
      scratch_url: formData.scratch_url || null,
      points_reward: formData.points_reward,
      task_number: formData.task_number,
      default_python_code: formData.default_python_code || null,
      default_html_code: formData.default_html_code || null,
      default_css_code: formData.default_css_code || null,
      default_js_code: formData.default_js_code || null,
      python_env: formData.python_env || 'standard',
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
                    <SelectItem value="mixed">Misto (Compilatore)</SelectItem>
                    <SelectItem value="scratch">Scratch (Gioco)</SelectItem>
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

              {/* Scratch URL - solo per tipo Scratch */}
              {formData.content_type === 'scratch' && (
                <div className="space-y-2 border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">🐱 Gioco Scratch</h3>
                  <Label htmlFor="scratch_url">URL Progetto Scratch</Label>
                  <Input
                    id="scratch_url"
                    value={formData.scratch_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, scratch_url: e.target.value }))}
                    placeholder="https://scratch.mit.edu/projects/1266169747/embed"
                  />
                  <p className="text-xs text-muted-foreground">
                    Incolla l'URL di embed del progetto Scratch. Puoi ottenerlo dalla pagina del progetto cliccando su "Incorpora" e copiando l'URL dal tag iframe (es: https://scratch.mit.edu/projects/NUMERO/embed).
                  </p>
                  
                  {formData.scratch_url && (
                    <div className="mt-4 border rounded-lg p-4 bg-muted/30">
                      <p className="text-sm font-medium mb-2">Anteprima:</p>
                      <div className="aspect-[485/402] max-w-md">
                        <iframe
                          src={(() => {
                            const url = formData.scratch_url;
                            if (url.includes('/embed')) return url;
                            const match = url.match(/scratch\.mit\.edu\/projects\/(\d+)/);
                            if (match) return `https://scratch.mit.edu/projects/${match[1]}/embed`;
                            return url;
                          })()}
                          className="w-full h-full rounded-lg border"
                          allowFullScreen
                          allowTransparency
                          title="Scratch Preview"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Codice predefinito per compilatori - solo per tipo Misto */}
              {formData.content_type === 'mixed' && (
                <div className="space-y-6 border-t pt-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">🖥️ Codice Predefinito Compilatori</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Inserisci il codice che verrà caricato automaticamente nel compilatore quando lo studente apre questa task.
                    </p>
                  </div>

                  {/* Python Environment Selection */}
                  <div className="space-y-2">
                    <Label>🐍 Ambiente Python</Label>
                    <Select
                      value={formData.python_env}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, python_env: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard (Pyodide) - Calcoli, algoritmi</SelectItem>
                        <SelectItem value="turtle">🐢 Turtle - Grafica tartaruga</SelectItem>
                        <SelectItem value="pgzero">🎮 Pygame Zero - Giochi</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Scegli l'ambiente Python in base al tipo di codice che lo studente dovrà scrivere.
                    </p>
                  </div>

                  {/* Python Code */}
                  <div className="space-y-2">
                    <Label htmlFor="default_python_code">🐍 Codice Python Predefinito</Label>
                    <Textarea
                      id="default_python_code"
                      value={formData.default_python_code}
                      onChange={(e) => setFormData(prev => ({ ...prev, default_python_code: e.target.value }))}
                      placeholder={
                        formData.python_env === 'turtle' 
                          ? "import turtle\nt = turtle.Turtle()\nt.forward(100)..."
                          : formData.python_env === 'pgzero'
                          ? "# Pygame Zero\nWIDTH = 400\nHEIGHT = 300\n\ndef draw():\n    screen.fill('blue')..."
                          : "# Scrivi il codice Python iniziale..."
                      }
                      rows={8}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.python_env === 'turtle' && "💡 Turtle: usa 'import turtle' per disegnare grafica con la tartaruga."}
                      {formData.python_env === 'pgzero' && "💡 Pygame Zero: definisci draw() e update() per creare giochi interattivi."}
                      {formData.python_env === 'standard' && "💡 Standard: per calcoli, algoritmi, input/output testuale."}
                    </p>
                  </div>

                  {/* Web Code */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="default_html_code">📄 HTML Predefinito</Label>
                      <Textarea
                        id="default_html_code"
                        value={formData.default_html_code}
                        onChange={(e) => setFormData(prev => ({ ...prev, default_html_code: e.target.value }))}
                        placeholder="<h1>Titolo</h1>..."
                        rows={8}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="default_css_code">🎨 CSS Predefinito</Label>
                      <Textarea
                        id="default_css_code"
                        value={formData.default_css_code}
                        onChange={(e) => setFormData(prev => ({ ...prev, default_css_code: e.target.value }))}
                        placeholder="body { ... }"
                        rows={8}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="default_js_code">⚡ JavaScript Predefinito</Label>
                      <Textarea
                        id="default_js_code"
                        value={formData.default_js_code}
                        onChange={(e) => setFormData(prev => ({ ...prev, default_js_code: e.target.value }))}
                        placeholder="console.log('Hello!');"
                        rows={8}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
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