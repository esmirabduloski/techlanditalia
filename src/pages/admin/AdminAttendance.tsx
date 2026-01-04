import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AdminNav } from '@/components/admin/AdminNav';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Loader2, Check, X, AlertTriangle, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScheduledLesson {
  id: string;
  title: string;
  lesson_date: string;
  course: {
    id: string;
    title: string;
    emoji: string;
  };
}

interface Student {
  id: string;
  full_name: string;
  email: string;
  avatar_id: number;
}

interface AttendanceRecord {
  student_id: string;
  status: 'present' | 'absent_unexcused' | 'absent_excused';
  notes: string;
}

export default function AdminAttendance() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const [scheduledLessons, setScheduledLessons] = useState<ScheduledLesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/admin/login');
    } else if (!authLoading && user && !isAdmin) {
      navigate('/area-riservata');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    fetchScheduledLessons();
  }, []);

  useEffect(() => {
    if (selectedLessonId) {
      fetchStudentsAndAttendance();
    }
  }, [selectedLessonId]);

  const fetchScheduledLessons = async () => {
    const { data } = await supabase
      .from('scheduled_lessons')
      .select('id, title, lesson_date, course:courses(id, title, emoji)')
      .order('lesson_date', { ascending: false });

    if (data) {
      setScheduledLessons(data.map(l => ({
        ...l,
        course: l.course as unknown as ScheduledLesson['course']
      })));
    }
    setLoading(false);
  };

  const fetchStudentsAndAttendance = async () => {
    const selectedLesson = scheduledLessons.find(l => l.id === selectedLessonId);
    if (!selectedLesson) return;

    // Get students enrolled in the course
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id, student:profiles(id, full_name, email, avatar_id)')
      .eq('course_id', selectedLesson.course.id)
      .eq('status', 'active');

    if (enrollments) {
      const studentsList = enrollments
        .map(e => e.student as unknown as Student)
        .filter(s => s !== null);
      setStudents(studentsList);

      // Get existing attendance records
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('scheduled_lesson_id', selectedLessonId);

      const records: Record<string, AttendanceRecord> = {};
      studentsList.forEach(s => {
        const existing = existingAttendance?.find(a => a.student_id === s.id);
        records[s.id] = {
          student_id: s.id,
          status: (existing?.status as AttendanceRecord['status']) || 'present',
          notes: existing?.notes || ''
        };
      });
      setAttendanceRecords(records);
    }
  };

  const updateAttendance = (studentId: string, field: 'status' | 'notes', value: string) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const saveAttendance = async () => {
    if (!selectedLessonId) return;

    setSaving(true);
    const records = Object.values(attendanceRecords).map(r => ({
      student_id: r.student_id,
      scheduled_lesson_id: selectedLessonId,
      status: r.status,
      notes: r.notes || null,
      marked_by: user?.id,
      marked_at: new Date().toISOString()
    }));

    // Upsert all records
    const { error } = await supabase
      .from('attendance')
      .upsert(records, { onConflict: 'student_id,scheduled_lesson_id' });

    if (error) {
      toast.error('Errore durante il salvataggio');
    } else {
      toast.success('Presenze salvate con successo');
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const getStatusButton = (studentId: string, status: AttendanceRecord['status'], icon: React.ReactNode, label: string, colorClass: string) => {
    const isActive = attendanceRecords[studentId]?.status === status;
    return (
      <Button
        variant={isActive ? 'default' : 'outline'}
        size="sm"
        className={cn(isActive && colorClass)}
        onClick={() => updateAttendance(studentId, 'status', status)}
      >
        {icon}
        <span className="ml-1 hidden sm:inline">{label}</span>
      </Button>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const selectedLesson = scheduledLessons.find(l => l.id === selectedLessonId);

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
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/area-riservata">
                <User className="w-4 h-4 mr-2" />
                Area Riservata
              </Link>
            </Button>
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
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Registro Presenze</h1>
          <p className="text-muted-foreground">Segna le presenze degli studenti per ogni lezione programmata</p>
        </div>

        {/* Lesson selector */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Seleziona Lezione</label>
              <Select value={selectedLessonId} onValueChange={setSelectedLessonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona una lezione programmata" />
                </SelectTrigger>
                <SelectContent>
                  {scheduledLessons.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.course.emoji} {l.title} - {format(new Date(l.lesson_date), 'd MMM yyyy', { locale: it })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Attendance form */}
        {selectedLesson && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">{selectedLesson.course.emoji}</span>
                {selectedLesson.title}
                <span className="text-muted-foreground font-normal">
                  - {format(new Date(selectedLesson.lesson_date), 'EEEE d MMMM yyyy', { locale: it })}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nessuno studente iscritto a questo corso
                </p>
              ) : (
                <>
                  <div className="space-y-4">
                    {students.map(student => (
                      <div key={student.id} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{student.full_name}</p>
                          <p className="text-sm text-muted-foreground">{student.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusButton(
                            student.id,
                            'present',
                            <Check className="h-4 w-4" />,
                            'Presente',
                            'bg-green-600 hover:bg-green-700'
                          )}
                          {getStatusButton(
                            student.id,
                            'absent_unexcused',
                            <X className="h-4 w-4" />,
                            'Assente',
                            'bg-red-600 hover:bg-red-700'
                          )}
                          {getStatusButton(
                            student.id,
                            'absent_excused',
                            <AlertTriangle className="h-4 w-4" />,
                            'Giustificato',
                            'bg-yellow-600 hover:bg-yellow-700'
                          )}
                        </div>
                        <Input
                          placeholder="Note..."
                          value={attendanceRecords[student.id]?.notes || ''}
                          onChange={(e) => updateAttendance(student.id, 'notes', e.target.value)}
                          className="w-48"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button onClick={saveAttendance} disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Salva Presenze
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
