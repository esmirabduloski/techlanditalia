import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Users, Filter, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface LessonReport {
  id: string;
  group_id: string;
  lesson_number: number;
  teacher_id: string;
  topics_covered: string;
  topics_not_covered: string;
  students_needing_support: string[];
  support_notes: string;
  created_at: string;
  updated_at: string;
  group_title: string;
  course_title: string;
  course_emoji: string;
  teacher_name: string;
  support_student_names: string[];
}

interface GroupOption {
  id: string;
  title: string;
  course_emoji: string;
}

interface TeacherOption {
  id: string;
  full_name: string;
}

export default function AdminLessonReports() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState<LessonReport[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [filterTeacher, setFilterTeacher] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate("/admin/login");
    }
  }, [user, isAdmin, authLoading]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchData();
    }
  }, [user, isAdmin]);

  const fetchData = async () => {
    try {
      // Fetch all reports
      const { data: reportsData } = await supabase
        .from("lesson_reports")
        .select("*")
        .order("updated_at", { ascending: false });

      if (!reportsData || reportsData.length === 0) {
        setReports([]);
        setIsLoading(false);
        return;
      }

      // Get unique group IDs and teacher IDs
      const groupIds = [...new Set(reportsData.map(r => r.group_id))];
      const teacherIds = [...new Set(reportsData.map(r => r.teacher_id))];

      // Fetch groups with course info
      const { data: groupsData } = await supabase
        .from("student_groups")
        .select("id, title, course_id, courses!inner(title, emoji)")
        .in("id", groupIds);

      // Fetch teacher profiles
      const { data: teacherProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", teacherIds);

      // Collect all student IDs needing support
      const allStudentIds = [...new Set(reportsData.flatMap(r => (r.students_needing_support as string[]) || []))];
      let studentNameMap: Record<string, string> = {};
      if (allStudentIds.length > 0) {
        const { data: studentProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", allStudentIds);
        studentProfiles?.forEach(s => { studentNameMap[s.id] = s.full_name; });
      }

      const groupMap: Record<string, any> = {};
      groupsData?.forEach(g => { groupMap[g.id] = g; });
      const teacherMap: Record<string, string> = {};
      teacherProfiles?.forEach(t => { teacherMap[t.id] = t.full_name; });

      const mapped: LessonReport[] = reportsData.map(r => {
        const group = groupMap[r.group_id];
        return {
          ...r,
          students_needing_support: (r.students_needing_support as string[]) || [],
          group_title: group?.title || "—",
          course_title: (group?.courses as any)?.title || "—",
          course_emoji: (group?.courses as any)?.emoji || "💻",
          teacher_name: teacherMap[r.teacher_id] || "—",
          support_student_names: ((r.students_needing_support as string[]) || []).map(id => studentNameMap[id] || id),
        };
      });

      setReports(mapped);

      // Build filter options from all groups
      const { data: allGroups } = await supabase
        .from("student_groups")
        .select("id, title, courses!inner(emoji)")
        .order("title");
      setGroups((allGroups || []).map((g: any) => ({ id: g.id, title: g.title, course_emoji: g.courses?.emoji || "💻" })));

      // Build teacher filter from user_roles
      const { data: teacherRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "teacher");
      if (teacherRoles && teacherRoles.length > 0) {
        const { data: tProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", teacherRoles.map(t => t.user_id))
          .order("full_name");
        setTeachers((tProfiles || []).map(t => ({ id: t.id, full_name: t.full_name })));
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredReports = reports.filter(r => {
    if (filterGroup !== "all" && r.group_id !== filterGroup) return false;
    if (filterTeacher !== "all" && r.teacher_id !== filterTeacher) return false;
    return true;
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <span className="text-2xl font-bold">
            <span className="text-primary">TECH</span>
            <span className="text-tech-teal">LAND</span>
          </span>
          <Badge variant="destructive">Admin</Badge>
        </div>
      </header>
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <FileText className="w-6 h-6" />
          Report Lezioni
        </h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="w-64">
            <Select value={filterGroup} onValueChange={setFilterGroup}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <SelectValue placeholder="Filtra per gruppo" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i gruppi</SelectItem>
                {groups.map(g => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.course_emoji} {g.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-64">
            <Select value={filterTeacher} onValueChange={setFilterTeacher}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <SelectValue placeholder="Filtra per insegnante" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli insegnanti</SelectItem>
                {teachers.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(filterGroup !== "all" || filterTeacher !== "all") && (
            <Badge variant="secondary" className="self-center">
              {filteredReports.length} report trovati
            </Badge>
          )}
        </div>

        {/* Reports */}
        {filteredReports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nessun report disponibile</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredReports.map(report => (
              <Card key={report.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span>{report.course_emoji}</span>
                      <span>{report.group_title}</span>
                      <Badge variant="outline">Lezione {report.lesson_number}</Badge>
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary">{report.teacher_name}</Badge>
                      <span>{format(new Date(report.updated_at), "d MMM yyyy HH:mm", { locale: it })}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.topics_covered && (
                    <div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">✅ Argomenti trattati</p>
                      <p className="text-sm whitespace-pre-wrap bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">{report.topics_covered}</p>
                    </div>
                  )}
                  {report.topics_not_covered && (
                    <div>
                      <p className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">⏭️ Argomenti non trattati</p>
                      <p className="text-sm whitespace-pre-wrap bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg">{report.topics_not_covered}</p>
                    </div>
                  )}
                  {report.support_student_names.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        Studenti che necessitano supporto
                      </p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {report.support_student_names.map((name, i) => (
                          <Badge key={i} variant="destructive" className="text-xs">{name}</Badge>
                        ))}
                      </div>
                      {report.support_notes && (
                        <p className="text-sm whitespace-pre-wrap bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">{report.support_notes}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
