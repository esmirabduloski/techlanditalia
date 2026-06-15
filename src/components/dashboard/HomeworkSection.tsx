import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, CheckCircle2, Clock, AlertCircle, Loader2, Paperclip, Download, AlertTriangle, CalendarClock, MessageSquare, ArrowUpDown, Filter, ChevronDown } from "lucide-react";

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
  due_date: string | null;
  lesson_title: string;
  course_title: string;
  course_emoji: string;
  course_id: string;
  is_submitted: boolean;
  submission_status: string | null;
  teacher_feedback: string | null;
  grade: number | null;
  points_earned: number;
  feedback_at: string | null;
}

type FilterStatus = "all" | "pending" | "graded" | "expired" | "in_review";
type SortOption = "deadline" | "course" | "status" | "points";

const INITIAL_HOMEWORK_COUNT = 4;

export function HomeworkSection() {
  const { user } = useAuth();
  const [homework, setHomework] = useState<HomeworkWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortOption>("deadline");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (user) {
      fetchHomework();
    }
  }, [user]);

  const fetchHomework = async () => {
    if (!user) return;

    try {
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

      const { data: studentGroups } = await supabase
        .from("group_students")
        .select("group_id")
        .eq("student_id", user.id);

      const groupIds = studentGroups?.map((g) => g.group_id) || [];

      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, title, course_id, lesson_number, courses(title, emoji)")
        .in("course_id", courseIds);

      if (!lessons || lessons.length === 0) {
        setHomework([]);
        setIsLoading(false);
        return;
      }

      let targetLessonIds: string[] = lessons.map((l) => l.id);

      // Find the last scheduled lesson for each group and filter to only that
      if (groupIds.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: lastSchedules } = await supabase
          .from("group_lesson_schedule")
          .select("group_id, lesson_number")
          .in("group_id", groupIds)
          .lte("lesson_date", todayStr)
          .order("lesson_date", { ascending: false })
          .limit(groupIds.length);

        if (lastSchedules && lastSchedules.length > 0) {
          // Get course_id for each group to map lesson_number -> lesson_id
          const { data: groupsInfo } = await supabase
            .from("student_groups")
            .select("id, course_id")
            .in("id", groupIds);

          const groupCourseMap = new Map(
            groupsInfo?.map((g) => [g.id, g.course_id]) || []
          );

          const lastLessonIds: string[] = [];
          for (const schedule of lastSchedules) {
            const courseId = groupCourseMap.get(schedule.group_id);
            if (courseId) {
              const lesson = lessons.find(
                (l) => l.course_id === courseId && (l as any).lesson_number === schedule.lesson_number
              );
              if (lesson) lastLessonIds.push(lesson.id);
            }
          }

          if (lastLessonIds.length > 0) {
            targetLessonIds = lastLessonIds;
          }
        }
      }

      // Show only homework for the last lesson(s)
      const { data: homeworkData } = await supabase
        .from("homework")
        .select("*")
        .in("lesson_id", targetLessonIds);

      if (!homeworkData) {
        setHomework([]);
        setIsLoading(false);
        return;
      }

      let groupDeadlinesMap = new Map<string, string>();
      if (groupIds.length > 0) {
        const { data: groupDeadlines } = await supabase
          .from("homework_group_deadlines")
          .select("homework_id, due_date")
          .in("group_id", groupIds);
        
        groupDeadlinesMap = new Map(
          groupDeadlines?.map((d) => [d.homework_id, d.due_date]) || []
        );
      }

      // Fetch submissions WITH feedback data
      const { data: submissions } = await supabase
        .from("homework_submissions")
        .select("homework_id, status, teacher_feedback, grade, points_earned, feedback_at")
        .eq("student_id", user.id);

      const submissionMap = new Map(
        submissions?.map((s) => [s.homework_id, s]) || []
      );

      const homeworkWithDetails: HomeworkWithDetails[] = homeworkData.map((h) => {
        const lesson = lessons.find((l) => l.id === h.lesson_id);
        const course = lesson?.courses as { title: string; emoji: string } | null;
        const attachments = Array.isArray(h.attachments) ? (h.attachments as unknown as Attachment[]) : [];
        const effectiveDueDate = groupDeadlinesMap.get(h.id) || h.due_date;
        const submission = submissionMap.get(h.id);
        
        return {
          id: h.id,
          title: h.title,
          description: h.description,
          instructions: h.instructions,
          points_reward: h.points_reward,
          attachments,
          due_date: effectiveDueDate,
          lesson_title: lesson?.title || "Lezione",
          course_title: course?.title || "Corso",
          course_emoji: course?.emoji || "📚",
          course_id: lesson?.course_id || "",
          is_submitted: !!submission,
          submission_status: submission?.status || null,
          teacher_feedback: submission?.teacher_feedback || null,
          grade: submission?.grade ?? null,
          points_earned: submission?.points_earned || 0,
          feedback_at: submission?.feedback_at || null,
        };
      });

      setHomework(homeworkWithDetails);
    } catch (error) {
      console.error("Error fetching homework:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEffectiveStatus = (hw: HomeworkWithDetails): FilterStatus => {
    if (hw.submission_status === "graded" || hw.submission_status === "approved") return "graded";
    if (hw.is_submitted && hw.submission_status === "pending") return "in_review";
    if (!hw.is_submitted && hw.due_date && new Date(hw.due_date) < new Date()) return "expired";
    return "pending";
  };

  const filteredAndSorted = useMemo(() => {
    let filtered = homework;

    if (filterStatus !== "all") {
      filtered = filtered.filter((hw) => getEffectiveStatus(hw) === filterStatus);
    }

    const sorted = [...filtered];
    switch (sortBy) {
      case "deadline":
        sorted.sort((a, b) => {
          // Non-submitted first
          if (a.is_submitted !== b.is_submitted) return a.is_submitted ? 1 : -1;
          if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          if (a.due_date) return -1;
          if (b.due_date) return 1;
          return 0;
        });
        break;
      case "course":
        sorted.sort((a, b) => a.course_title.localeCompare(b.course_title));
        break;
      case "status":
        const statusOrder: Record<string, number> = { expired: 0, pending: 1, in_review: 2, graded: 3 };
        sorted.sort((a, b) => (statusOrder[getEffectiveStatus(a)] ?? 4) - (statusOrder[getEffectiveStatus(b)] ?? 4));
        break;
      case "points":
        sorted.sort((a, b) => b.points_reward - a.points_reward);
        break;
    }

    return sorted;
  }, [homework, filterStatus, sortBy]);

  const statusCounts = useMemo(() => {
    const counts = { all: homework.length, pending: 0, graded: 0, expired: 0, in_review: 0 };
    homework.forEach((hw) => { counts[getEffectiveStatus(hw)]++; });
    return counts;
  }, [homework]);

  const getDeadlineBadge = (hw: HomeworkWithDetails) => {
    if (!hw.due_date || hw.is_submitted) return null;
    const now = new Date();
    const dueDate = new Date(hw.due_date);
    const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntilDue <= 24) {
      return (
        <Badge className="bg-red-500 text-white text-xs">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Scade oggi!
        </Badge>
      );
    }
    if (hoursUntilDue <= 48) {
      return (
        <Badge className="bg-orange-500 text-white text-xs">
          <CalendarClock className="w-3 h-3 mr-1" />
          Scade domani
        </Badge>
      );
    }
    return null;
  };

  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (hw: HomeworkWithDetails) => {
    const status = getEffectiveStatus(hw);
    switch (status) {
      case "expired":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
            <Clock className="w-3 h-3 mr-1" />
            Da fare
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
            <Clock className="w-3 h-3 mr-1" />
            Da fare
          </Badge>
        );
      case "in_review":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">
            <Clock className="w-3 h-3 mr-1" />
            In revisione
          </Badge>
        );
      case "graded":
        return (
          <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Valutato
          </Badge>
        );
      default:
        return null;
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
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          I Tuoi Compiti
        </h2>

        {homework.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
                <SelectTrigger className="h-8 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti ({statusCounts.all})</SelectItem>
                  <SelectItem value="pending">Da fare ({statusCounts.pending})</SelectItem>
                  <SelectItem value="in_review">In revisione ({statusCounts.in_review})</SelectItem>
                  <SelectItem value="graded">Valutati ({statusCounts.graded})</SelectItem>
                  <SelectItem value="expired">Scaduti ({statusCounts.expired})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deadline">Scadenza</SelectItem>
                  <SelectItem value="course">Corso</SelectItem>
                  <SelectItem value="status">Stato</SelectItem>
                  <SelectItem value="points">Punti</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {homework.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Non hai compiti assegnati al momento
            </p>
          </CardContent>
        </Card>
      ) : filteredAndSorted.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">Nessun compito con questo filtro</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(showAll ? filteredAndSorted : filteredAndSorted.slice(0, INITIAL_HOMEWORK_COUNT)).map((hw) => {
            const deadlineBadge = getDeadlineBadge(hw);
            const effectiveStatus = getEffectiveStatus(hw);
            const isUrgent = !hw.is_submitted && hw.due_date && (new Date(hw.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60) <= 48;
            
            const cardBg = effectiveStatus === "graded"
              ? "to-green-50/30 border-green-200/50"
              : isUrgent
              ? "to-red-50/50 border-red-300/50"
              : effectiveStatus === "pending"
              ? "to-amber-50/30 border-amber-200/50"
              : "to-blue-50/30 border-blue-200/50";

            return (
              <Card key={hw.id} className={`bg-gradient-to-r from-card ${cardBg}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{hw.course_emoji}</span>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                          {hw.title}
                          {deadlineBadge}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {hw.course_title} · {hw.lesson_title}
                          {hw.due_date && (
                            <span className="ml-2 text-muted-foreground">
                              📅 Scadenza: {formatDueDate(hw.due_date)}
                            </span>
                          )}
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

                  {/* Feedback preview */}
                  {hw.teacher_feedback && (
                    <div className="mb-3 rounded-lg bg-muted/50 border border-border/50 p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-medium text-foreground">Feedback insegnante</span>
                        {hw.grade != null && (
                          <Badge variant="secondary" className="text-xs ml-auto">
                            Voto: {hw.grade}/100
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground italic line-clamp-2">
                        "{hw.teacher_feedback}"
                      </p>
                      {hw.points_earned > 0 && (
                        <p className="text-xs text-primary mt-1.5 font-medium">
                          +{hw.points_earned} punti guadagnati
                        </p>
                      )}
                    </div>
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
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/area-riservata/compito/${hw.id}`}>
                          Dettagli
                        </Link>
                      </Button>
                      {!hw.is_submitted && (
                        <Button size="sm" variant="default" asChild>
                          <Link to={`/area-riservata/corso/${hw.course_id}`}>
                            Vai al corso
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!showAll && filteredAndSorted.length > INITIAL_HOMEWORK_COUNT && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setShowAll(true)}
                className="gap-2"
              >
                <ChevronDown className="w-4 h-4" />
                Vedi Altri ({filteredAndSorted.length - INITIAL_HOMEWORK_COUNT} rimanenti)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
