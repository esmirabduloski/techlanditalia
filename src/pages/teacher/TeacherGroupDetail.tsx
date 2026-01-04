import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Loader2, ArrowLeft, Users, Calendar, ChevronRight, MessageCircle, Plus, Send, Trash2, Check, X, AlertCircle
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, addDays, isBefore, isToday, startOfDay } from "date-fns";
import { it } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface GroupStudent {
  id: string;
  student_id: string;
  full_name: string;
  avatar_id: number;
  attendance: Record<number, string>; // lesson_number -> status
}

interface LessonSchedule {
  id: string;
  lesson_number: number;
  lesson_date: string;
  lesson_title: string | null;
}

interface StudentGroup {
  id: string;
  title: string;
  course_id: string;
  course_title: string;
  course_emoji: string;
  teacher_name: string;
  start_date: string | null;
  max_lessons: number;
  lesson_days: number[];
}

interface GroupComment {
  id: string;
  content: string;
  created_at: string;
  author_name: string;
}

export default function TeacherGroupDetail() {
  const { groupId } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [group, setGroup] = useState<StudentGroup | null>(null);
  const [students, setStudents] = useState<GroupStudent[]>([]);
  const [lessonSchedule, setLessonSchedule] = useState<LessonSchedule[]>([]);
  
  // Group comments
  const [groupComments, setGroupComments] = useState<GroupComment[]>([]);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);
  
  // Attendance dialog
  const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<{
    studentId: string;
    studentName: string;
    lessonNumber: number;
    lessonDate: string;
    currentStatus: string | undefined;
  } | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string>('present');

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    } else if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, groupId]);

  const fetchData = async () => {
    try {
      // Fetch group with course and teacher info
      const { data: groupData } = await supabase
        .from('student_groups')
        .select(`
          id, title, course_id, start_date, max_lessons, teacher_id, lesson_days,
          courses!inner(title, emoji)
        `)
        .eq('id', groupId)
        .single();

      if (!groupData || groupData.teacher_id !== user!.id) {
        navigate('/insegnante');
        return;
      }

      // Get teacher name
      const { data: teacherProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user!.id)
        .single();

      setGroup({
        id: groupData.id,
        title: groupData.title,
        course_id: groupData.course_id,
        course_title: (groupData.courses as any)?.title,
        course_emoji: (groupData.courses as any)?.emoji,
        teacher_name: teacherProfile?.full_name || '',
        start_date: groupData.start_date,
        max_lessons: groupData.max_lessons,
        lesson_days: (groupData.lesson_days as number[]) || [0]
      });

      // Fetch lesson schedule
      const { data: scheduleData } = await supabase
        .from('group_lesson_schedule')
        .select('*')
        .eq('group_id', groupId)
        .order('lesson_number');

      // If no schedule exists and there's a start date, generate it
      if ((!scheduleData || scheduleData.length === 0) && groupData.start_date) {
        await generateLessonSchedule(
          groupId!, 
          groupData.start_date, 
          groupData.max_lessons, 
          (groupData.lesson_days as number[]) || [0]
        );
        // Refetch
        const { data: newSchedule } = await supabase
          .from('group_lesson_schedule')
          .select('*')
          .eq('group_id', groupId)
          .order('lesson_number');
        setLessonSchedule(newSchedule || []);
      } else {
        setLessonSchedule(scheduleData || []);
      }

      // Fetch students in group
      const { data: groupStudentsData } = await supabase
        .from('group_students')
        .select(`
          id, student_id,
          profiles!inner(full_name, avatar_id)
        `)
        .eq('group_id', groupId);

      if (groupStudentsData) {
        // Fetch attendance for all students
        const { data: attendanceData } = await supabase
          .from('group_attendance')
          .select('student_id, lesson_number, status')
          .eq('group_id', groupId);

        const attendanceMap: Record<string, Record<number, string>> = {};
        attendanceData?.forEach(a => {
          if (!attendanceMap[a.student_id]) {
            attendanceMap[a.student_id] = {};
          }
          attendanceMap[a.student_id][a.lesson_number] = a.status;
        });

        const studentsWithAttendance = groupStudentsData.map((gs: any) => ({
          id: gs.id,
          student_id: gs.student_id,
          full_name: gs.profiles?.full_name,
          avatar_id: gs.profiles?.avatar_id || 1,
          attendance: attendanceMap[gs.student_id] || {}
        }));

        setStudents(studentsWithAttendance);
      }

      // Fetch group comments - use a simpler query to avoid RLS issues
      const { data: commentsData } = await supabase
        .from('group_comments')
        .select('id, content, created_at, author_id')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (commentsData) {
        // Get author names separately
        const authorIds = [...new Set(commentsData.map(c => c.author_id))];
        const { data: authors } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', authorIds);

        const authorMap: Record<string, string> = {};
        authors?.forEach(a => { authorMap[a.id] = a.full_name; });

        setGroupComments(commentsData.map((c: any) => ({
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          author_name: authorMap[c.author_id] || 'Insegnante'
        })));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateLessonSchedule = async (
    groupId: string, 
    startDate: string, 
    maxLessons: number, 
    lessonDays: number[]
  ) => {
    const scheduleItems = [];
    let currentDate = new Date(startDate);
    let lessonCount = 0;

    // Generate lesson dates based on lesson days
    while (lessonCount < maxLessons) {
      const dayOfWeek = currentDate.getDay();
      
      if (lessonDays.includes(dayOfWeek)) {
        lessonCount++;
        scheduleItems.push({
          group_id: groupId,
          lesson_number: lessonCount,
          lesson_date: format(currentDate, 'yyyy-MM-dd'),
          lesson_title: `M${Math.ceil(lessonCount / 4)}L${((lessonCount - 1) % 4) + 1}`
        });
      }
      
      currentDate = addDays(currentDate, 1);
      
      // Safety check
      if (scheduleItems.length >= maxLessons) break;
    }

    if (scheduleItems.length > 0) {
      await supabase.from('group_lesson_schedule').insert(scheduleItems);
    }
  };

  // Returns true if a lesson date is today (UTC) or in the past (UTC)
  const isLessonDateAvailableUtc = (lessonDateStr: string): boolean => {
    // Expected: yyyy-MM-dd (sometimes it can come as ISO with time -> we keep the date part)
    const normalized = (lessonDateStr || "").trim().slice(0, 10);

    const parts = normalized.split("-").map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return false;

    const [year, month, day] = parts;

    const now = new Date();
    const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const lessonUtc = Date.UTC(year, month - 1, day);

    return lessonUtc <= utcToday;
  };

  // Check if a lesson date is today or in the past (UTC)
  const isLessonAvailable = (lessonNumber: number): boolean => {
    const lesson = lessonSchedule.find((l) => l.lesson_number === lessonNumber);
    if (!lesson) return false;

    return isLessonDateAvailableUtc(lesson.lesson_date);
  };

  // Get count of available lessons for display
  const availableLessonsCount = lessonSchedule.filter((lesson) =>
    isLessonDateAvailableUtc(lesson.lesson_date)
  ).length;

  // Debug: log the date comparison whenever schedule changes
  useEffect(() => {
    if (lessonSchedule.length === 0) return;
    const utcToday = new Date().toISOString().slice(0, 10);
    console.log('[Attendance UTC check]', {
      utcToday,
      sample: lessonSchedule.slice(0, 5).map((l) => ({
        n: l.lesson_number,
        date: l.lesson_date,
        available: isLessonDateAvailableUtc(l.lesson_date),
      })),
    });
  }, [lessonSchedule]);

  // Calculate last completed lesson based on attendance
  const getLastCompletedLesson = (): string => {
    // Find the highest lesson number where at least one student has attendance marked
    let lastLesson = 0;
    students.forEach(student => {
      Object.keys(student.attendance).forEach(lessonNum => {
        const num = parseInt(lessonNum);
        if (num > lastLesson && student.attendance[num]) {
          lastLesson = num;
        }
      });
    });

    if (lastLesson === 0) {
      return 'Ancora nessuna lezione svolta';
    }

    // Find the lesson title from schedule
    const lesson = lessonSchedule.find(l => l.lesson_number === lastLesson);
    return lesson?.lesson_title || `Lezione ${lastLesson}`;
  };

  const openAttendanceDialog = (
    studentId: string,
    studentName: string,
    lessonNumber: number,
    lessonDate: string
  ) => {
    // Block future lessons (UTC)
    if (!isLessonDateAvailableUtc(lessonDate)) return;

    const currentStatus = students.find((s) => s.student_id === studentId)?.attendance[lessonNumber];
    setSelectedAttendance({
      studentId,
      studentName,
      lessonNumber,
      lessonDate,
      currentStatus,
    });
    setPendingStatus(currentStatus || 'present');
    setIsAttendanceDialogOpen(true);
  };

  const saveAttendance = async () => {
    if (!selectedAttendance) return;

    try {
      const { error } = await supabase
        .from('group_attendance')
        .upsert({
          group_id: groupId,
          student_id: selectedAttendance.studentId,
          lesson_number: selectedAttendance.lessonNumber,
          status: pendingStatus,
          marked_by: user!.id
        }, { onConflict: 'group_id,student_id,lesson_number' });

      if (error) throw error;

      // Update local state
      setStudents(prev => prev.map(s => {
        if (s.student_id === selectedAttendance.studentId) {
          return {
            ...s,
            attendance: { ...s.attendance, [selectedAttendance.lessonNumber]: pendingStatus }
          };
        }
        return s;
      }));

      setIsAttendanceDialogOpen(false);
      setSelectedAttendance(null);
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddGroupComment = async () => {
    if (!newComment.trim()) return;

    setIsSavingComment(true);
    try {
      const { data, error } = await supabase
        .from('group_comments')
        .insert({
          group_id: groupId,
          author_id: user!.id,
          content: newComment.trim()
        })
        .select('id, content, created_at')
        .single();

      if (error) throw error;

      // Add to local state immediately
      setGroupComments(prev => [{
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        author_name: group?.teacher_name || 'Insegnante'
      }, ...prev]);

      toast({ title: 'Nota aggiunta' });
      setNewComment('');
      setIsCommentDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('group_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      setGroupComments(prev => prev.filter(c => c.id !== commentId));
      toast({ title: 'Nota eliminata' });
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  const getDayName = (dayNum: number) => {
    const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    return days[dayNum];
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!group) return null;

  const totalLessons = group.max_lessons;
  const lastCompletedLesson = getLastCompletedLesson();

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
            <Badge className="bg-tech-teal text-white">Insegnante</Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/insegnante')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Torna alla Dashboard
        </Button>

        {/* Group Info Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <p className="text-sm text-muted-foreground">Gruppo</p>
                <p className="text-lg font-semibold">{group.title}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Corso</p>
                <p className="text-lg font-semibold">
                  {group.course_emoji} {group.course_title}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data Inizio</p>
                <p className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {group.start_date ? new Date(group.start_date).toLocaleDateString('it-IT') : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Giorni Lezione</p>
                <div className="flex gap-1 mt-1">
                  {group.lesson_days.map(day => (
                    <Badge key={day} variant="secondary" className="text-xs">
                      {getDayName(day)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Studenti</p>
                <p className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {students.length}
                </p>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-1">Ultima Lezione Svolta</p>
              <p className="text-lg font-semibold text-primary">{lastCompletedLesson}</p>
            </div>
          </CardContent>
        </Card>

        {/* Lesson Calendar */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Calendario Lezioni
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lessonSchedule.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nessun calendario generato. Imposta una data di inizio gruppo.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
                {lessonSchedule.map(lesson => {
                  const lessonDate = new Date(lesson.lesson_date);
                  const isPast = isBefore(lessonDate, startOfDay(new Date()));
                  const isTodayLesson = isToday(lessonDate);
                  const hasAttendance = students.some(s => s.attendance[lesson.lesson_number]);
                  
                  return (
                    <div 
                      key={lesson.lesson_number}
                      className={cn(
                        "p-3 rounded-lg border text-center",
                        isTodayLesson && "ring-2 ring-primary bg-primary/5",
                        isPast && hasAttendance && "bg-green-50 border-green-200 dark:bg-green-950/20",
                        isPast && !hasAttendance && "bg-muted",
                        !isPast && !isTodayLesson && "opacity-60"
                      )}
                    >
                      <div className="font-medium text-sm">{lesson.lesson_title || `L${lesson.lesson_number}`}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(lessonDate, 'd MMM yyyy', { locale: it })}
                      </div>
                      <div className="text-xs mt-1">
                        {isTodayLesson && <Badge variant="default" className="text-[10px]">Oggi</Badge>}
                        {isPast && hasAttendance && <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-800">Svolta</Badge>}
                        {isPast && !hasAttendance && <Badge variant="outline" className="text-[10px]">Da segnare</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Group Comments */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Note del Gruppo
            </CardTitle>
            <Button onClick={() => setIsCommentDialogOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Aggiungi Nota
            </Button>
          </CardHeader>
          <CardContent>
            {groupComments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nessuna nota per questo gruppo
              </p>
            ) : (
              <div className="space-y-3">
                {groupComments.map(comment => (
                  <div key={comment.id} className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => handleDeleteComment(comment.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {comment.author_name} • {format(new Date(comment.created_at), "d MMM yyyy 'alle' HH:mm", { locale: it })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Registro Presenze
            </CardTitle>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-green-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
                Presente
              </span>
              <span className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-red-500 flex items-center justify-center">
                  <X className="w-3 h-3 text-white" />
                </div>
                Assente (non giustificato)
              </span>
              <span className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-yellow-500 flex items-center justify-center">
                  <AlertCircle className="w-3 h-3 text-white" />
                </div>
                Assente (giustificato)
              </span>
              <span className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-muted border" />
                Non segnato
              </span>
              <span className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-muted border-2 border-dashed border-muted-foreground/30" />
                Futuro (bloccato)
              </span>
            </div>
            
            <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">📋 Guida:</strong>
              </p>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                <li>• <span className="text-yellow-600 font-medium">Giallo</span>: Lo studente o genitore ha avvisato in anticipo dell'assenza. <span className="italic">Aggiungi un commento al gruppo per documentare l'avviso.</span></li>
                <li>• <span className="text-red-600 font-medium">Rosso</span>: Lo studente era assente senza preavviso.</li>
              </ul>
            </div>
            
            <p className="text-sm text-muted-foreground mt-2">
              Lezioni disponibili: {availableLessonsCount} di {totalLessons}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">UTC oggi: {new Date().toISOString().slice(0, 10)}</Badge>
              {lessonSchedule[0] && (
                <Badge variant="outline">L1: {lessonSchedule[0].lesson_date}</Badge>
              )}
              {lessonSchedule[1] && (
                <Badge variant="outline">L2: {lessonSchedule[1].lesson_date}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nessuno studente in questo gruppo</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-w-full" style={{ scrollbarWidth: 'thin' }}>
                <table className="w-auto min-w-full">
                  <thead>
                    <tr>
                      <th className="text-left p-2 min-w-[150px] sticky left-0 bg-background z-10">Studente</th>
                      {lessonSchedule.map((lesson) => (
                        <th key={lesson.lesson_number} className="p-1 text-center text-xs min-w-[36px]" title={format(new Date(lesson.lesson_date), 'd/M/yyyy')}>
                          {lesson.lesson_number}
                        </th>
                      ))}
                      <th className="p-2 text-center min-w-[80px]">Dettaglio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => (
                      <tr key={student.student_id} className="border-t">
                        <td className="p-2 font-medium sticky left-0 bg-background z-10">
                          {student.full_name}
                        </td>
                        {lessonSchedule.map((lesson) => {
                          const lessonNum = lesson.lesson_number;
                          const status = student.attendance[lessonNum];
                          const isAvailable = isLessonDateAvailableUtc(lesson.lesson_date);
                          return (
                            <td key={lessonNum} className="p-1 text-center">
                              <button
                                onClick={() => openAttendanceDialog(student.student_id, student.full_name, lessonNum, lesson.lesson_date)}
                                disabled={!isAvailable}
                                className={cn(
                                  "w-6 h-6 rounded transition-colors flex items-center justify-center",
                                  !isAvailable && "pointer-events-none",
                                  status === 'present' && (isAvailable ? "bg-green-500 hover:bg-green-600" : "bg-green-500 opacity-50"),
                                  status === 'absent' && (isAvailable ? "bg-red-500 hover:bg-red-600" : "bg-red-500 opacity-50"),
                                  status === 'justified' && (isAvailable ? "bg-yellow-500 hover:bg-yellow-600" : "bg-yellow-500 opacity-50"),
                                  !status && isAvailable && "bg-muted border hover:bg-muted/80 cursor-pointer",
                                  !isAvailable && "bg-muted border-2 border-dashed border-muted-foreground/30 cursor-not-allowed opacity-50"
                                )}
                                title={
                                  !isAvailable 
                                    ? `Lezione ${lessonNum} (${format(new Date(lesson.lesson_date), 'd/M')}): Futura - non modificabile`
                                    : `Lezione ${lessonNum} (${format(new Date(lesson.lesson_date), 'd/M')}): ${status === 'present' ? 'Presente' : status === 'absent' ? 'Assente' : status === 'justified' ? 'Giustificato' : 'Non segnato'}`
                                }
                              >
                                {status === 'present' && <Check className="w-3 h-3 text-white" />}
                                {status === 'absent' && <X className="w-3 h-3 text-white" />}
                                {status === 'justified' && <AlertCircle className="w-3 h-3 text-white" />}
                              </button>
                            </td>
                          );
                        })}
                        <td className="p-2 text-center">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/insegnante/studente/${student.student_id}`)}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Scorri orizzontalmente per vedere tutte le {lessonSchedule.length} lezioni →
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add Comment Dialog */}
      <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi Nota al Gruppo</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nota</Label>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Scrivi una nota generale per questo gruppo..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCommentDialogOpen(false)}>
              Annulla
            </Button>
            <Button 
              onClick={handleAddGroupComment} 
              disabled={isSavingComment || !newComment.trim()}
            >
              {isSavingComment ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Status Dialog */}
      <Dialog open={isAttendanceDialogOpen} onOpenChange={setIsAttendanceDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Segna Presenza</DialogTitle>
          </DialogHeader>
          
          {selectedAttendance && (
            <div className="space-y-4 py-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Studente:</span>{' '}
                <span className="font-medium">{selectedAttendance.studentName}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Lezione:</span>{' '}
                <span className="font-medium">{selectedAttendance.lessonNumber}</span>
              </div>
              
              <RadioGroup value={pendingStatus} onValueChange={setPendingStatus} className="space-y-3">
                <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => setPendingStatus('present')}>
                  <RadioGroupItem value="present" id="present" />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-6 h-6 rounded bg-green-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <Label htmlFor="present" className="cursor-pointer font-medium">Presente</Label>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => setPendingStatus('justified')}>
                  <RadioGroupItem value="justified" id="justified" />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-6 h-6 rounded bg-yellow-500 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <Label htmlFor="justified" className="cursor-pointer font-medium">Assente (giustificato)</Label>
                      <p className="text-xs text-muted-foreground">Ha avvisato in anticipo</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => setPendingStatus('absent')}>
                  <RadioGroupItem value="absent" id="absent" />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-6 h-6 rounded bg-red-500 flex items-center justify-center">
                      <X className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <Label htmlFor="absent" className="cursor-pointer font-medium">Assente (non giustificato)</Label>
                      <p className="text-xs text-muted-foreground">Non ha avvisato</p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAttendanceDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={saveAttendance}>
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
