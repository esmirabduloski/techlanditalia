import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GroupCertificatesManager } from "@/components/admin/GroupCertificatesManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { LessonCalendarManager } from "@/components/admin/LessonCalendarManager";
import { StudentTransferDialog } from "@/components/admin/StudentTransferDialog";
import { GroupMergeSplitDialog } from "@/components/admin/GroupMergeSplitDialog";
import { GroupTimelineDialog } from "@/components/admin/GroupTimelineDialog";
import { 
  Loader2, Plus, Users, LogOut, Home, Edit, Trash2, UsersRound, Search, Calendar, RotateCcw, Archive, GraduationCap, ArrowRightLeft, GitMerge, ListTree
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

interface CertificateFile {
  path: string;
  name: string;
  type: string;
}

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
  certificates: CertificateFile[];
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
  const [transferGroup, setTransferGroup] = useState<StudentGroup | null>(null);
  const [mergeSplitGroup, setMergeSplitGroup] = useState<StudentGroup | null>(null);
  const [timelineGroup, setTimelineGroup] = useState<StudentGroup | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    course_id: '',
    teacher_id: '__none__',
    start_date: '',
    max_lessons: 32,
    lesson_days: [0] as number[], // Default Sunday
    lesson_time: '',
    whatsapp_link: '',
    mega_chat_link: '',
    teacher_meeting_link: '',
    student_meeting_link: '',
    selected_students: [] as string[]
  });
  const [isSaving, setIsSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentExistingCourses, setStudentExistingCourses] = useState<Map<string, string[]>>(new Map());

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
          id, title, course_id, teacher_id, start_date, last_lesson_title, max_lessons, lesson_days, lesson_time, status, archived_at, certificates,
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
              archived_at: g.archived_at,
              certificates: ((g as any).certificates as CertificateFile[]) || []
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
      whatsapp_link: '',
      mega_chat_link: '',
      teacher_meeting_link: '',
      student_meeting_link: '',
      selected_students: []
    });
    setStudentSearch('');
    setStudentExistingCourses(new Map());
    setIsDialogOpen(true);
  };

  const openEditDialog = async (group: StudentGroup) => {
    // Fetch current students and group details with lesson_days
    const { data: groupDetails } = await supabase
      .from('student_groups')
      .select('lesson_days, whatsapp_link, mega_chat_link, certificates, teacher_meeting_link, student_meeting_link')
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
      whatsapp_link: (groupDetails as any)?.whatsapp_link || '',
      mega_chat_link: (groupDetails as any)?.mega_chat_link || '',
      teacher_meeting_link: (groupDetails as any)?.teacher_meeting_link || '',
      student_meeting_link: (groupDetails as any)?.student_meeting_link || '',
      selected_students: groupStudents?.map(gs => gs.student_id) || []
    });
    setStudentSearch('');
    const studentIds = groupStudents?.map(gs => gs.student_id) || [];
    fetchStudentExistingCourses(studentIds);
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
            lesson_time: formData.lesson_time || null,
            whatsapp_link: formData.whatsapp_link || null,
            teacher_meeting_link: formData.teacher_meeting_link || null,
            student_meeting_link: formData.student_meeting_link || null
          } as any)
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
            lesson_time: formData.lesson_time || null,
            whatsapp_link: formData.whatsapp_link || null,
            teacher_meeting_link: formData.teacher_meeting_link || null,
            student_meeting_link: formData.student_meeting_link || null
          } as any)
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

        // Auto-generate lesson calendar if start_date and lesson_days are set
        if (formData.start_date && formData.lesson_days.length > 0) {
          const scheduleItems = [];
          let currentDate = new Date(formData.start_date);
          let lessonCount = 0;
          const maxLessons = formData.max_lessons || 32;

          while (lessonCount < maxLessons) {
            const dayOfWeek = currentDate.getDay();
            if (formData.lesson_days.includes(dayOfWeek)) {
              lessonCount++;
              scheduleItems.push({
                group_id: newGroup.id,
                lesson_number: lessonCount,
                lesson_date: currentDate.toISOString().split('T')[0],
                lesson_title: `${lessonCount}.`,
                lesson_time: formData.lesson_time || null
              });
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }

          if (scheduleItems.length > 0) {
            await supabase.from('group_lesson_schedule').insert(scheduleItems);
          }
        }

        toast({ title: 'Successo', description: 'Gruppo creato con calendario' });
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

  const fetchStudentExistingCourses = async (studentIds: string[]) => {
    if (studentIds.length === 0) {
      setStudentExistingCourses(new Map());
      return;
    }
    const { data } = await supabase
      .from('group_students')
      .select('student_id, group_id, group:group_id(course_id)')
      .in('student_id', studentIds);

    const map = new Map<string, string[]>();
    if (data) {
      data.forEach((row: any) => {
        // Skip if editing and this is the current group
        if (editingGroup && row.group_id === editingGroup.id) return;
        const courseId = row.group?.course_id;
        if (!courseId) return;
        const existing = map.get(row.student_id) || [];
        if (!existing.includes(courseId)) existing.push(courseId);
        map.set(row.student_id, existing);
      });
    }
    setStudentExistingCourses(map);
  };

  const toggleStudent = (studentId: string) => {
    setFormData(prev => {
      const newSelected = prev.selected_students.includes(studentId)
        ? prev.selected_students.filter(id => id !== studentId)
        : [...prev.selected_students, studentId];
      
      // Fetch existing courses for updated selection
      fetchStudentExistingCourses(newSelected);
      
      return { ...prev, selected_students: newSelected };
    });
  };

  // Courses that are blocked because at least one selected student is already in a group for that course
  const blockedCourseIds = new Set<string>();
  studentExistingCourses.forEach((courseIds) => {
    courseIds.forEach(cid => blockedCourseIds.add(cid));
  });

  const availableCourses = courses.filter(c => !blockedCourseIds.has(c.id));

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

      <AdminNav />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
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
              <div className="-mx-6 overflow-x-auto">
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
                             onClick={() => setTimelineGroup(group)}
                             title="Timeline programma"
                           >
                             <ListTree className="w-4 h-4" />
                           </Button>
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
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             onClick={() => setTransferGroup(group)}
                             title="Trasferisci studenti"
                           >
                             <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                           </Button>
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             onClick={() => setMergeSplitGroup(group)}
                             title="Unisci/Dividi gruppo"
                           >
                             <GitMerge className="w-4 h-4 text-purple-500" />
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
              </div>
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

              {/* Students - select BEFORE course so courses get filtered */}
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Corso *</Label>
                  <Select
                    value={blockedCourseIds.has(formData.course_id) ? '' : formData.course_id}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, course_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona corso" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCourses.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.emoji} {c.title}
                        </SelectItem>
                      ))}
                      {availableCourses.length === 0 && formData.selected_students.length > 0 && (
                        <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                          Nessun corso disponibile per gli studenti selezionati
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  {blockedCourseIds.size > 0 && formData.selected_students.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {blockedCourseIds.size} cors{blockedCourseIds.size === 1 ? 'o escluso' : 'i esclusi'} (studenti già iscritti)
                    </p>
                  )}
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
                <Label>Link Gruppo WhatsApp</Label>
                <Input
                  value={formData.whatsapp_link}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_link: e.target.value }))}
                  placeholder="https://chat.whatsapp.com/..."
                />
                <p className="text-xs text-muted-foreground">
                  L'insegnante potrà vedere questo link per entrare nel gruppo WhatsApp
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>🎥 Link Meeting Insegnante</Label>
                  <Input
                    value={formData.teacher_meeting_link}
                    onChange={(e) => setFormData(prev => ({ ...prev, teacher_meeting_link: e.target.value }))}
                    placeholder="https://zoom.us/j/... (organizzatore)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Link per l'insegnante (organizzatore della call)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>🎥 Link Meeting Studenti</Label>
                  <Input
                    value={formData.student_meeting_link}
                    onChange={(e) => setFormData(prev => ({ ...prev, student_meeting_link: e.target.value }))}
                    placeholder="https://zoom.us/j/... (partecipante)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Link per gli studenti (partecipanti)
                  </p>
                </div>
              </div>

              {/* Certificates Manager - only in edit mode */}
              {editingGroup && (
                <GroupCertificatesManager
                  groupId={editingGroup.id}
                  certificates={editingGroup.certificates}
                  onUpdate={(certs) => {
                    setEditingGroup(prev => prev ? { ...prev, certificates: certs } : null);
                    // Also update in the groups list
                    setGroups(prev => prev.map(g => g.id === editingGroup.id ? { ...g, certificates: certs } : g));
                  }}
                />
              )}



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

        {/* Student Transfer Dialog */}
        {transferGroup && (
          <StudentTransferDialog
            open={!!transferGroup}
            onOpenChange={(open) => !open && setTransferGroup(null)}
            sourceGroupId={transferGroup.id}
            sourceGroupTitle={transferGroup.title}
            onComplete={fetchData}
          />
        )}

        {/* Group Merge/Split Dialog */}
        {mergeSplitGroup && (
          <GroupMergeSplitDialog
            open={!!mergeSplitGroup}
            onOpenChange={(open) => !open && setMergeSplitGroup(null)}
            currentGroupId={mergeSplitGroup.id}
            currentGroupTitle={mergeSplitGroup.title}
            currentCourseId={mergeSplitGroup.course_id}
            onComplete={fetchData}
          />
        )}

        {/* Group Timeline Dialog */}
        {timelineGroup && (
          <GroupTimelineDialog
            open={!!timelineGroup}
            onOpenChange={(open) => !open && setTimelineGroup(null)}
            groupId={timelineGroup.id}
            groupTitle={timelineGroup.title}
          />
        )}
      </main>
    </div>
  );
}
