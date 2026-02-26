import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, User, BookOpen, Users, UsersRound, LogOut, Phone, Mail, Clock,
  ChevronRight, GraduationCap, Plus, Trash2, Edit2, Bell, Check, CheckCheck,
  BarChart3, CalendarDays, ExternalLink, TrendingUp, TrendingDown, AlertTriangle,
  Link as LinkIcon, Book, FileText, Calendar, Video, MessageCircle, HelpCircle, Settings, Star, Globe, Shield, Award
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AvailabilitySlot {
  day: string;
  startTime: string;
  endTime: string;
}

interface TeacherProfile {
  id: string;
  user_id: string;
  phone: string | null;
  availability: AvailabilitySlot[] | null;
}

interface Course {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  total_lessons: number;
}

interface StudentGroup {
  id: string;
  title: string;
  course_id: string;
  course_title?: string;
  course_emoji?: string;
  start_date: string | null;
  last_lesson_title: string | null;
  max_lessons: number;
  student_count?: number;
  lesson_time?: string | null;
  status: string;
  lessons_completed?: number;
}

interface TeacherNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata: any;
  created_at: string;
}

interface GroupStats {
  groupId: string;
  groupTitle: string;
  attendanceRate: number;
  totalLessons: number;
  totalStudents: number;
}

interface StudentActivity {
  studentId: string;
  studentName: string;
  attendanceRate: number;
  totalPresent: number;
  totalLessons: number;
}

interface UpcomingLesson {
  id: string;
  group_id: string;
  group_title: string;
  group_lesson_time: string | null;
  lesson_number: number;
  lesson_date: string;
  lesson_title: string | null;
  lesson_time: string | null;
}

interface TeacherLink {
  id: string;
  title: string;
  url: string;
  description: string | null;
  icon: string;
}

const DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const TIMES = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minutes = i % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minutes}`;
});

const getIconComponent = (iconName: string) => {
  const icons: Record<string, React.ElementType> = {
    link: LinkIcon,
    book: Book,
    file: FileText,
    calendar: Calendar,
    video: Video,
    message: MessageCircle,
    help: HelpCircle,
    settings: Settings,
    star: Star,
    globe: Globe,
  };
  return icons[iconName] || LinkIcon;
};

export default function TeacherDashboard() {
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Use impersonated user ID if admin is impersonating a teacher
  const effectiveUserId = isAdmin && isImpersonating && impersonatedUser?.role === 'teacher'
    ? impersonatedUser.id
    : user?.id;
  
  const [isTeacher, setIsTeacher] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profilo");
  const [profile, setProfile] = useState<{ full_name: string; email: string | null } | null>(null);
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
  const [assignedCourses, setAssignedCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingAvailability, setIsEditingAvailability] = useState(false);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [notifications, setNotifications] = useState<TeacherNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  // New state for statistics, reminders, and links
  const [groupStats, setGroupStats] = useState<GroupStats[]>([]);
  const [topStudents, setTopStudents] = useState<StudentActivity[]>([]);
  const [lowAttendanceStudents, setLowAttendanceStudents] = useState<StudentActivity[]>([]);
  const [upcomingLessons, setUpcomingLessons] = useState<UpcomingLesson[]>([]);
  const [teacherLinks, setTeacherLinks] = useState<TeacherLink[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [groupStatusFilter, setGroupStatusFilter] = useState<string>('all');
  const [groupSortBy, setGroupSortBy] = useState<string>('title');

  useEffect(() => {
    // If impersonating a teacher, skip normal auth checks
    if (isAdmin && isImpersonating && impersonatedUser?.role === 'teacher') {
      setIsTeacher(true);
      fetchData();
      return;
    }
    
    if (!authLoading && user) {
      checkTeacherRole();
    } else if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate, isAdmin, isImpersonating, impersonatedUser]);

  const checkTeacherRole = async () => {
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .eq('role', 'teacher')
        .maybeSingle();

      if (!roleData) {
        toast({ title: 'Accesso negato', description: 'Non hai il ruolo di insegnante', variant: 'destructive' });
        navigate('/area-riservata');
        return;
      }

      setIsTeacher(true);
      await fetchData();
    } catch (error) {
      console.error("Error checking teacher role:", error);
      navigate('/area-riservata');
    }
  };

  const fetchData = async () => {
    if (!effectiveUserId) return;
    
    try {
      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', effectiveUserId)
        .single();
      
      setProfile(profileData);

      // Fetch teacher profile
      const { data: teacherData } = await supabase
        .from('teacher_profiles')
        .select('*')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (teacherData) {
        const parsedAvailability = Array.isArray(teacherData.availability) 
          ? (teacherData.availability as unknown as AvailabilitySlot[])
          : null;
        const parsedProfile: TeacherProfile = {
          id: teacherData.id,
          user_id: teacherData.user_id,
          phone: teacherData.phone,
          availability: parsedAvailability
        };
        setTeacherProfile(parsedProfile);
        setPhone(teacherData.phone || "");
        setAvailabilitySlots(parsedAvailability || []);
      }

      // Fetch assigned courses
      const { data: teacherCourses } = await supabase
        .from('teacher_courses')
        .select('course_id')
        .eq('teacher_id', effectiveUserId);

      if (teacherCourses && teacherCourses.length > 0) {
        const courseIds = teacherCourses.map(tc => tc.course_id);
        const { data: coursesData } = await supabase
          .from('courses')
          .select('id, slug, title, emoji, total_lessons')
          .in('id', courseIds);
        
        setAssignedCourses(coursesData || []);
      }

      // Fetch groups
      const { data: groupsData } = await supabase
        .from('student_groups')
        .select(`
          id, title, course_id, start_date, last_lesson_title, max_lessons, lesson_time, status,
          courses!inner(title, emoji)
        `)
        .eq('teacher_id', effectiveUserId);

      let fetchedGroups: StudentGroup[] = [];
      if (groupsData) {
        // Get student counts and completed lessons for each group
        const today = new Date().toISOString().split('T')[0];
        const groupsWithCounts = await Promise.all(
          groupsData.map(async (g: any) => {
            const [{ count }, { count: lessonsCount }] = await Promise.all([
              supabase
                .from('group_students')
                .select('*', { count: 'exact', head: true })
                .eq('group_id', g.id),
              supabase
                .from('group_lesson_schedule')
                .select('*', { count: 'exact', head: true })
                .eq('group_id', g.id)
                .lte('lesson_date', today)
            ]);
            
            return {
              id: g.id,
              title: g.title,
              course_id: g.course_id,
              course_title: g.courses?.title,
              course_emoji: g.courses?.emoji,
              start_date: g.start_date,
              last_lesson_title: g.last_lesson_title,
              max_lessons: g.max_lessons,
              student_count: count || 0,
              lesson_time: g.lesson_time,
              status: g.status || 'active',
              lessons_completed: lessonsCount || 0
            };
          })
        );
        fetchedGroups = groupsWithCounts;
        setGroups(groupsWithCounts);
      }

      // Fetch notifications
      const { data: notificationsData } = await supabase
        .from('teacher_notifications')
        .select('*')
        .eq('teacher_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      setNotifications(notificationsData || []);

      // Fetch teacher links
      const { data: linksData } = await supabase
        .from('teacher_links')
        .select('id, title, url, description, icon')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      setTeacherLinks(linksData || []);

      // Fetch statistics and upcoming lessons
      await fetchStatistics(fetchedGroups);
      await fetchUpcomingLessons(fetchedGroups);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStatistics = async (groupsList: StudentGroup[]) => {
    if (groupsList.length === 0) {
      setStatsLoading(false);
      return;
    }

    try {
      const groupIds = groupsList.map(g => g.id);
      
      // Fetch all attendance data for teacher's groups
      const { data: attendanceData } = await supabase
        .from('group_attendance')
        .select('group_id, student_id, status, lesson_number')
        .in('group_id', groupIds);

      // Fetch all students in groups
      const { data: groupStudentsData } = await supabase
        .from('group_students')
        .select('group_id, student_id, profiles!inner(id, full_name)')
        .in('group_id', groupIds);

      if (attendanceData && groupStudentsData) {
        // Calculate group stats
        const statsMap = new Map<string, { present: number; total: number; students: Set<string>; lessons: Set<number> }>();
        
        groupsList.forEach(g => {
          statsMap.set(g.id, { present: 0, total: 0, students: new Set(), lessons: new Set() });
        });

        // Count students per group
        groupStudentsData.forEach((gs: any) => {
          const stats = statsMap.get(gs.group_id);
          if (stats) {
            stats.students.add(gs.student_id);
          }
        });

        // Calculate attendance
        attendanceData.forEach((a: any) => {
          const stats = statsMap.get(a.group_id);
          if (stats) {
            stats.total++;
            stats.lessons.add(a.lesson_number);
            if (a.status === 'present') {
              stats.present++;
            }
          }
        });

        const calculatedGroupStats: GroupStats[] = groupsList.map(g => {
          const stats = statsMap.get(g.id) || { present: 0, total: 0, students: new Set(), lessons: new Set() };
          return {
            groupId: g.id,
            groupTitle: g.title,
            attendanceRate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
            totalLessons: stats.lessons.size,
            totalStudents: stats.students.size
          };
        });
        
        setGroupStats(calculatedGroupStats);

        // Calculate student activity
        const studentStatsMap = new Map<string, { name: string; present: number; total: number }>();
        
        groupStudentsData.forEach((gs: any) => {
          if (!studentStatsMap.has(gs.student_id)) {
            studentStatsMap.set(gs.student_id, { 
              name: gs.profiles.full_name, 
              present: 0, 
              total: 0 
            });
          }
        });

        attendanceData.forEach((a: any) => {
          const student = studentStatsMap.get(a.student_id);
          if (student) {
            student.total++;
            if (a.status === 'present') {
              student.present++;
            }
          }
        });

        const allStudentActivities: StudentActivity[] = Array.from(studentStatsMap.entries())
          .map(([id, stats]) => ({
            studentId: id,
            studentName: stats.name,
            attendanceRate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
            totalPresent: stats.present,
            totalLessons: stats.total
          }))
          .filter(s => s.totalLessons > 0);

        // Top 3 students (highest attendance)
        const sorted = [...allStudentActivities].sort((a, b) => b.attendanceRate - a.attendanceRate);
        setTopStudents(sorted.slice(0, 3));

        // Students with < 70% attendance
        const lowAttendance = allStudentActivities.filter(s => s.attendanceRate < 70);
        setLowAttendanceStudents(lowAttendance.slice(0, 5));
      }
    } catch (error) {
      console.error("Error fetching statistics:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchUpcomingLessons = async (groupsList: StudentGroup[]) => {
    if (groupsList.length === 0) return;

    try {
      const groupIds = groupsList.map(g => g.id);
      const today = new Date().toISOString().split('T')[0];
      const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data: lessonsData } = await supabase
        .from('group_lesson_schedule')
        .select('id, group_id, lesson_number, lesson_date, lesson_title, lesson_time')
        .in('group_id', groupIds)
        .gte('lesson_date', today)
        .lte('lesson_date', next7Days)
        .order('lesson_date', { ascending: true })
        .limit(10);

      if (lessonsData) {
        const lessonsWithGroups = lessonsData.map((l: any) => {
          const group = groupsList.find(g => g.id === l.group_id);
          return {
            ...l,
            group_title: group?.title || 'Gruppo',
            group_lesson_time: group?.lesson_time || null
          };
        });
        setUpcomingLessons(lessonsWithGroups);
      }
    } catch (error) {
      console.error("Error fetching upcoming lessons:", error);
    }
  };

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!effectiveUserId || !isTeacher) return;

    const channel = supabase
      .channel('teacher-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'teacher_notifications',
          filter: `teacher_id=eq.${effectiveUserId}`
        },
        (payload) => {
          const newNotification = payload.new as TeacherNotification;
          setNotifications(prev => [newNotification, ...prev]);
          toast({
            title: newNotification.title,
            description: newNotification.message
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveUserId, isTeacher, toast]);

  const markNotificationAsRead = async (id: string) => {
    await supabase
      .from('teacher_notifications')
      .update({ is_read: true })
      .eq('id', id);
    
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
  };

  const markAllNotificationsAsRead = async () => {
    if (!effectiveUserId) return;
    
    await supabase
      .from('teacher_notifications')
      .update({ is_read: true })
      .eq('teacher_id', effectiveUserId)
      .eq('is_read', false);
    
    setNotifications(prev => 
      prev.map(n => ({ ...n, is_read: true }))
    );
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleSavePhone = async () => {
    if (!effectiveUserId) return;
    
    setIsSaving(true);
    try {
      let error;
      if (teacherProfile) {
        const result = await supabase
          .from('teacher_profiles')
          .update({ phone })
          .eq('user_id', effectiveUserId);
        error = result.error;
      } else {
        const result = await supabase
          .from('teacher_profiles')
          .insert({ user_id: effectiveUserId, phone });
        error = result.error;
      }
      
      if (error) {
        throw error;
      }
      
      toast({ title: 'Salvato', description: 'Telefono aggiornato' });
      await fetchData();
    } catch (error: any) {
      console.error('Error saving phone:', error);
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const addAvailabilitySlot = () => {
    setAvailabilitySlots([...availabilitySlots, { day: "Lunedì", startTime: "09:00", endTime: "10:00" }]);
  };

  const removeAvailabilitySlot = (index: number) => {
    setAvailabilitySlots(availabilitySlots.filter((_, i) => i !== index));
  };

  const updateAvailabilitySlot = (index: number, field: keyof AvailabilitySlot, value: string) => {
    const updated = [...availabilitySlots];
    updated[index] = { ...updated[index], [field]: value };
    setAvailabilitySlots(updated);
  };

  const handleSaveAvailability = async () => {
    setIsSaving(true);
    try {
      const availabilityData = availabilitySlots.map(slot => ({
        day: slot.day,
        startTime: slot.startTime,
        endTime: slot.endTime
      }));
      
      let error;
      if (teacherProfile) {
        const result = await supabase
          .from('teacher_profiles')
          .update({ availability: availabilityData as unknown as any })
          .eq('user_id', user!.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('teacher_profiles')
          .insert([{ user_id: user!.id, availability: availabilityData as unknown as any }]);
        error = result.error;
      }
      
      if (error) {
        throw error;
      }
      
      toast({ title: 'Salvato', description: 'Disponibilità aggiornata' });
      setIsEditingAvailability(false);
      await fetchData();
    } catch (error: any) {
      console.error('Error saving availability:', error);
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEditAvailability = () => {
    setAvailabilitySlots(teacherProfile?.availability || []);
    setIsEditingAvailability(false);
  };

  const getDateLabel = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    if (dateStr === today) return 'Oggi';
    if (dateStr === tomorrow) return 'Domani';
    return new Date(dateStr).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isTeacher) return null;

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
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-3 border-b">
                  <h4 className="font-semibold">Notifiche</h4>
                  {unreadCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={markAllNotificationsAsRead}
                      className="text-xs h-7"
                    >
                      <CheckCheck className="w-3 h-3 mr-1" />
                      Segna tutte lette
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-80">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      Nessuna notifica
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notifications.map(notification => (
                        <div
                          key={notification.id}
                          className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                            !notification.is_read ? 'bg-primary/5' : ''
                          }`}
                          onClick={() => {
                            if (!notification.is_read) {
                              markNotificationAsRead(notification.id);
                            }
                            if (notification.metadata?.group_id) {
                              navigate(`/insegnante/gruppo/${notification.metadata.group_id}`);
                              setNotificationsOpen(false);
                            }
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                              !notification.is_read ? 'bg-primary' : 'bg-transparent'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{notification.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(notification.created_at).toLocaleDateString('it-IT', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            {!notification.is_read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markNotificationAsRead(notification.id);
                                }}
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            {isAdmin && !isImpersonating && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin">
                  <Shield className="w-4 h-4 mr-2" />
                  Admin
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-tech-teal" />
            Dashboard Insegnante
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci i tuoi corsi, gruppi e studenti
          </p>
          <Button asChild className="mt-3" variant="default">
            <Link to="/insegnante/valutazioni">
              <Award className="w-4 h-4 mr-2" />
              Valuta Compiti
            </Link>
          </Button>
        </div>

        {/* Statistics Section */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* Attendance by Group */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Presenze per Gruppo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : groupStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun dato disponibile</p>
              ) : (
                <div className="space-y-4">
                  {groupStats.map(stat => (
                    <div key={stat.groupId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{stat.groupTitle}</span>
                        <span className={stat.attendanceRate >= 80 ? 'text-green-600' : stat.attendanceRate >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                          {stat.attendanceRate}%
                        </span>
                      </div>
                      <Progress 
                        value={stat.attendanceRate} 
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        {stat.totalStudents} studenti • {stat.totalLessons} lezioni
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Student Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Attività Studenti
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Top Students */}
                  {topStudents.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium flex items-center gap-1 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        Più Attivi
                      </h4>
                      <div className="space-y-2">
                        {topStudents.map((s, i) => (
                          <div key={s.studentId} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="w-5 h-5 p-0 flex items-center justify-center text-xs">
                                {i + 1}
                              </Badge>
                              <button
                                onClick={() => navigate(`/insegnante/studente/${s.studentId}`)}
                                className="hover:text-primary hover:underline"
                              >
                                {s.studentName}
                              </button>
                            </div>
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                              {s.attendanceRate}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Low Attendance Alert */}
                  {lowAttendanceStudents.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium flex items-center gap-1 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Attenzione ({"<"}70%)
                      </h4>
                      <div className="space-y-2">
                        {lowAttendanceStudents.map(s => (
                          <div key={s.studentId} className="flex items-center justify-between text-sm">
                            <button
                              onClick={() => navigate(`/insegnante/studente/${s.studentId}`)}
                              className="hover:text-primary hover:underline"
                            >
                              {s.studentName}
                            </button>
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">
                              {s.attendanceRate}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {topStudents.length === 0 && lowAttendanceStudents.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nessun dato disponibile</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Lessons */}
        {upcomingLessons.length > 0 && (
          <Card className="mb-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                Lezioni in Arrivo (prossimi 7 giorni)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingLessons.map(lesson => (
                  <div 
                    key={lesson.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/insegnante/gruppo/${lesson.group_id}`)}
                  >
                    <div className="flex flex-col items-center justify-center bg-primary/10 rounded-lg p-2 min-w-[60px]">
                      <span className="text-xs font-medium text-primary">
                        {getDateLabel(lesson.lesson_date)}
                      </span>
                      {lesson.lesson_date !== new Date().toISOString().split('T')[0] && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(lesson.lesson_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{lesson.group_title}</p>
                      <p className="text-xs text-muted-foreground">
                        Lezione {lesson.lesson_number}
                        {lesson.lesson_title && ` • ${lesson.lesson_title}`}
                        {(lesson.lesson_time || lesson.group_lesson_time) && ` • ${(lesson.lesson_time || lesson.group_lesson_time)?.substring(0, 5)}`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profilo" className="gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profilo</span>
            </TabsTrigger>
            <TabsTrigger value="corsi" className="gap-2">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Corsi</span>
            </TabsTrigger>
            <TabsTrigger value="studenti" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Studenti</span>
            </TabsTrigger>
            <TabsTrigger value="gruppi" className="gap-2">
              <UsersRound className="w-4 h-4" />
              <span className="hidden sm:inline">Gruppi</span>
            </TabsTrigger>
          </TabsList>

          {/* Profilo Tab */}
          <TabsContent value="profilo" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Informazioni Personali
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      Nome Completo
                    </label>
                    <Input value={profile?.full_name || ""} disabled />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      Email
                    </label>
                    <Input value={profile?.email || ""} disabled />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      Telefono
                    </label>
                    <div className="flex gap-2">
                      <Input 
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value)} 
                        placeholder="+39 xxx xxx xxxx"
                      />
                      <Button onClick={handleSavePhone} disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Salvando...
                          </>
                        ) : 'Salva'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    Corsi Abilitati
                  </h4>
                  {assignedCourses.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nessun corso assegnato</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {assignedCourses.map(course => (
                        <Badge key={course.id} variant="secondary" className="text-sm">
                          {course.emoji} {course.title}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      Orari di Disponibilità
                    </h4>
                    {!isEditingAvailability ? (
                      <Button variant="outline" size="sm" onClick={() => setIsEditingAvailability(true)}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Modifica
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={cancelEditAvailability}>
                          Annulla
                        </Button>
                        <Button size="sm" onClick={handleSaveAvailability} disabled={isSaving}>
                          {isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Salvando...
                            </>
                          ) : 'Salva'}
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {isEditingAvailability ? (
                    <div className="space-y-3">
                      {availabilitySlots.map((slot, index) => (
                        <div key={index} className="flex items-center gap-2 flex-wrap">
                          <Select value={slot.day} onValueChange={(v) => updateAvailabilitySlot(index, 'day', v)}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS.map(d => (
                                <SelectItem key={d} value={d}>{d}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={slot.startTime} onValueChange={(v) => updateAvailabilitySlot(index, 'startTime', v)}>
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIMES.map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-muted-foreground">-</span>
                          <Select value={slot.endTime} onValueChange={(v) => updateAvailabilitySlot(index, 'endTime', v)}>
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIMES.map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" onClick={() => removeAvailabilitySlot(index)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={addAvailabilitySlot}>
                        <Plus className="w-4 h-4 mr-2" />
                        Aggiungi Orario
                      </Button>
                    </div>
                  ) : (
                    teacherProfile?.availability && teacherProfile.availability.length > 0 ? (
                      <div className="space-y-2">
                        {teacherProfile.availability.map((slot, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <Badge variant="secondary" className="min-w-20">{slot.day}</Badge>
                            <span className="text-muted-foreground">{slot.startTime} - {slot.endTime}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Nessun orario configurato. Clicca "Modifica" per aggiungere i tuoi orari.
                      </p>
                    )
                  )}
                </div>

                {/* Useful Links Section */}
                {teacherLinks.length > 0 && (
                  <div className="border-t pt-6">
                    <h4 className="font-medium mb-4 flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-muted-foreground" />
                      Link Utili
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {teacherLinks.map(link => {
                        const IconComponent = getIconComponent(link.icon);
                        return (
                          <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 hover:border-primary/50 transition-colors group"
                          >
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                              <IconComponent className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{link.title}</p>
                              {link.description && (
                                <p className="text-xs text-muted-foreground truncate">{link.description}</p>
                              )}
                            </div>
                            <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Corsi Tab */}
          <TabsContent value="corsi" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Corsi Assegnati</CardTitle>
              </CardHeader>
              <CardContent>
                {assignedCourses.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nessun corso assegnato</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Slug</TableHead>
                        <TableHead>Titolo</TableHead>
                        <TableHead className="text-center">Lezioni</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignedCourses.map(course => (
                        <TableRow 
                          key={course.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/insegnante/corso/${course.slug}`)}
                        >
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {course.slug}
                          </TableCell>
                          <TableCell>
                            <span className="mr-2">{course.emoji}</span>
                            {course.title}
                          </TableCell>
                          <TableCell className="text-center">{course.total_lessons}</TableCell>
                          <TableCell>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Studenti Tab */}
          <TabsContent value="studenti" className="space-y-6">
            <TeacherStudentsList groups={groups} />
          </TabsContent>

          <TabsContent value="gruppi" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle>Gruppi Assegnati</CardTitle>
                  <div className="flex items-center gap-3">
                    <Select value={groupStatusFilter} onValueChange={setGroupStatusFilter}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Stato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti</SelectItem>
                        <SelectItem value="active">Attivi</SelectItem>
                        <SelectItem value="archived">Archiviati</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={groupSortBy} onValueChange={setGroupSortBy}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Ordina per" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="title">Nome</SelectItem>
                        <SelectItem value="progress">Progresso</SelectItem>
                        <SelectItem value="students">Studenti</SelectItem>
                        <SelectItem value="start_date">Data inizio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const filtered = groups
                    .filter(g => groupStatusFilter === 'all' || g.status === groupStatusFilter)
                    .sort((a, b) => {
                      switch (groupSortBy) {
                        case 'progress':
                          return ((b.lessons_completed || 0) / (b.max_lessons || 1)) - ((a.lessons_completed || 0) / (a.max_lessons || 1));
                        case 'students':
                          return (b.student_count || 0) - (a.student_count || 0);
                        case 'start_date':
                          return (b.start_date || '').localeCompare(a.start_date || '');
                        default:
                          return a.title.localeCompare(b.title);
                      }
                    });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <UsersRound className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          {groups.length === 0 ? 'Nessun gruppo assegnato' : 'Nessun gruppo con questo filtro'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {filtered.map(group => {
                        const progressPercent = group.max_lessons > 0 
                          ? Math.round(((group.lessons_completed || 0) / group.max_lessons) * 100) 
                          : 0;
                        
                        return (
                          <div
                            key={group.id}
                            className="flex flex-col gap-3 p-4 rounded-lg border bg-background hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => navigate(`/insegnante/gruppo/${group.id}`)}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-2xl">{group.course_emoji}</span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold truncate">{group.title}</h3>
                                    {group.status === 'archived' ? (
                                      <Badge variant="secondary">Archiviato</Badge>
                                    ) : (
                                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Attivo</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {group.course_title}
                                    {group.start_date && ` · Dal ${new Date(group.start_date).toLocaleDateString('it-IT')}`}
                                    {group.lesson_time && ` · ${group.lesson_time.substring(0, 5)}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Users className="w-4 h-4" />
                                  {group.student_count}
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </div>
                            {/* Progress Bar */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Progresso corso</span>
                                <span className="font-medium">
                                  {group.lessons_completed || 0}/{group.max_lessons} lezioni ({progressPercent}%)
                                </span>
                              </div>
                              <Progress value={progressPercent} className="h-2" />
                            </div>
                            {group.last_lesson_title && (
                              <p className="text-xs text-muted-foreground">
                                Ultima lezione: {group.last_lesson_title}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// Component for students list
function TeacherStudentsList({ groups }: { groups: StudentGroup[] }) {
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, [groups]);

  const fetchStudents = async () => {
    if (groups.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      const groupIds = groups.map(g => g.id);
      const { data: groupStudentsData } = await supabase
        .from('group_students')
        .select(`
          student_id,
          group_id,
          profiles!inner(id, full_name, email, avatar_id, total_points)
        `)
        .in('group_id', groupIds);

      if (groupStudentsData) {
        // Deduplicate students and add group info
        const studentMap = new Map();
        groupStudentsData.forEach((gs: any) => {
          const group = groups.find(g => g.id === gs.group_id);
          if (!studentMap.has(gs.student_id)) {
            studentMap.set(gs.student_id, {
              ...gs.profiles,
              groups: [{ id: group?.id, title: group?.title, course_title: group?.course_title }]
            });
          } else {
            studentMap.get(gs.student_id).groups.push({
              id: group?.id,
              title: group?.title,
              course_title: group?.course_title
            });
          }
        });
        setStudents(Array.from(studentMap.values()));
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>I Miei Studenti</CardTitle>
      </CardHeader>
      <CardContent>
        {students.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nessuno studente nei tuoi gruppi</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Gruppi</TableHead>
                <TableHead className="text-center">Punti</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map(student => (
                <TableRow 
                  key={student.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/insegnante/studente/${student.id}`)}
                >
                  <TableCell className="font-medium">{student.full_name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {student.groups.map((g: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {g.title}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{student.total_points}</Badge>
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
