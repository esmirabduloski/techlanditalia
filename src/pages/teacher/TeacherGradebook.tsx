import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTeacherRole } from '@/hooks/useTeacherRole';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, BookOpen, TrendingUp, TrendingDown, Minus, Users, BarChart3 } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { format, subMonths, isAfter } from 'date-fns';
import { it } from 'date-fns/locale';

interface GradedSubmission {
  id: string;
  student_id: string;
  homework_id: string;
  grade: number | null;
  status: string;
  submitted_at: string;
  feedback_at: string | null;
  student_name: string;
  homework_title: string;
  lesson_number: number;
  lesson_title: string;
  course_title: string;
  course_emoji: string;
  max_points: number;
}

interface StudentGroup {
  id: string;
  title: string;
  course_id: string;
}

export default function TeacherGradebook() {
  const [submissions, setSubmissions] = useState<GradedSubmission[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { isTeacher, isLoading: teacherLoading } = useTeacherRole();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const effectiveUserId = isAdmin && isImpersonating && impersonatedUser?.role === 'teacher'
    ? impersonatedUser.id
    : user?.id;

  const isAuthorized = isTeacher || (isAdmin && isImpersonating && impersonatedUser?.role === 'teacher');

  useEffect(() => {
    if (!authLoading && !teacherLoading && !isAuthorized) {
      navigate('/auth');
    }
  }, [isAuthorized, authLoading, teacherLoading, navigate]);

  useEffect(() => {
    if (effectiveUserId && isAuthorized) {
      fetchData();
    }
  }, [effectiveUserId, isAuthorized]);

  const fetchData = async () => {
    if (!effectiveUserId) return;
    setIsLoading(true);

    try {
      // Fetch teacher's groups
      const { data: groupsData } = await supabase
        .from('student_groups')
        .select('id, title, course_id')
        .eq('teacher_id', effectiveUserId);

      setGroups(groupsData || []);

      // Fetch all graded submissions (RLS filters to teacher's students)
      const { data, error } = await supabase
        .from('homework_submissions')
        .select(`
          id, student_id, homework_id, grade, status, submitted_at, feedback_at,
          student:student_id (full_name),
          homework:homework_id (
            title, points_reward,
            lesson:lesson_id (title, lesson_number, course:course_id (title, emoji))
          )
        `)
        .in('status', ['graded', 'pending', 'reviewed'])
        .order('submitted_at', { ascending: true });

      if (error) throw error;

      const mapped: GradedSubmission[] = (data || []).map((s: any) => ({
        id: s.id,
        student_id: s.student_id,
        homework_id: s.homework_id,
        grade: s.grade,
        status: s.status,
        submitted_at: s.submitted_at,
        feedback_at: s.feedback_at,
        student_name: s.student?.full_name || 'Sconosciuto',
        homework_title: s.homework?.title || '',
        lesson_number: s.homework?.lesson?.lesson_number || 0,
        lesson_title: s.homework?.lesson?.title || '',
        course_title: s.homework?.lesson?.course?.title || '',
        course_emoji: s.homework?.lesson?.course?.emoji || '📚',
        max_points: s.homework?.points_reward || 0,
      }));

      setSubmissions(mapped);
    } catch (error) {
      console.error('Error fetching gradebook data:', error);
      toast({ title: 'Errore', description: 'Impossibile caricare il registro voti', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter submissions by group
  const filteredSubmissions = useMemo(() => {
    if (selectedGroup === 'all') return submissions;
    // We need to check which students are in the selected group
    // For simplicity, we'll fetch this when group changes - but for now use all
    return submissions;
  }, [submissions, selectedGroup]);

  // Get unique students and homeworks
  const { students, homeworks, gradeMatrix, studentAverages, homeworkAverages } = useMemo(() => {
    const graded = filteredSubmissions.filter(s => s.status === 'graded' && s.grade !== null);
    
    const studentMap = new Map<string, string>();
    const homeworkMap = new Map<string, { title: string; lesson_number: number; emoji: string }>();
    
    filteredSubmissions.forEach(s => {
      studentMap.set(s.student_id, s.student_name);
      if (!homeworkMap.has(s.homework_id)) {
        homeworkMap.set(s.homework_id, {
          title: s.homework_title,
          lesson_number: s.lesson_number,
          emoji: s.course_emoji,
        });
      }
    });

    const students = Array.from(studentMap.entries()).map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const homeworks = Array.from(homeworkMap.entries())
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => a.lesson_number - b.lesson_number);

    // Build grade matrix: student -> homework -> grade
    const gradeMatrix = new Map<string, Map<string, number | null>>();
    students.forEach(s => {
      const hwMap = new Map<string, number | null>();
      homeworks.forEach(h => hwMap.set(h.id, null));
      gradeMatrix.set(s.id, hwMap);
    });

    graded.forEach(s => {
      const hwMap = gradeMatrix.get(s.student_id);
      if (hwMap) {
        hwMap.set(s.homework_id, s.grade);
      }
    });

    // Student averages
    const studentAverages = new Map<string, number>();
    students.forEach(s => {
      const hwMap = gradeMatrix.get(s.id)!;
      const grades = Array.from(hwMap.values()).filter((g): g is number => g !== null);
      studentAverages.set(s.id, grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : -1);
    });

    // Homework averages
    const homeworkAverages = new Map<string, number>();
    homeworks.forEach(h => {
      const grades: number[] = [];
      students.forEach(s => {
        const g = gradeMatrix.get(s.id)?.get(h.id);
        if (g !== null && g !== undefined) grades.push(g);
      });
      homeworkAverages.set(h.id, grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : -1);
    });

    return { students, homeworks, gradeMatrix, studentAverages, homeworkAverages };
  }, [filteredSubmissions]);

  // Trend data: monthly average grades
  const trendData = useMemo(() => {
    const graded = filteredSubmissions.filter(s => s.status === 'graded' && s.grade !== null);
    if (graded.length === 0) return [];

    const monthMap = new Map<string, { total: number; count: number }>();
    const sixMonthsAgo = subMonths(new Date(), 6);

    graded.forEach(s => {
      const date = new Date(s.feedback_at || s.submitted_at);
      if (isAfter(date, sixMonthsAgo)) {
        const key = format(date, 'yyyy-MM');
        const entry = monthMap.get(key) || { total: 0, count: 0 };
        entry.total += s.grade!;
        entry.count++;
        monthMap.set(key, entry);
      }
    });

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        month: format(new Date(key + '-01'), 'MMM yy', { locale: it }),
        media: Math.round(val.total / val.count),
        consegne: val.count,
      }));
  }, [filteredSubmissions]);

  const chartConfig: ChartConfig = {
    media: { label: 'Media Voti', color: 'hsl(var(--primary))' },
    consegne: { label: 'Consegne', color: 'hsl(var(--muted-foreground))' },
  };

  const getGradeColor = (grade: number | null) => {
    if (grade === null) return '';
    if (grade >= 80) return 'text-green-600 dark:text-green-400 font-semibold';
    if (grade >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getAvgBadge = (avg: number) => {
    if (avg < 0) return <span className="text-muted-foreground text-xs">-</span>;
    const variant = avg >= 80 ? 'default' : avg >= 60 ? 'secondary' : 'destructive';
    return <Badge variant={variant}>{avg}%</Badge>;
  };

  const getTrendIcon = (studentId: string) => {
    const graded = filteredSubmissions
      .filter(s => s.student_id === studentId && s.status === 'graded' && s.grade !== null)
      .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
    
    if (graded.length < 2) return <Minus className="w-3 h-3 text-muted-foreground" />;
    
    const half = Math.floor(graded.length / 2);
    const firstHalf = graded.slice(0, half);
    const secondHalf = graded.slice(half);
    
    const avg1 = firstHalf.reduce((a, b) => a + b.grade!, 0) / firstHalf.length;
    const avg2 = secondHalf.reduce((a, b) => a + b.grade!, 0) / secondHalf.length;
    
    if (avg2 - avg1 > 3) return <TrendingUp className="w-3 h-3 text-green-500" />;
    if (avg1 - avg2 > 3) return <TrendingDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  // Overall stats
  const overallStats = useMemo(() => {
    const graded = filteredSubmissions.filter(s => s.status === 'graded' && s.grade !== null);
    const pending = filteredSubmissions.filter(s => s.status === 'pending');
    const avgGrade = graded.length > 0
      ? Math.round(graded.reduce((a, b) => a + b.grade!, 0) / graded.length)
      : 0;
    return { graded: graded.length, pending: pending.length, avgGrade, totalStudents: students.length };
  }, [filteredSubmissions, students]);

  if (authLoading || teacherLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) return null;

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
          <Button variant="outline" size="sm" asChild>
            <Link to="/insegnante">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Title + Filter */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-tech-teal" />
              Registro Voti
            </h1>
            <p className="text-muted-foreground mt-1">
              {overallStats.totalStudents} studenti · {overallStats.graded} valutati · {overallStats.pending} in attesa
            </p>
          </div>
          {groups.length > 1 && (
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtra per gruppo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i gruppi</SelectItem>
                {groups.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{overallStats.totalStudents}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Studenti</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{homeworks.length}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><BookOpen className="w-3 h-3" /> Compiti</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{overallStats.avgGrade}%</div>
              <p className="text-xs text-muted-foreground">Media Generale</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-amber-500">{overallStats.pending}</div>
              <p className="text-xs text-muted-foreground">Da Valutare</p>
            </CardContent>
          </Card>
        </div>

        {/* Trend Chart */}
        {trendData.length > 1 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Andamento Media Voti (ultimi 6 mesi)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis domain={[0, 100]} className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="media"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Grade Table */}
        {students.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nessun dato</h3>
              <p className="text-muted-foreground">Non ci sono ancora consegne da visualizzare</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registro Completo</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[160px]">Studente</TableHead>
                      {homeworks.map(h => (
                        <TableHead key={h.id} className="text-center min-w-[80px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help text-xs">
                                {h.emoji} L{h.lesson_number}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{h.title}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableHead>
                      ))}
                      <TableHead className="text-center min-w-[80px] bg-muted/50">Media</TableHead>
                      <TableHead className="text-center min-w-[50px] bg-muted/50">Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map(student => {
                      const avg = studentAverages.get(student.id) ?? -1;
                      return (
                        <TableRow key={student.id}>
                          <TableCell className="sticky left-0 bg-background z-10 font-medium">
                            <Link 
                              to={`/insegnante/studente/${student.id}`}
                              className="hover:text-primary transition-colors"
                            >
                              {student.name}
                            </Link>
                          </TableCell>
                          {homeworks.map(h => {
                            const grade = gradeMatrix.get(student.id)?.get(h.id);
                            const hasPending = filteredSubmissions.some(
                              s => s.student_id === student.id && s.homework_id === h.id && s.status === 'pending'
                            );
                            return (
                              <TableCell key={h.id} className="text-center">
                                {grade !== null && grade !== undefined ? (
                                  <span className={getGradeColor(grade)}>{grade}%</span>
                                ) : hasPending ? (
                                  <Badge variant="outline" className="text-xs">⏳</Badge>
                                ) : (
                                  <span className="text-muted-foreground/40">-</span>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center bg-muted/50">
                            {getAvgBadge(avg)}
                          </TableCell>
                          <TableCell className="text-center bg-muted/50">
                            {getTrendIcon(student.id)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Homework averages row */}
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell className="sticky left-0 bg-muted/30 z-10 text-muted-foreground text-sm">
                        Media compito
                      </TableCell>
                      {homeworks.map(h => {
                        const avg = homeworkAverages.get(h.id) ?? -1;
                        return (
                          <TableCell key={h.id} className="text-center">
                            {avg >= 0 ? (
                              <span className={getGradeColor(avg)}>{avg}%</span>
                            ) : (
                              <span className="text-muted-foreground/40">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center bg-muted/50">
                        {overallStats.avgGrade > 0 && (
                          <Badge>{overallStats.avgGrade}%</Badge>
                        )}
                      </TableCell>
                      <TableCell className="bg-muted/50" />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
