import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
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
} from "@/components/ui/dialog";
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
  LogOut, Loader2, Plus, Edit, Trash2, User, Calendar, Save, Home, MessageCircle, Eye, GraduationCap
} from 'lucide-react';
import { FeedbackTemplates } from '@/components/feedback/FeedbackTemplates';
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Student {
  id: string;
  full_name: string;
  email: string | null;
  parent_id: string | null;
}

interface Comment {
  id: string;
  content: string;
  visibility: string[];
  created_at: string;
  student: Student;
  author: {
    full_name: string;
    role: string;
  };
}

export default function AdminStudentComments() {
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('all');

  const [formData, setFormData] = useState({
    student_id: '',
    content: '',
    visibility: ['parent', 'teacher'] as string[],
  });

  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Read URL params
  const studentIdParam = searchParams.get('student_id');
  const parentIdParam = searchParams.get('parent_id');
  const visibilityParam = searchParams.get('visibility');

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchData();
    }
  }, [user, isAdmin]);

  // Handle URL params after data is loaded
  useEffect(() => {
    if (!isLoading && students.length > 0) {
      // If student_id param is present, open dialog with pre-selected student
      if (studentIdParam) {
        const student = students.find(s => s.id === studentIdParam);
        if (student) {
          setFormData({
            student_id: studentIdParam,
            content: '',
            visibility: ['parent', 'teacher', 'student'], // All can see for student comments
          });
          setEditingComment(null);
          setDialogOpen(true);
        }
        // Clear the URL params after handling
        navigate('/admin/commenti', { replace: true });
      }
      // If parent_id param is present, open dialog with children of that parent
      else if (parentIdParam) {
        const childrenOfParent = students.filter(s => s.parent_id === parentIdParam);
        
        if (childrenOfParent.length > 0) {
          setFormData({
            student_id: childrenOfParent.length === 1 ? childrenOfParent[0].id : '',
            content: '',
            visibility: visibilityParam === 'parent_only' ? ['parent', 'teacher'] : ['parent', 'teacher', 'student'],
          });
          setEditingComment(null);
          setDialogOpen(true);
        }
        // Clear the URL params after handling
        navigate('/admin/commenti', { replace: true });
      }
    }
  }, [isLoading, students, studentIdParam, parentIdParam, visibilityParam, navigate]);

  const fetchData = async () => {
    // Fetch students with parent_id
    const { data: studentsData } = await supabase
      .from('profiles')
      .select('id, full_name, email, parent_id')
      .eq('role', 'student')
      .order('full_name');

    setStudents(studentsData || []);

    // Fetch all comments
    const { data: commentsData } = await supabase
      .from('student_comments')
      .select(`
        id,
        content,
        visibility,
        created_at,
        student:student_id (id, full_name, email, parent_id),
        author:author_id (full_name, role)
      `)
      .order('created_at', { ascending: false });

    const typedComments = (commentsData || []).map((c: any) => ({
      id: c.id,
      content: c.content,
      visibility: c.visibility,
      created_at: c.created_at,
      student: c.student as Student,
      author: c.author as { full_name: string; role: string },
    }));

    setComments(typedComments);
    setIsLoading(false);
  };

  const openCreateDialog = () => {
    setEditingComment(null);
    setFormData({
      student_id: '',
      content: '',
      visibility: ['parent', 'teacher'],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (comment: Comment) => {
    setEditingComment(comment);
    setFormData({
      student_id: comment.student.id,
      content: comment.content,
      visibility: comment.visibility,
    });
    setDialogOpen(true);
  };

  const toggleVisibility = (value: string) => {
    setFormData(prev => ({
      ...prev,
      visibility: prev.visibility.includes(value)
        ? prev.visibility.filter(v => v !== value)
        : [...prev.visibility, value]
    }));
  };

  const handleSubmit = async () => {
    if (!formData.student_id || !formData.content.trim()) {
      toast({ 
        title: 'Errore', 
        description: 'Seleziona uno studente e scrivi un commento', 
        variant: 'destructive' 
      });
      return;
    }

    if (formData.visibility.length === 0) {
      toast({ 
        title: 'Errore', 
        description: 'Seleziona almeno una visibilità', 
        variant: 'destructive' 
      });
      return;
    }

    setIsSaving(true);

    try {
      if (editingComment) {
        const { error } = await supabase
          .from('student_comments')
          .update({
            content: formData.content,
            visibility: formData.visibility,
          })
          .eq('id', editingComment.id);

        if (error) throw error;
        toast({ title: 'Successo', description: 'Commento aggiornato' });
      } else {
        const { error } = await supabase
          .from('student_comments')
          .insert({
            student_id: formData.student_id,
            author_id: user!.id,
            content: formData.content,
            visibility: formData.visibility,
          });

        if (error) throw error;
        toast({ title: 'Successo', description: 'Commento aggiunto' });
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ 
        title: 'Errore', 
        description: error.message || 'Impossibile salvare il commento', 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from('student_comments').delete().eq('id', id);
    
    if (error) {
      toast({ title: 'Errore', description: 'Impossibile eliminare il commento', variant: 'destructive' });
    } else {
      setComments(comments.filter(c => c.id !== id));
      toast({ title: 'Successo', description: 'Commento eliminato' });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const getVisibilityLabel = (visibility: string[]) => {
    const labels = [];
    if (visibility.includes('parent')) labels.push('Genitore');
    if (visibility.includes('teacher')) labels.push('Insegnante');
    if (visibility.includes('student')) labels.push('Studente');
    return labels.join(', ');
  };

  const filteredComments = selectedStudentFilter === 'all' 
    ? comments 
    : comments.filter(c => c.student.id === selectedStudentFilter);

  // Get children of a specific parent for filtering in dialog
  const getStudentsForDialog = () => {
    if (parentIdParam) {
      return students.filter(s => s.parent_id === parentIdParam);
    }
    return students;
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
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Commenti Studenti</h1>
            <p className="text-muted-foreground mt-1">{comments.length} commenti totali</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Select value={selectedStudentFilter} onValueChange={setSelectedStudentFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filtra per studente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli studenti</SelectItem>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuovo Commento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingComment ? 'Modifica Commento' : 'Nuovo Commento'}</DialogTitle>
                  <DialogDescription>
                    Aggiungi un commento sul percorso dello studente
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="student">Studente *</Label>
                    <Select 
                      value={formData.student_id} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, student_id: v }))}
                      disabled={!!editingComment}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona studente" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">Commento *</Label>
                    <FeedbackTemplates
                      mode="comment"
                      onSelect={(text) => setFormData(prev => ({
                        ...prev,
                        content: prev.content ? prev.content + '\n' + text : text
                      }))}
                    />
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Scrivi il tuo commento..."
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Visibilità *</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Chi può vedere questo commento?
                    </p>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="vis-parent"
                          checked={formData.visibility.includes('parent')}
                          onCheckedChange={() => toggleVisibility('parent')}
                        />
                        <label htmlFor="vis-parent" className="text-sm">Genitore</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="vis-teacher"
                          checked={formData.visibility.includes('teacher')}
                          onCheckedChange={() => toggleVisibility('teacher')}
                        />
                        <label htmlFor="vis-teacher" className="text-sm">Insegnante</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="vis-student"
                          checked={formData.visibility.includes('student')}
                          onCheckedChange={() => toggleVisibility('student')}
                        />
                        <label htmlFor="vis-student" className="text-sm">Studente</label>
                      </div>
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
                    {editingComment ? 'Salva Modifiche' : 'Aggiungi Commento'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Comments List */}
        {filteredComments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nessun commento</h3>
              <p className="text-muted-foreground mb-6">Aggiungi il primo commento per uno studente</p>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Commento
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredComments.map((comment) => (
              <Card key={comment.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" />
                        {comment.student.full_name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Da: {comment.author?.full_name || 'Admin'} ({comment.author?.role || 'admin'})
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {getVisibilityLabel(comment.visibility)}
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(comment)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminare il commento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Questa azione non può essere annullata.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteComment(comment.id)}>
                              Elimina
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                  <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(comment.created_at), "d MMMM yyyy 'alle' HH:mm", { locale: it })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}