import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, CheckCircle2, Clock, AlertCircle, Loader2, Paperclip, Download } from "lucide-react";

interface Attachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface HomeworkWithDetails {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  points_reward: number;
  attachments: Attachment[];
  lesson_title: string;
  course_title: string;
  course_emoji: string;
  course_id: string;
  is_submitted: boolean;
  submission_status: string | null;
}

export function HomeworkSection() {
  const { user } = useAuth();
  const [homework, setHomework] = useState<HomeworkWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchHomework();
    }
  }, [user]);

  const fetchHomework = async () => {
    if (!user) return;

    try {
      // Get student's enrolled courses
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", user.id)
        .eq("status", "active");

      if (!enrollments || enrollments.length === 0) {
        setHomework([]);
        setIsLoading(false);
        return;
      }

      const courseIds = enrollments.map((e) => e.course_id);

      // Get lessons for enrolled courses
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, title, course_id, courses(title, emoji)")
        .in("course_id", courseIds);

      if (!lessons || lessons.length === 0) {
        setHomework([]);
        setIsLoading(false);
        return;
      }

      const lessonIds = lessons.map((l) => l.id);

      // Get homework for these lessons
      const { data: homeworkData } = await supabase
        .from("homework")
        .select("*")
        .in("lesson_id", lessonIds);

      if (!homeworkData) {
        setHomework([]);
        setIsLoading(false);
        return;
      }

      // Get student's submissions
      const { data: submissions } = await supabase
        .from("homework_submissions")
        .select("homework_id, status")
        .eq("student_id", user.id);

      const submissionMap = new Map(
        submissions?.map((s) => [s.homework_id, s.status]) || []
      );

      // Combine data
      const homeworkWithDetails: HomeworkWithDetails[] = homeworkData.map((h) => {
        const lesson = lessons.find((l) => l.id === h.lesson_id);
        const course = lesson?.courses as { title: string; emoji: string } | null;
        const attachments = Array.isArray(h.attachments) ? (h.attachments as unknown as Attachment[]) : [];
        
        return {
          id: h.id,
          title: h.title,
          description: h.description,
          instructions: h.instructions,
          points_reward: h.points_reward,
          attachments,
          lesson_title: lesson?.title || "Lezione",
          course_title: course?.title || "Corso",
          course_emoji: course?.emoji || "📚",
          course_id: lesson?.course_id || "",
          is_submitted: submissionMap.has(h.id),
          submission_status: submissionMap.get(h.id) || null,
        };
      });

      // Sort: pending first, then by course
      homeworkWithDetails.sort((a, b) => {
        if (a.is_submitted !== b.is_submitted) {
          return a.is_submitted ? 1 : -1;
        }
        return a.course_title.localeCompare(b.course_title);
      });

      setHomework(homeworkWithDetails);
    } catch (error) {
      console.error("Error fetching homework:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (hw: HomeworkWithDetails) => {
    if (!hw.is_submitted) {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
          <Clock className="w-3 h-3 mr-1" />
          Da fare
        </Badge>
      );
    }
    if (hw.submission_status === "approved") {
      return (
        <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Approvato
        </Badge>
      );
    }
    if (hw.submission_status === "pending") {
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">
          <Clock className="w-3 h-3 mr-1" />
          In revisione
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
        <AlertCircle className="w-3 h-3 mr-1" />
        Da rivedere
      </Badge>
    );
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

  const pendingHomework = homework.filter((h) => !h.is_submitted);
  const completedHomework = homework.filter((h) => h.is_submitted);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-primary" />
        I Tuoi Compiti
      </h2>

      {homework.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Non hai compiti assegnati al momento
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingHomework.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Da completare ({pendingHomework.length})
              </h3>
              {pendingHomework.map((hw) => (
                <Card key={hw.id} className="border-amber-200/50 bg-gradient-to-r from-card to-amber-50/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{hw.course_emoji}</span>
                        <div>
                          <CardTitle className="text-base">{hw.title}</CardTitle>
                          <CardDescription className="text-xs">
                            {hw.course_title} · {hw.lesson_title}
                          </CardDescription>
                        </div>
                      </div>
                      {getStatusBadge(hw)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {hw.description && (
                      <p className="text-sm text-muted-foreground mb-3">{hw.description}</p>
                    )}
                    {/* Attachments */}
                    {hw.attachments && hw.attachments.length > 0 && (
                      <div className="mb-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          Materiali allegati
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {hw.attachments.map((att, idx) => (
                            <a
                              key={idx}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs hover:bg-muted/80 transition-colors"
                            >
                              <Download className="w-3 h-3" />
                              {att.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        🏆 {hw.points_reward} punti
                      </span>
                      <Button size="sm" variant="default" asChild>
                        <Link to={`/area-riservata/corso/${hw.course_id}`}>
                          Vai al corso
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {completedHomework.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Completati ({completedHomework.length})
              </h3>
              {completedHomework.slice(0, 3).map((hw) => (
                <Card key={hw.id} className="border-border/50 bg-muted/30">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{hw.course_emoji}</span>
                        <div>
                          <CardTitle className="text-sm font-medium">{hw.title}</CardTitle>
                          <CardDescription className="text-xs">
                            {hw.course_title}
                          </CardDescription>
                        </div>
                      </div>
                      {getStatusBadge(hw)}
                    </div>
                  </CardHeader>
                </Card>
              ))}
              {completedHomework.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  + altri {completedHomework.length - 3} compiti completati
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
