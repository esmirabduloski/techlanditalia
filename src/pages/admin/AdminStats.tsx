import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { StatsFiltersBar, type StatsFilters } from '@/components/admin/StatsFilters';
import { 
  LogOut, Loader2, BookOpen, Users, GraduationCap,
  Calendar, MessageSquare, TrendingUp
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface Stats {
  parents: number;
  students: number;
  courses: number;
  pendingBookings: number;
  unreadContacts: number;
  totalEnrollments: number;
}

interface EnrollmentTrend {
  month: string;
  enrollments: number;
}

export default function AdminStats() {
  const [stats, setStats] = useState<Stats>({
    parents: 0, students: 0, courses: 0,
    pendingBookings: 0, unreadContacts: 0, totalEnrollments: 0
  });
  const [enrollmentTrends, setEnrollmentTrends] = useState<EnrollmentTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<StatsFilters>({
    dateFrom: undefined, dateTo: undefined, courseId: undefined, teacherId: undefined
  });
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [user, isAdmin, authLoading, navigate]);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);

    // Get admin IDs to exclude
    const { data: adminRoles } = await supabase
      .from('user_roles').select('user_id').eq('role', 'admin');
    const adminIds = adminRoles?.map(r => r.user_id) || [];

    // If teacher filter is set, get students in that teacher's groups
    let teacherStudentIds: string[] | null = null;
    if (filters.teacherId) {
      const { data: groups } = await supabase
        .from('student_groups').select('id').eq('teacher_id', filters.teacherId);
      if (groups && groups.length > 0) {
        const groupIds = groups.map(g => g.id);
        const { data: groupStudents } = await supabase
          .from('group_students').select('student_id').in('group_id', groupIds);
        teacherStudentIds = groupStudents?.map(gs => gs.student_id) || [];
      } else {
        teacherStudentIds = [];
      }
    }

    // Build enrollment query
    let enrollmentsQuery = supabase.from('enrollments').select('id, student_id, course_id, enrolled_at');
    if (filters.courseId) enrollmentsQuery = enrollmentsQuery.eq('course_id', filters.courseId);
    if (filters.dateFrom) enrollmentsQuery = enrollmentsQuery.gte('enrolled_at', filters.dateFrom.toISOString());
    if (filters.dateTo) enrollmentsQuery = enrollmentsQuery.lte('enrolled_at', filters.dateTo.toISOString());

    const [
      parentsRes, studentsRes, coursesRes,
      pendingBookingsRes, contactsRes, enrollmentsRes
    ] = await Promise.all([
      supabase.from('profiles').select('id').eq('role', 'parent'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('courses').select('id', { count: 'exact', head: true }),
      supabase.from('trial_bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('contact_submissions').select('id', { count: 'exact', head: true }),
      enrollmentsQuery,
    ]);

    const nonAdminParents = parentsRes.data?.filter(p => !adminIds.includes(p.id)) || [];

    let filteredEnrollments = enrollmentsRes.data?.filter(e => !adminIds.includes(e.student_id)) || [];
    if (teacherStudentIds !== null) {
      filteredEnrollments = filteredEnrollments.filter(e => teacherStudentIds!.includes(e.student_id));
    }

    // Student count filtered by teacher
    let studentCount = studentsRes.count || 0;
    if (teacherStudentIds !== null) {
      studentCount = teacherStudentIds.filter(id => !adminIds.includes(id)).length;
    }

    setStats({
      parents: nonAdminParents.length,
      students: studentCount,
      courses: coursesRes.count || 0,
      pendingBookings: pendingBookingsRes.count || 0,
      unreadContacts: contactsRes.count || 0,
      totalEnrollments: filteredEnrollments.length
    });

    // Process enrollment trends
    const monthlyData: Record<string, number> = {};
    filteredEnrollments.forEach((enrollment) => {
      const date = new Date(enrollment.enrolled_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
    });

    const trends: EnrollmentTrend[] = [];
    const now = new Date();
    const monthsToShow = filters.dateFrom ? 
      Math.max(Math.ceil((now.getTime() - filters.dateFrom.getTime()) / (30 * 24 * 60 * 60 * 1000)), 3) : 12;
    
    for (let i = Math.min(monthsToShow, 24) - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
      trends.push({ month: monthName, enrollments: monthlyData[monthKey] || 0 });
    }

    setEnrollmentTrends(trends);
    setIsLoading(false);
  }, [filters]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchStats();
    }
  }, [user, isAdmin, fetchStats]);

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

  if (!isAdmin) return null;

  const statCards = [
    { label: 'Genitori', value: stats.parents, icon: Users, color: 'bg-primary/10', iconColor: 'text-primary' },
    { label: 'Studenti', value: stats.students, icon: GraduationCap, color: 'bg-tech-teal/10', iconColor: 'text-tech-teal' },
    { label: 'Corsi Attivi', value: stats.courses, icon: BookOpen, color: 'bg-tech-purple/10', iconColor: 'text-tech-purple' },
    { label: 'Corsi Acquistati', value: stats.totalEnrollments, icon: TrendingUp, color: 'bg-green-500/10', iconColor: 'text-green-500' },
    { label: 'Prenotazioni in Attesa', value: stats.pendingBookings, icon: Calendar, color: 'bg-amber-500/10', iconColor: 'text-amber-500' },
    { label: 'Contatti Ricevuti', value: stats.unreadContacts, icon: MessageSquare, color: 'bg-blue-500/10', iconColor: 'text-blue-500' },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminHeader />

      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Statistiche</h1>
          <p className="text-muted-foreground mt-1">Panoramica generale della piattaforma</p>
        </div>

        <StatsFiltersBar filters={filters} onFiltersChange={setFilters} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${stat.color}`}>
                    <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Andamento Iscrizioni
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={enrollmentTrends}>
                  <defs>
                    <linearGradient id="colorEnrollments" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area type="monotone" dataKey="enrollments" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorEnrollments)" name="Iscrizioni" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
