import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, ArrowLeft, User, BookOpen, Users, MessageCircle, Mail, Calendar
} from "lucide-react";
import { AvatarDisplay } from "@/components/gamification/AvatarSelector";
import { LevelBadge, getLevelFromPoints } from "@/components/gamification/LevelBadge";
import { StudentCommentsSection } from "@/components/dashboard/StudentCommentsSection";

interface StudentProfile {
  id: string;
  full_name: string;
  email: string | null;
  avatar_id: number;
  total_points: number;
  created_at: string;
  parent_id: string | null;
}

interface Parent {
  id: string;
  full_name: string;
  email: string | null;
}

interface Enrollment {
  id: string;
  course_id: string;
  status: string;
  course_title: string;
  course_emoji: string;
}

interface GroupMembership {
  id: string;
  group_title: string;
  course_title: string;
}

export default function TeacherStudentDetail() {
  const { studentId } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [groups, setGroups] = useState<GroupMembership[]>([]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    } else if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, studentId]);

  const fetchData = async () => {
    try {
      // Verify teacher has access to this student (student is in one of their groups)
      const { data: teacherGroups } = await supabase
        .from('student_groups')
        .select('id')
        .eq('teacher_id', user!.id);

      if (!teacherGroups || teacherGroups.length === 0) {
        navigate('/insegnante');
        return;
      }

      const { data: studentInGroup } = await supabase
        .from('group_students')
        .select('group_id')
        .eq('student_id', studentId)
        .in('group_id', teacherGroups.map(g => g.id))
        .limit(1);

      if (!studentInGroup || studentInGroup.length === 0) {
        navigate('/insegnante');
        return;
      }

      // Fetch student profile
      const { data: studentData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single();

      setStudent(studentData);

      // Fetch parent if exists
      if (studentData?.parent_id) {
        const { data: parentData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', studentData.parent_id)
          .single();
        
        setParent(parentData);
      }

      // Fetch enrollments with course info
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select(`
          id, course_id, status,
          courses!inner(title, emoji)
        `)
        .eq('student_id', studentId);

      if (enrollmentsData) {
        setEnrollments(enrollmentsData.map((e: any) => ({
          id: e.id,
          course_id: e.course_id,
          status: e.status,
          course_title: e.courses?.title,
          course_emoji: e.courses?.emoji
        })));
      }

      // Fetch group memberships
      const { data: groupsData } = await supabase
        .from('group_students')
        .select(`
          id, group_id,
          student_groups!inner(title, courses!inner(title))
        `)
        .eq('student_id', studentId);

      if (groupsData) {
        setGroups(groupsData.map((g: any) => ({
          id: g.id,
          group_title: g.student_groups?.title,
          course_title: g.student_groups?.courses?.title
        })));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!student) return null;

  const activeEnrollments = enrollments.filter(e => e.status === 'active');
  const completedEnrollments = enrollments.filter(e => e.status === 'completed');

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
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Indietro
        </Button>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Student Info */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <AvatarDisplay 
                    avatarId={student.avatar_id} 
                    level={getLevelFromPoints(student.total_points).level} 
                    size="lg" 
                  />
                  <h2 className="text-xl font-bold mt-4">{student.full_name}</h2>
                  <LevelBadge points={student.total_points} size="md" showProgress />
                  <div className="mt-4 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2 justify-center">
                      <Calendar className="w-4 h-4" />
                      Iscritto dal {new Date(student.created_at).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Parent Info */}
            {parent && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Genitore
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-medium">{parent.full_name}</p>
                    {parent.email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {parent.email}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Groups */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Gruppi
                </CardTitle>
              </CardHeader>
              <CardContent>
                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessun gruppo</p>
                ) : (
                  <div className="space-y-2">
                    {groups.map(g => (
                      <div key={g.id} className="p-2 bg-muted rounded">
                        <p className="font-medium text-sm">{g.group_title}</p>
                        <p className="text-xs text-muted-foreground">{g.course_title}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Courses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Corsi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeEnrollments.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-sm text-muted-foreground">Corsi Attivi</h4>
                    <div className="flex flex-wrap gap-2">
                      {activeEnrollments.map(e => (
                        <Badge key={e.id} variant="secondary">
                          {e.course_emoji} {e.course_title}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {completedEnrollments.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-sm text-muted-foreground">Corsi Completati</h4>
                    <div className="flex flex-wrap gap-2">
                      {completedEnrollments.map(e => (
                        <Badge key={e.id} variant="outline" className="text-green-600">
                          {e.course_emoji} {e.course_title}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {enrollments.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nessun corso</p>
                )}
              </CardContent>
            </Card>

            {/* Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Commenti
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StudentCommentsSection studentId={student.id} viewMode="parent" />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
