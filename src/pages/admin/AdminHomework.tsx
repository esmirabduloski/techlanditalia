import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  LogOut, Loader2, ArrowLeft, Plus, Edit, Trash2, ClipboardList, Save, Upload, FileText, X, Paperclip, Calendar 
} from 'lucide-react';

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

interface Homework {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  points_reward: number;
  attachments: Attachment[];
  due_date: string | null;
  created_at: string;
}

interface HomeworkFormData {
  title: string;
  description: string;
  instructions: string;
  points_reward: number;
  attachments: Attachment[];
  due_date: string;
}

export default function AdminHomework() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<HomeworkFormData>({
    title: '',
    description: '',
    instructions: '',
    points_reward: 25,
    attachments: [],
    due_date: '',
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
    if (user && isAdmin && lessonId) {
      fetchData();
    }
  }, [user, isAdmin, lessonId]);

  const fetchData = async () => {
    // Fetch lesson
    const { data: lessonData } = await supabase
      .from('lessons')
      .select('id, title, lesson_number')
      .eq('id', lessonId)
      .maybeSingle();

    if (lessonData) {
      setLesson(lessonData);
    }

    // Fetch homework
    const { data: homeworkData } = await supabase
      .from('homework')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('created_at');

    if (homeworkData) {
      // Parse attachments from JSON
      const parsedHomework: Homework[] = homeworkData.map(h => ({
        ...h,
        attachments: Array.isArray(h.attachments) ? (h.attachments as unknown as Attachment[]) : []
      }));
      setHomework(parsedHomework);
    }

    setIsLoading(false);
  };

  const openCreateDialog = () => {
    setEditingHomework(null);
    setFormData({
      title: '',
      description: '',
      instructions: '',
      points_reward: 25,
      attachments: [],
      due_date: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (hw: Homework) => {
    setEditingHomework(hw);
    setFormData({
      title: hw.title,
      description: hw.description || '',
      instructions: hw.instructions || '',
      points_reward: hw.points_reward,
      attachments: hw.attachments || [],
      due_date: hw.due_date ? hw.due_date.split('T')[0] : '',
    });
    setDialogOpen(true);
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

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast({ title: 'Errore', description: 'Il titolo è obbligatorio', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    const payload = {
      lesson_id: lessonId!,
      title: formData.title,
      description: formData.description || null,
      instructions: formData.instructions || null,
      points_reward: formData.points_reward,
      attachments: formData.attachments as unknown as Json,
      due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
    };

    try {
      if (editingHomework) {
        const { error } = await supabase
          .from('homework')
          .update(payload)
          .eq('id', editingHomework.id);

        if (error) throw error;
        toast({ title: 'Successo', description: 'Compito aggiornato' });
      } else {
        const { error } = await supabase
          .from('homework')
          .insert(payload);

        if (error) throw error;
        toast({ title: 'Successo', description: 'Compito creato' });
      }

      setDialogOpen(false);
      fetchData();
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

  const deleteHomework = async (id: string) => {
    const { error } = await supabase.from('homework').delete().eq('id', id);
    
    if (error) {
      toast({ title: 'Errore', description: 'Impossibile eliminare il compito', variant: 'destructive' });
    } else {
      setHomework(homework.filter(h => h.id !== id));
      toast({ title: 'Successo', description: 'Compito eliminato' });
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

  if (!isAdmin || !lesson) return null;

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

      {/* Navigation */}
      <AdminNav />

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
          <span className="font-medium">Lezione {lesson.lesson_number}: {lesson.title}</span>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Compiti</h1>
            <p className="text-muted-foreground mt-1">{homework.length} compiti</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Compito
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingHomework ? 'Modifica Compito' : 'Nuovo Compito'}</DialogTitle>
                <DialogDescription>
                  Compito per la lezione {lesson.lesson_number}: {lesson.title}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="hw-title">Titolo *</Label>
                  <Input
                    id="hw-title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Esercizio 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hw-description">Descrizione</Label>
                  <Textarea
                    id="hw-description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Breve descrizione del compito..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hw-instructions">Istruzioni</Label>
                  <Textarea
                    id="hw-instructions"
                    value={formData.instructions}
                    onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                    placeholder="Istruzioni dettagliate per completare il compito..."
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hw-points">Punti</Label>
                  <Input
                    id="hw-points"
                    type="number"
                    min={0}
                    value={formData.points_reward}
                    onChange={(e) => setFormData(prev => ({ ...prev, points_reward: parseInt(e.target.value) || 0 }))}
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-2">
                  <Label htmlFor="hw-due-date" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Scadenza (opzionale)
                  </Label>
                  <Input
                    id="hw-due-date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Gli studenti vedranno un avviso quando la scadenza si avvicina
                  </p>
                </div>

                {/* Attachments Section */}
                <div className="space-y-2">
                  <Label>Allegati</Label>
                  <div className="border rounded-lg p-3 space-y-3">
                    {/* Upload Button */}
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
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF, immagini, file Roblox, ecc.
                      </p>
                    </div>

                    {/* Attachments List */}
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={handleSubmit} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {editingHomework ? 'Salva Modifiche' : 'Crea Compito'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Homework List */}
        {homework.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nessun compito</h3>
              <p className="text-muted-foreground mb-6">Crea il primo compito per questa lezione</p>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Crea Compito
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {homework.map((hw) => (
              <Card key={hw.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{hw.title}</h3>
                      {hw.description && (
                        <p className="text-sm text-muted-foreground truncate">{hw.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>{hw.points_reward} punti</span>
                        <span>•</span>
                        <span>{new Date(hw.created_at).toLocaleDateString('it-IT')}</span>
                        {hw.attachments && hw.attachments.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                              {hw.attachments.length} allegati
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(hw)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Elimina compito</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sei sicuro di voler eliminare "{hw.title}"? Questa azione non può essere annullata.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteHomework(hw.id)} 
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Elimina
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}