import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen, MessageCircle } from "lucide-react";

interface TeacherInfo {
  name: string;
  bio: string | null;
  courses: { emoji: string; title: string }[];
  chatLinks: { groupTitle: string; link: string }[];
}

interface TeacherBioCardProps {
  studentId: string;
}

export function TeacherBioCard({ studentId }: TeacherBioCardProps) {
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;

    const fetchTeachers = async () => {
      try {
        // Get the student's groups with teacher info + mega chat link
        const { data: groups } = await supabase
          .from("group_students")
          .select("group_id, student_groups!inner(title, teacher_id, mega_chat_link, course_id, courses!inner(title, emoji))")
          .eq("student_id", studentId);

        if (!groups || groups.length === 0) {
          setIsLoading(false);
          return;
        }

        const teacherIds = [...new Set(
          groups
            .map((g: any) => g.student_groups?.teacher_id)
            .filter(Boolean)
        )];

        if (teacherIds.length === 0) {
          setIsLoading(false);
          return;
        }

        const [{ data: profiles }, { data: teacherProfiles }] = await Promise.all([
          supabase.from("profiles").select("id, full_name").in("id", teacherIds),
          supabase.from("teacher_profiles").select("user_id, bio").in("user_id", teacherIds),
        ]);

        const { data: teacherCourses } = await supabase
          .from("teacher_courses")
          .select("teacher_id, course_id, courses!inner(title, emoji)")
          .in("teacher_id", teacherIds);

        const teacherMap = new Map<string, TeacherInfo>();

        teacherIds.forEach((tid) => {
          const profile = profiles?.find((p) => p.id === tid);
          const tp = teacherProfiles?.find((t) => t.user_id === tid);
          const courses = (teacherCourses || [])
            .filter((tc: any) => tc.teacher_id === tid)
            .map((tc: any) => ({ emoji: tc.courses.emoji, title: tc.courses.title }));

          const chatLinks = groups
            .filter((g: any) => g.student_groups?.teacher_id === tid && g.student_groups?.mega_chat_link)
            .map((g: any) => ({
              groupTitle: g.student_groups.title,
              link: g.student_groups.mega_chat_link as string,
            }));

          if (profile) {
            teacherMap.set(tid as string, {
              name: profile.full_name,
              bio: (tp as any)?.bio || null,
              courses,
              chatLinks,
            });
          }
        });

        setTeachers(Array.from(teacherMap.values()));
      } catch (error) {
        console.error("Error fetching teacher info:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeachers();
  }, [studentId]);

  if (isLoading || teachers.length === 0) return null;

  return (
    <>
      {teachers.map((teacher, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Il Tuo Insegnante
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-semibold text-foreground">{teacher.name?.trim().toLowerCase() === "admin" ? "Esmir" : teacher.name}</p>
            {teacher.bio && (
              <p className="text-sm text-muted-foreground leading-relaxed">{teacher.bio}</p>
            )}
            {teacher.courses.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  Corsi
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {teacher.courses.map((c, j) => (
                    <Badge key={j} variant="secondary" className="text-xs">
                      {c.emoji} {c.title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {teacher.chatLinks.length > 0 && (
              <div className="space-y-2 pt-1">
                {teacher.chatLinks.map((cl, k) => (
                  <Button
                    key={k}
                    asChild
                    className="w-full"
                    size="sm"
                  >
                    <a href={cl.link} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Chatta con l'insegnante
                      {teacher.chatLinks.length > 1 && ` · ${cl.groupTitle}`}
                    </a>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </>
  );
}
