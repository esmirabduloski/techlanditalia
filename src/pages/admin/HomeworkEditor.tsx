import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminNav } from '@/components/admin/AdminNav';
import { useToast } from '@/hooks/use-toast';
import { LogOut, Loader2, ArrowLeft, Save, User, Upload, X, FileText, Calendar } from 'lucide-react';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRef } from 'react';

interface Course {
  id: string;
  title: string;
  emoji: string;
  slug: string;
}

interface Lesson {
  id: string;
  title: string;
  lesson_number: number;
}

interface Attachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface HomeworkFormData {
  title: string;
  description: string;
  instructions: string;
  points_reward: number;
  due_date: string;
  attachments: Attachment[];
  default_python_code: string;
  default_html_code: string;
  default_css_code: string;
  default_js_code: string;
  python_env: string;
  replit_url: string;
}

const PYTHON_COURSES = ['python-base', 'python-ai'];
const WEB_COURSES = ['web-development'];

export default function HomeworkEditor() {
  const { courseId, lessonId, homeworkId } = useParams<{ courseId: string; lessonId: string; homeworkId: string }>();
  const isEditing = Boolean(homeworkId);
  
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<HomeworkFormData>({
    title: '',
    description: '',
    instructions: '',
    points_reward: 25,
    due_date: '',
    attachments: [],
    default_python_code: '',
    default_html_code: '',
    default_css_code: '',
    default_js_code: '',
    python_env: 'standard',
    replit_url: '',
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
  }, [user, isAdmin, courseId, lessonId, homeworkId]);

  const fetchData = async () => {
    // Fetch course
    const { data: courseData } = await supabase
      .from('courses')
      .select('id, title, emoji, slug')
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

    // If editing, fetch homework
    if (homeworkId) {
      const { data: homeworkData } = await supabase
        .from('homework')
        .select('*')
        .eq('id', homeworkId)
        .maybeSingle();

      if (homeworkData) {
        setFormData({
          title: homeworkData.title || '',
          description: homeworkData.description || '',
          instructions: homeworkData.instructions || '',
          points_reward: homeworkData.points_reward || 25,
          due_date: homeworkData.due_date ? homeworkData.due_date.split('T')[0] : '',
          attachments: Array.isArray(homeworkData.attachments) 
            ? (homeworkData.attachments as unknown as Attachment[]) 
            : [],
          default_python_code: (homeworkData as any).default_python_code || '',
          default_html_code: (homeworkData as any).default_html_code || '',
          default_css_code: (homeworkData as any).default_css_code || '',
          default_js_code: (homeworkData as any).default_js_code || '',
          python_env: (homeworkData as any).python_env || 'standard',
          replit_url: (homeworkData as any).replit_url || '',
        });
      }
    }

    setIsLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newAttachments: Attachment[] = [];

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${lessonId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('homework-attachments')
          .upload(fileName, file);

        if (error) {
          console.error('Upload error:', error);
          toast({ title: 'Errore', description: `Errore upload: ${file.name}`, variant: 'destructive' });
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('homework-attachments')
          .getPublicUrl(data.path);

        newAttachments.push({
          name: file.name,
          url: urlData.publicUrl,
          size: file.size,
          type: file.type || 'application/octet-stream',
        });
      }

      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments],
      }));

      toast({ title: 'Successo', description: `${newAttachments.length} file caricati` });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Errore', description: 'Errore durante il caricamento', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({ title: 'Errore', description: 'Il titolo è obbligatorio', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    const payload: any = {
      lesson_id: lessonId,
      title: formData.title,
      description: formData.description || null,
      instructions: formData.instructions || null,
      points_reward: formData.points_reward,
      attachments: formData.attachments as unknown as Json,
      due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
      default_python_code: formData.default_python_code || null,
      default_html_code: formData.default_html_code || null,
      default_css_code: formData.default_css_code || null,
      default_js_code: formData.default_js_code || null,
      python_env: isPythonCourse ? formData.python_env : null,
      replit_url: isPythonCourse && formData.python_env === 'pgzero' ? (formData.replit_url || null) : null,
    };

    try {
      if (isEditing) {
        const { error } = await supabase
          .from('homework')
          .update(payload)
          .eq('id', homeworkId);

        if (error) throw error;
        toast({ title: 'Successo', description: 'Compito aggiornato' });
      } else {
        const { error } = await supabase
          .from('homework')
          .insert(payload);

        if (error) throw error;
        toast({ title: 'Successo', description: 'Compito creato' });
      }

      navigate(`/admin/corsi/${courseId}/lezioni/${lessonId}/compiti`);
    } catch (error: any) {
      toast({ 
        title: 'Errore', 
        description: error.message || 'Impossibile salvare il compito', 
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

  // Check if this is a course with compiler
  const isPythonCourse = course ? PYTHON_COURSES.includes(course.slug) : false;
  const isWebCourse = course ? WEB_COURSES.includes(course.slug) : false;
  const hasCompiler = isPythonCourse || isWebCourse;

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
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admin/corsi/${courseId}/lezioni/${lessonId}/compiti`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Compiti
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{isEditing ? 'Modifica' : 'Nuovo'} Compito</span>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{isEditing ? 'Modifica Compito' : 'Nuovo Compito'}</CardTitle>
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
                    placeholder="Esercizio 1"
                  />
                </div>
                <div className="grid gap-4 grid-cols-2">
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
                  <div className="space-y-2">
                    <Label htmlFor="due_date" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Scadenza
                    </Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
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
                  placeholder="Breve descrizione del compito..."
                  rows={2}
                />
              </div>

              {/* Instructions - WYSIWYG Editor */}
              <div className="space-y-2">
                <Label>Istruzioni</Label>
                <RichTextEditor
                  content={formData.instructions}
                  onChange={(html) => setFormData(prev => ({ ...prev, instructions: html }))}
                />
                <p className="text-xs text-muted-foreground">
                  Usa la toolbar per formattare il testo, inserire immagini e video.
                </p>
              </div>

              {/* Attachments Section */}
              <div className="space-y-2">
                <Label>Allegati</Label>
                <div className="border rounded-lg p-3 space-y-3">
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      id="attachment-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {isUploading ? 'Caricamento...' : 'Carica File'}
                    </Button>
                  </div>

                  {formData.attachments.length > 0 && (
                    <div className="space-y-2">
                      {formData.attachments.map((att, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-md"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{att.name}</p>
                              <p className="text-xs text-muted-foreground">{formatFileSize(att.size)}</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeAttachment(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Codice predefinito per compilatori */}
              {hasCompiler && (
                <div className="space-y-6 border-t pt-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">🖥️ Codice Predefinito Compilatori</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Inserisci il codice che verrà caricato automaticamente nel compilatore quando lo studente apre questo compito.
                    </p>
                  </div>

                  {isPythonCourse && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="python_env">🐍 Ambiente Python</Label>
                        <Select
                          value={formData.python_env}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, python_env: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona ambiente" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard (Python base)</SelectItem>
                            <SelectItem value="turtle">🐢 Turtle (Grafica)</SelectItem>
                            <SelectItem value="pgzero">🎮 Pygame Zero (Giochi)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {formData.python_env === 'turtle' && 'Usa Trinket per eseguire codice con import turtle'}
                          {formData.python_env === 'pgzero' && 'Lo studente copierà il codice e lo incollerà in Replit'}
                          {formData.python_env === 'standard' && 'Compilatore Python standard per codice base'}
                        </p>
                      </div>

                      {/* Replit URL - solo per Pygame Zero */}
                      {formData.python_env === 'pgzero' && (
                        <div className="space-y-2">
                          <Label htmlFor="replit_url">🔗 Link Replit (per bottone "Apri Replit")</Label>
                          <Input
                            id="replit_url"
                            value={formData.replit_url}
                            onChange={(e) => setFormData(prev => ({ ...prev, replit_url: e.target.value }))}
                            placeholder="https://replit.com/@username/progetto"
                          />
                          <p className="text-xs text-muted-foreground">
                            Inserisci il link del progetto Replit che verrà aperto quando lo studente clicca "Apri Replit".
                            Se lasciato vuoto, verrà usato il progetto predefinito.
                          </p>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="default_python_code">🐍 Codice Python Predefinito</Label>
                        <Textarea
                          id="default_python_code"
                          value={formData.default_python_code}
                          onChange={(e) => setFormData(prev => ({ ...prev, default_python_code: e.target.value }))}
                          placeholder={
                            formData.python_env === 'turtle' 
                              ? "import turtle\n\nt = turtle.Turtle()\nt.forward(100)..." 
                              : formData.python_env === 'pgzero'
                              ? "# Pygame Zero\nWIDTH = 400\nHEIGHT = 300\n\ndef draw():\n    screen.fill('blue')..."
                              : "# Scrivi il codice Python iniziale..."
                          }
                          rows={8}
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {isWebCourse && (
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
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" asChild>
              <Link to={`/admin/corsi/${courseId}/lezioni/${lessonId}/compiti`}>Annulla</Link>
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isEditing ? 'Salva Modifiche' : 'Crea Compito'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
