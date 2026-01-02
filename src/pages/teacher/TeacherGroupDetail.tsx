import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Loader2, ArrowLeft, Users, Calendar, BookOpen, CheckCircle2, XCircle, Clock, ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface GroupStudent {
  id: string;
  student_id: string;
  full_name: string;
  avatar_id: number;
  attendance: Record<number, string>; // lesson_number -> status
}

interface StudentGroup {
  id: string;
  title: string;
  course_id: string;
  course_title: string;
  course_emoji: string;
  teacher_name: string;
  start_date: string | null;
  last_lesson_title: string | null;
  max_lessons: number;
}

export default function TeacherGroupDetail() {
  const { groupId } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [group, setGroup] = useState<StudentGroup | null>(null);
  const [students, setStudents] = useState<GroupStudent[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastLessonTitle, setLastLessonTitle] = useState("");

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
          id, title, course_id, start_date, last_lesson_title, max_lessons, teacher_id,
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
        last_lesson_title: groupData.last_lesson_title,
        max_lessons: groupData.max_lessons
      });
      setLastLessonTitle(groupData.last_lesson_title || "");

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
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAttendance = async (studentId: string, lessonNumber: number) => {
    const currentStatus = students.find(s => s.student_id === studentId)?.attendance[lessonNumber];
    const newStatus = currentStatus === 'present' ? 'absent' : 'present';

    try {
      const { error } = await supabase
        .from('group_attendance')
        .upsert({
          group_id: groupId,
          student_id: studentId,
          lesson_number: lessonNumber,
          status: newStatus,
          marked_by: user!.id
        }, { onConflict: 'group_id,student_id,lesson_number' });

      if (error) throw error;

      // Update local state
      setStudents(prev => prev.map(s => {
        if (s.student_id === studentId) {
          return {
            ...s,
            attendance: { ...s.attendance, [lessonNumber]: newStatus }
          };
        }
        return s;
      }));
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveLastLesson = async () => {
    setIsSaving(true);
    try {
      await supabase
        .from('student_groups')
        .update({ last_lesson_title: lastLessonTitle })
        .eq('id', groupId);

      toast({ title: 'Salvato', description: 'Ultima lezione aggiornata' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <p className="text-sm text-muted-foreground">Studenti</p>
                <p className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {students.length}
                </p>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Ultima Lezione Svolta</p>
              <div className="flex gap-2">
                <Input 
                  value={lastLessonTitle}
                  onChange={(e) => setLastLessonTitle(e.target.value)}
                  placeholder="Nome dell'ultima lezione..."
                  className="max-w-md"
                />
                <Button onClick={handleSaveLastLesson} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Registro Presenze
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-green-500" />
                Presente
              </span>
              <span className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-red-500" />
                Assente
              </span>
              <span className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-muted border" />
                Non segnato
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nessuno studente in questo gruppo</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left p-2 min-w-[150px] sticky left-0 bg-background">Studente</th>
                      {Array.from({ length: totalLessons }, (_, i) => (
                        <th key={i} className="p-1 text-center text-xs min-w-[32px]">
                          {i + 1}
                        </th>
                      ))}
                      <th className="p-2 text-center min-w-[80px]">Dettaglio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => (
                      <tr key={student.student_id} className="border-t">
                        <td className="p-2 font-medium sticky left-0 bg-background">
                          {student.full_name}
                        </td>
                        {Array.from({ length: totalLessons }, (_, i) => {
                          const lessonNum = i + 1;
                          const status = student.attendance[lessonNum];
                          return (
                            <td key={lessonNum} className="p-1 text-center">
                              <button
                                onClick={() => toggleAttendance(student.student_id, lessonNum)}
                                className={cn(
                                  "w-6 h-6 rounded transition-colors",
                                  status === 'present' && "bg-green-500 hover:bg-green-600",
                                  status === 'absent' && "bg-red-500 hover:bg-red-600",
                                  !status && "bg-muted border hover:bg-muted/80"
                                )}
                                title={`Lezione ${lessonNum}: ${status || 'Non segnato'}`}
                              />
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
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
