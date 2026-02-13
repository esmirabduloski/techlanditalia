import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminNav } from "@/components/admin/AdminNav";
import { LessonCalendarManager } from "@/components/admin/LessonCalendarManager";
import { 
  Loader2, Plus, Users, LogOut, Home, Edit, Trash2, UsersRound, Search, Calendar, RotateCcw, Archive, GraduationCap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StudentGroup {
  id: string;
  title: string;
  course_id: string;
  course_title?: string;
  course_emoji?: string;
  teacher_id: string | null;
  teacher_name?: string;
  start_date: string | null;
  last_lesson_title: string | null;
  max_lessons: number;
  student_count: number;
  lesson_days: number[];
  lesson_time: string | null;
  status: string;
  archived_at: string | null;
}

interface Teacher {
  id: string;
  full_name: string;
  email: string | null;
}

interface Course {
  id: string;
  title: string;
  emoji: string;
}

interface Student {
  id: string;
  full_name: string;
  username: string | null;
}

export default function AdminGroups() {
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StudentGroup | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [calendarGroup, setCalendarGroup] = useState<StudentGroup | null>(null);
  const [resetAttendanceConfirm, setResetAttendanceConfirm] = useState<StudentGroup | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [archiveGroup, setArchiveGroup] = useState<StudentGroup | null>(null);
  const [archiveDate, setArchiveDate] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    course_id: '',
    teacher_id: '__none__',
    start_date: '',
    max_lessons: 32,
    lesson_days: [0] as number[], // Default Sunday
    lesson_time: '',
    selected_students: [] as string[]
  });
  const [isSaving, setIsSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

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

  const fetchData = async () => {
    try {
      // Fetch groups with course and teacher info
      const { data: groupsData } = await supabase
        .from('student_groups')
        .select(`
          id, title, course_id, teacher_id, start_date, last_lesson_title, max_lessons, lesson_days, lesson_time, status, archived_at,
          courses!inner(title, emoji)
        `)
        .order('created_at', { ascending: false });

      if (groupsData) {
        // Get teacher names and student counts
        const enrichedGroups = await Promise.all(
          groupsData.map(async (g: any) => {
            let teacherName = '';
            if (g.teacher_id) {
              const { data: teacher } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', g.teacher_id)
                .single();
              teacherName = teacher?.full_name || '';
            }

            const { count } = await supabase
              .from('group_students')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', g.id);

            return {
              id: g.id,
              title: g.title,
              course_id: g.course_id,
              course_title: g.courses?.title,
              course_emoji: g.courses?.emoji,
              teacher_id: g.teacher_id,
              teacher_name: teacherName,
              start_date: g.start_date,
              last_lesson_title: g.last_lesson_title,
              max_lessons: g.max_lessons,
              student_count: count || 0,
              lesson_days: (g.lesson_days as number[]) || [0],
              lesson_time: g.lesson_time,
              status: g.status || 'active',
              archived_at: g.archived_at
            };
          })
        );
        setGroups(enrichedGroups);
      }

      // Fetch teachers
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'teacher');

      if (rolesData && rolesData.length > 0) {
        const { data: teachersData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', rolesData.map(r => r.user_id));
        
        setTeachers(teachersData || []);
      }

      // Fetch courses
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, title, emoji');
      
      setCourses(coursesData || []);

      // Fetch students
      const { data: studentsData } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .eq('role', 'student')
        .order('full_name');
      
      setStudents(studentsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingGroup(null);
    setFormData({
      title: '',
      course_id: '',
      teacher_id: '__none__',
      start_date: '',
      max_lessons: 32,
      lesson_days: [0],
      lesson_time: '',
      selected_students: []
    });
    setStudentSearch('');
    setIsDialogOpen(true);
  };

  const openEditDialog = async (group: StudentGroup) => {
    // Fetch current students and group details with lesson_days
    const { data: groupDetails } = await supabase
      .from('student_groups')
      .select('lesson_days')
      .eq('id', group.id)
      .single();

    const { data: groupStudents } = await supabase
      .from('group_students')
      .select('student_id')
      .eq('group_id', group.id);

    setEditingGroup(group);
    setFormData({
      title: group.title,
      course_id: group.course_id,
      teacher_id: group.teacher_id || '__none__',
      start_date: group.start_date || '',
      max_lessons: group.max_lessons,
      lesson_days: (groupDetails?.lesson_days as number[]) || [0],
      lesson_time: group.lesson_time || '',
      selected_students: groupStudents?.map(gs => gs.student_id) || []
    });
    setStudentSearch('');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.course_id) {
      toast({ title: 'Errore', description: 'Titolo e corso sono obbligatori', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      if (editingGroup) {
        // Update group
        await supabase
          .from('student_groups')
          .update({
            title: formData.title,
            course_id: formData.course_id,
            teacher_id: formData.teacher_id === '__none__' ? null : formData.teacher_id,
            start_date: formData.start_date || null,
            max_lessons: formData.max_lessons,
            lesson_days: formData.lesson_days,
            lesson_time: formData.lesson_time || null
          })
          .eq('id', editingGroup.id);

        // Update students
        await supabase
          .from('group_students')
          .delete()
          .eq('group_id', editingGroup.id);

        if (formData.selected_students.length > 0) {
          await supabase
            .from('group_students')
            .insert(formData.selected_students.map(sid => ({
              group_id: editingGroup.id,
              student_id: sid
            })));
        }

        toast({ title: 'Successo', description: 'Gruppo aggiornato' });
      } else {
        // Create group
        const { data: newGroup, error } = await supabase
          .from('student_groups')
          .insert({
            title: formData.title,
            course_id: formData.course_id,
            teacher_id: formData.teacher_id === '__none__' ? null : formData.teacher_id,
            start_date: formData.start_date || null,
            max_lessons: formData.max_lessons,
            lesson_days: formData.lesson_days,
            lesson_time: formData.lesson_time || null
          })
          .select()
          .single();

        if (error) throw error;

        // Add students
        if (formData.selected_students.length > 0) {
          await supabase
            .from('group_students')
            .insert(formData.selected_students.map(sid => ({
              group_id: newGroup.id,
              student_id: sid
            })));
        }

        toast({ title: 'Successo', description: 'Gruppo creato' });
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (groupId: string) => {
    try {
      await supabase.from('student_groups').delete().eq('id', groupId);
      toast({ title: 'Successo', description: 'Gruppo eliminato' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
    setDeleteConfirm(null);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const handleResetAttendance = async (group: StudentGroup) => {
    setIsResetting(true);
    try {
      // Delete all attendance records for this group
      const { error } = await supabase
        .from('group_attendance')
        .delete()
        .eq('group_id', group.id);

      if (error) throw error;

      toast({ 
        title: 'Successo', 
        description: `Presenze del gruppo "${group.title}" resettate con successo` 
      });
    } catch (error: any) {
      toast({ 
        title: 'Errore', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsResetting(false);
      setResetAttendanceConfirm(null);
    }
  };

  const handleArchiveGroup = async () => {
    if (!archiveGroup || !archiveDate) return;
    setIsArchiving(true);
    try {
      const { error } = await supabase
        .from('student_groups')
        .update({ status: 'archived', archived_at: new Date(archiveDate).toISOString() })
        .eq('id', archiveGroup.id);
      if (error) throw error;
      toast({ title: 'Successo', description: `Gruppo "${archiveGroup.title}" archiviato` });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsArchiving(false);
      setArchiveGroup(null);
    }
  };

  const handleReactivateGroup = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('student_groups')
        .update({ status: 'active', archived_at: null })
        .eq('id', groupId);
      if (error) throw error;
      toast({ title: 'Successo', description: 'Gruppo riattivato' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  const toggleStudent = (studentId: string) => {
    setFormData(prev => ({
      ...prev,
      selected_students: prev.selected_students.includes(studentId)
        ? prev.selected_students.filter(id => id !== studentId)
        : [...prev.selected_students, studentId]
    }));
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
            <Button variant="outline" size="sm" asChild>
              <Link to="/insegnante">
                <GraduationCap className="w-4 h-4 mr-2" />
                Insegnante
              </Link>
            </Button>
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <UsersRound className="w-8 h-8 text-primary" />
              Gestione Gruppi
            </h1>
            <p className="text-muted-foreground mt-1">
              {groups.length} gruppi creati
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Nuovo Gruppo
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            {groups.length === 0 ? (
              <div className="text-center py-12">
                <UsersRound className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nessun gruppo</h3>
                <p className="text-muted-foreground mb-4">Crea il primo gruppo per iniziare</p>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Crea Gruppo
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead className="w-24">ID</TableHead>
                     <TableHead>Titolo</TableHead>
                     <TableHead>Stato</TableHead>
                     <TableHead>Insegnante</TableHead>
                     <TableHead>Corso</TableHead>
                     <TableHead>Data Inizio</TableHead>
                     <TableHead>Orario</TableHead>
                     <TableHead className="text-center">Studenti</TableHead>
                     <TableHead>Ultima Lezione</TableHead>
                     <TableHead className="w-28">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map(group => (
                    <TableRow key={group.id}>
                      <TableCell className="font-mono text-xs">
                        {group.id.substring(0, 8)}...
                      </TableCell>
                      <TableCell className="font-medium">{group.title}</TableCell>
                      <TableCell>
                        {group.status === 'active' ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Attivo</Badge>
                        ) : (
                          <Badge variant="secondary">Archiviato</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {group.teacher_name || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {group.course_emoji} {group.course_title}
                      </TableCell>
                       <TableCell>
                         {group.start_date ? new Date(group.start_date).toLocaleDateString('it-IT') : '-'}
                       </TableCell>
                       <TableCell>
                         {group.lesson_time ? group.lesson_time.substring(0, 5) : '-'}
                       </TableCell>
                       <TableCell className="text-center">
                        <Badge variant="secondary">{group.student_count}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {group.last_lesson_title || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setCalendarGroup(group)}
                            title="Gestisci calendario"
                          >
                            <Calendar className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setResetAttendanceConfirm(group)}
                            title="Reset presenze"
                          >
                            <RotateCcw className="w-4 h-4 text-orange-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(group)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          {group.status === 'active' ? (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                setArchiveGroup(group);
                                setArchiveDate(new Date().toISOString().split('T')[0]);
                              }}
                              title="Archivia gruppo"
                            >
                              <Archive className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleReactivateGroup(group.id)}
                              title="Riattiva gruppo"
                            >
                              <RotateCcw className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(group.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingGroup ? 'Modifica Gruppo' : 'Nuovo Gruppo'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Titolo *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Es: Gruppo Python Avanzato 2025"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Corso *</Label>
                  <Select
                    value={formData.course_id}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, course_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona corso" />
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
                  <Label>Insegnante</Label>
                  <Select
                    value={formData.teacher_id}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, teacher_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona insegnante" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessuno</SelectItem>
                      {teachers.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Data Inizio</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Orario Lezione</Label>
                  <Input
                    type="time"
                    value={formData.lesson_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, lesson_time: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Orario predefinito delle lezioni
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Numero Lezioni</Label>
                  <Input
                    type="number"
                    value={formData.max_lessons}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_lessons: parseInt(e.target.value) || 32 }))}
                    min={1}
                    max={100}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usa 40 per Minecraft, 32 per altri corsi
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Giorni Lezione (seleziona uno o più giorni)</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 0, label: 'Dom' },
                    { value: 1, label: 'Lun' },
                    { value: 2, label: 'Mar' },
                    { value: 3, label: 'Mer' },
                    { value: 4, label: 'Gio' },
                    { value: 5, label: 'Ven' },
                    { value: 6, label: 'Sab' }
                  ].map(day => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={formData.lesson_days.includes(day.value) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setFormData(prev => {
                          const isSelected = prev.lesson_days.includes(day.value);
                          // Don't allow removing the last day
                          if (isSelected && prev.lesson_days.length === 1) return prev;
                          return {
                            ...prev,
                            lesson_days: isSelected
                              ? prev.lesson_days.filter(d => d !== day.value)
                              : [...prev.lesson_days, day.value].sort((a, b) => a - b)
                          };
                        });
                      }}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formData.lesson_days.length > 1 
                    ? `${formData.lesson_days.length} lezioni a settimana`
                    : '1 lezione a settimana'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Studenti ({formData.selected_students.length} selezionati)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Cerca per nome o username..."
                    className="pl-9"
                  />
                </div>
                <div className="border rounded-lg max-h-60 overflow-y-auto p-2 space-y-1">
                  {students
                    .filter(s => {
                      const search = studentSearch.toLowerCase();
                      return s.full_name.toLowerCase().includes(search) ||
                        (s.username && s.username.toLowerCase().includes(search));
                    })
                    .map(s => (
                      <div key={s.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded">
                        <Checkbox
                          checked={formData.selected_students.includes(s.id)}
                          onCheckedChange={() => toggleStudent(s.id)}
                        />
                        <span className="text-sm">
                          {s.full_name}
                          {s.username && <span className="text-muted-foreground"> (@{s.username})</span>}
                        </span>
                      </div>
                    ))}
                  {students.filter(s => {
                    const search = studentSearch.toLowerCase();
                    return s.full_name.toLowerCase().includes(search) ||
                      (s.username && s.username.toLowerCase().includes(search));
                  }).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nessuno studente trovato
                    </p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annulla</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingGroup ? 'Salva' : 'Crea'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler eliminare questo gruppo? Questa azione non può essere annullata.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
                Elimina
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reset Attendance Confirmation */}
        <AlertDialog open={!!resetAttendanceConfirm} onOpenChange={() => setResetAttendanceConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Presenze</AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler resettare tutte le presenze del gruppo "{resetAttendanceConfirm?.title}"? 
                <br /><br />
                <strong className="text-destructive">Attenzione:</strong> Questa azione eliminerà permanentemente 
                tutti i dati delle presenze (presenti, assenti, giustificati) per questo gruppo. 
                L'azione non può essere annullata.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isResetting}>Annulla</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => resetAttendanceConfirm && handleResetAttendance(resetAttendanceConfirm)}
                disabled={isResetting}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {isResetting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                Reset Presenze
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Archive Group Dialog */}
        <AlertDialog open={!!archiveGroup} onOpenChange={() => setArchiveGroup(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archivia Gruppo</AlertDialogTitle>
              <AlertDialogDescription>
                Stai per archiviare il gruppo "{archiveGroup?.title}". 
                Il gruppo non verrà eliminato ma sarà contrassegnato come archiviato.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label>Data di Archiviazione</Label>
              <Input
                type="date"
                value={archiveDate}
                onChange={(e) => setArchiveDate(e.target.value)}
                className="mt-2"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isArchiving}>Annulla</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleArchiveGroup}
                disabled={isArchiving || !archiveDate}
              >
                {isArchiving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Archive className="w-4 h-4 mr-2" />}
                Archivia
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Lesson Calendar Manager */}
        {calendarGroup && (
          <LessonCalendarManager
            groupId={calendarGroup.id}
            groupTitle={calendarGroup.title}
            startDate={calendarGroup.start_date}
            maxLessons={calendarGroup.max_lessons}
            lessonDays={calendarGroup.lesson_days}
            defaultLessonTime={calendarGroup.lesson_time}
            open={!!calendarGroup}
            onOpenChange={(open) => !open && setCalendarGroup(null)}
          />
        )}
      </main>
    </div>
  );
}
