import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LogOut,
  FileText,
  Loader2,
  BookOpen,
  Mail,
  User,
  Users,
  GraduationCap,
  Calendar,
  MessageSquare,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
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
    parents: 0,
    students: 0,
    courses: 0,
    pendingBookings: 0,
    unreadContacts: 0,
    totalEnrollments: 0
  });
  const [enrollmentTrends, setEnrollmentTrends] = useState<EnrollmentTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchStats();
    }
  }, [user, isAdmin]);

  const fetchStats = async () => {
    // Fetch all stats in parallel
    const [
      parentsRes,
      studentsRes,
      coursesRes,
      pendingBookingsRes,
      contactsRes,
      enrollmentsRes,
      enrollmentTrendsRes
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'parent'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('courses').select('id', { count: 'exact', head: true }),
      supabase.from('trial_bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('contact_submissions').select('id', { count: 'exact', head: true }),
      supabase.from('enrollments').select('id', { count: 'exact', head: true }),
      supabase.from('enrollments').select('enrolled_at').order('enrolled_at', { ascending: true })
    ]);

    setStats({
      parents: parentsRes.count || 0,
      students: studentsRes.count || 0,
      courses: coursesRes.count || 0,
      pendingBookings: pendingBookingsRes.count || 0,
      unreadContacts: contactsRes.count || 0,
      totalEnrollments: enrollmentsRes.count || 0
    });

    // Process enrollment trends by month
    if (enrollmentTrendsRes.data) {
      const monthlyData: Record<string, number> = {};
      
      enrollmentTrendsRes.data.forEach((enrollment) => {
        const date = new Date(enrollment.enrolled_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
      });

      // Get last 12 months
      const trends: EnrollmentTrend[] = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
        trends.push({
          month: monthName,
          enrollments: monthlyData[monthKey] || 0
        });
      }
      
      setEnrollmentTrends(trends);
    }

    setIsLoading(false);
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

  if (!isAdmin) return null;

  const statCards = [
    { label: 'Genitori', value: stats.parents, icon: Users, color: 'bg-primary/10', iconColor: 'text-primary' },
    { label: 'Studenti', value: stats.students, icon: GraduationCap, color: 'bg-tech-teal/10', iconColor: 'text-tech-teal' },
    { label: 'Corsi Attivi', value: stats.courses, icon: BookOpen, color: 'bg-tech-purple/10', iconColor: 'text-tech-purple' },
    { label: 'Iscrizioni Totali', value: stats.totalEnrollments, icon: TrendingUp, color: 'bg-green-500/10', iconColor: 'text-green-500' },
    { label: 'Prenotazioni in Attesa', value: stats.pendingBookings, icon: Calendar, color: 'bg-amber-500/10', iconColor: 'text-amber-500' },
    { label: 'Contatti Ricevuti', value: stats.unreadContacts, icon: MessageSquare, color: 'bg-blue-500/10', iconColor: 'text-blue-500' },
  ];

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
      <div className="border-b bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-4 overflow-x-auto">
            <Link 
              to="/admin" 
              className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
            >
              <FileText className="w-4 h-4" />
              Blog
            </Link>
            <Link 
              to="/admin/corsi" 
              className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
            >
              <GraduationCap className="w-4 h-4" />
              Corsi
            </Link>
            <Link 
              to="/admin/prenotazioni" 
              className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4" />
              Prenotazioni
            </Link>
            <Link 
              to="/admin/contatti" 
              className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
            >
              <Mail className="w-4 h-4" />
              Contatti
            </Link>
            <Link 
              to="/admin/utenti" 
              className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
            >
              <User className="w-4 h-4" />
              Utenti
            </Link>
            <Link 
              to="/admin/statistiche" 
              className="py-3 px-2 border-b-2 border-primary text-primary font-medium flex items-center gap-2 whitespace-nowrap"
            >
              <BarChart3 className="w-4 h-4" />
              Statistiche
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Statistiche</h1>
          <p className="text-muted-foreground mt-1">Panoramica generale della piattaforma</p>
        </div>

        {/* Stats Cards */}
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

        {/* Enrollment Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Andamento Iscrizioni (ultimi 12 mesi)
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
                  <XAxis 
                    dataKey="month" 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="enrollments" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1} 
                    fill="url(#colorEnrollments)"
                    name="Iscrizioni"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
