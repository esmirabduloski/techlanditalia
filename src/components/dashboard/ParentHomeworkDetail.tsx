import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ClipboardList, Clock, CheckCircle2, AlertTriangle, Star, ChevronDown, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, isPast, differenceInHours } from "date-fns";
import { it } from "date-fns/locale";

interface HomeworkDetail {
  id: string;
  title: string;
  description: string | null;
  lessonNumber: number;
  lessonTitle: string;
  courseTitle: string;
  courseEmoji: string;
  dueDate: string | null;
  status: 'pending' | 'submitted' | 'graded' | 'missing';
  submittedAt: string | null;
  grade: number | null;
  teacherFeedback: string | null;
  pointsReward: number;
  pointsEarned: number;
}

interface ParentHomeworkDetailProps {
  childId: string;
  childName: string;
  courseIds?: string[];
}

const INITIAL_COUNT = 6;

export function ParentHomeworkDetail({ childId, childName, courseIds }: ParentHomeworkDetailProps) {
  const [homeworks, setHomeworks] = useState<HomeworkDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (childId) fetchHomeworks();
  }, [childId, courseIds?.join(",")]);

  const fetchHomeworks = async () => {
    setIsLoading(true);
    try {
      // Get child's groups
      const { data: groupStudents } = await supabase
        .from("group_students")
        .select("group_id")
        .eq("student_id", childId);

      const groupIds = groupStudents?.map(gs => gs.group_id) || [];

      // Get groups with course info
      const { data: groups } = await supabase
        .from("student_groups")
        .select("id, course_id")
        .in("id", groupIds);

      let targetCourseIds = courseIds;
      if (!targetCourseIds || targetCourseIds.length === 0) {
        targetCourseIds = [...new Set(groups?.map(g => g.course_id) || [])];
      }

      if (targetCourseIds.length === 0) {
        setHomeworks([]);
        setIsLoading(false);
        return;
      }

      // Get lessons for these courses
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, lesson_number, title, course_id, course:course_id(title, emoji)")
        .in("course_id", targetCourseIds)
        .order("lesson_number");

      if (!lessons || lessons.length === 0) {
        setHomeworks([]);
        setIsLoading(false);
        return;
      }

      const lessonIds = lessons.map(l => l.id);

      // Get all homework
      const { data: homeworkData } = await supabase
        .from("homework")
        .select("id, title, description, lesson_id, points_reward")
        .in("lesson_id", lessonIds);

      if (!homeworkData || homeworkData.length === 0) {
        setHomeworks([]);
        setIsLoading(false);
        return;
      }

      const homeworkIds = homeworkData.map(h => h.id);

      // Get submissions
      const { data: submissions } = await supabase
        .from("homework_submissions")
        .select("homework_id, submitted_at, status, grade, teacher_feedback, points_earned")
        .eq("student_id", childId)
        .in("homework_id", homeworkIds);

      // Get group-specific deadlines
      const relevantGroupIds = groups?.filter(g => targetCourseIds!.includes(g.course_id)).map(g => g.id) || [];
      
      let deadlineMap = new Map<string, string>();
      if (relevantGroupIds.length > 0) {
        const { data: deadlines } = await supabase
          .from("homework_group_deadlines")
          .select("homework_id, due_date")
          .in("group_id", relevantGroupIds)
          .in("homework_id", homeworkIds);

        deadlines?.forEach(d => {
          deadlineMap.set(d.homework_id, d.due_date);
        });
      }

      // Get lesson schedule dates
      let lessonDateMap = new Map<string, string>();
      if (relevantGroupIds.length > 0) {
        const groupToCourse = new Map<string, string>();
        groups?.forEach(g => groupToCourse.set(g.id, g.course_id));

        const { data: schedule } = await supabase
          .from("group_lesson_schedule")
          .select("group_id, lesson_number, lesson_date")
          .in("group_id", relevantGroupIds);

        schedule?.forEach(s => {
          const cId = groupToCourse.get(s.group_id);
          if (cId) lessonDateMap.set(`${cId}-${s.lesson_number}`, s.lesson_date);
        });
      }

      // Build submission map
      const submissionMap = new Map<string, { submitted_at: string; status: string; grade: number | null; teacher_feedback: string | null; points_earned: number }>();
      submissions?.forEach(s => submissionMap.set(s.homework_id, s));

      // Build lesson map
      const lessonMap = new Map<string, any>();
      lessons.forEach(l => lessonMap.set(l.id, l));

      // Build detailed list
      const details: HomeworkDetail[] = homeworkData.map(hw => {
        const lesson = lessonMap.get(hw.lesson_id);
        const sub = submissionMap.get(hw.id);
        const dueDate = deadlineMap.get(hw.id) || null;
        const lessonDate = lesson ? lessonDateMap.get(`${lesson.course_id}-${lesson.lesson_number}`) : null;
        const isPastDeadline = dueDate ? isPast(new Date(dueDate)) : (lessonDate ? isPast(new Date(lessonDate)) : false);

        let status: HomeworkDetail['status'] = 'pending';
        if (sub) {
          status = sub.status === 'graded' ? 'graded' : 'submitted';
        } else if (isPastDeadline) {
          status = 'missing';
        }

        return {
          id: hw.id,
          title: hw.title,
          description: hw.description,
          lessonNumber: lesson?.lesson_number || 0,
          lessonTitle: lesson?.title || '',
          courseTitle: (lesson?.course as any)?.title || '',
          courseEmoji: (lesson?.course as any)?.emoji || '📚',
          dueDate,
          status,
          submittedAt: sub?.submitted_at || null,
          grade: sub?.grade ?? null,
          teacherFeedback: sub?.teacher_feedback || null,
          pointsReward: hw.points_reward,
          pointsEarned: sub?.points_earned || 0,
        };
      }).sort((a, b) => {
        // Sort: missing first, then pending, then submitted, then graded
        const order = { missing: 0, pending: 1, submitted: 2, graded: 3 };
        return order[a.status] - order[b.status] || a.lessonNumber - b.lessonNumber;
      });

      setHomeworks(details);
    } catch (error) {
      console.error("Error fetching homework details:", error);
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

  if (homeworks.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Compiti di {childName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">Nessun compito assegnato</p>
        </CardContent>
      </Card>
    );
  }

  const filtered = statusFilter === "all" ? homeworks : homeworks.filter(h => h.status === statusFilter);
  const displayed = showAll ? filtered : filtered.slice(0, INITIAL_COUNT);
  const hasMore = filtered.length > INITIAL_COUNT;

  const counts = {
    all: homeworks.length,
    pending: homeworks.filter(h => h.status === 'pending').length,
    submitted: homeworks.filter(h => h.status === 'submitted').length,
    graded: homeworks.filter(h => h.status === 'graded').length,
    missing: homeworks.filter(h => h.status === 'missing').length,
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Compiti di {childName}
          </CardTitle>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setShowAll(false); }}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti ({counts.all})</SelectItem>
              <SelectItem value="pending">In attesa ({counts.pending})</SelectItem>
              <SelectItem value="submitted">Consegnati ({counts.submitted})</SelectItem>
              <SelectItem value="graded">Valutati ({counts.graded})</SelectItem>
              <SelectItem value="missing">Mancanti ({counts.missing})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className={displayed.length > 4 ? "h-[400px]" : ""}>
          <div className="space-y-3">
            {displayed.map(hw => (
              <HomeworkCard key={hw.id} homework={hw} />
            ))}
          </div>
        </ScrollArea>

        {hasMore && !showAll && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowAll(true)} className="gap-2">
              <ChevronDown className="w-4 h-4" />
              Vedi tutti ({filtered.length - INITIAL_COUNT} rimanenti)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HomeworkCard({ homework }: { homework: HomeworkDetail }) {
  const statusConfig = {
    pending: { label: "In attesa", variant: "outline" as const, className: "border-yellow-500/50 text-yellow-600 bg-yellow-500/10", icon: Clock },
    submitted: { label: "Consegnato", variant: "outline" as const, className: "border-blue-500/50 text-blue-600 bg-blue-500/10", icon: CheckCircle2 },
    graded: { label: "Valutato", variant: "outline" as const, className: "border-green-500/50 text-green-600 bg-green-500/10", icon: Star },
    missing: { label: "Mancante", variant: "outline" as const, className: "border-destructive/50 text-destructive bg-destructive/10", icon: AlertTriangle },
  };

  const config = statusConfig[homework.status];
  const StatusIcon = config.icon;

  const isUrgent = homework.status === 'pending' && homework.dueDate && 
    differenceInHours(new Date(homework.dueDate), new Date()) <= 48 && 
    differenceInHours(new Date(homework.dueDate), new Date()) > 0;

  return (
    <div className={cn(
      "border rounded-lg p-4 transition-colors",
      homework.status === 'missing' && "border-destructive/30 bg-destructive/5",
      isUrgent && "border-yellow-500/50 bg-yellow-500/5",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="secondary" className="text-xs shrink-0">
              {homework.courseEmoji} L{homework.lessonNumber}
            </Badge>
            <h4 className="font-medium text-sm truncate">{homework.title}</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{homework.lessonTitle}</p>
          
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            {homework.dueDate && (
              <span className={cn("flex items-center gap-1", isUrgent && "text-yellow-600 font-medium")}>
                <Clock className="w-3 h-3" />
                Scadenza: {format(new Date(homework.dueDate), "d MMM yyyy, HH:mm", { locale: it })}
                {isUrgent && " ⚠️"}
              </span>
            )}
            {homework.submittedAt && (
              <span className="flex items-center gap-1 text-blue-600">
                <CheckCircle2 className="w-3 h-3" />
                Consegnato: {format(new Date(homework.submittedAt), "d MMM yyyy", { locale: it })}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge className={cn("text-xs gap-1", config.className)}>
            <StatusIcon className="w-3 h-3" />
            {config.label}
          </Badge>
          
          {homework.status === 'graded' && homework.grade !== null && (
            <Badge variant="outline" className={cn(
              "text-xs font-bold",
              homework.grade >= 80 ? "border-green-500 text-green-600" :
              homework.grade >= 60 ? "border-yellow-500 text-yellow-600" :
              "border-destructive text-destructive"
            )}>
              {homework.grade}% · {homework.pointsEarned}/{homework.pointsReward} pt
            </Badge>
          )}

          {homework.status !== 'graded' && (
            <span className="text-xs text-muted-foreground">{homework.pointsReward} pt</span>
          )}
        </div>
      </div>

      {homework.teacherFeedback && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-muted-foreground mb-1 font-medium">💬 Feedback insegnante:</p>
          <p className="text-sm text-foreground">{homework.teacherFeedback}</p>
        </div>
      )}
    </div>
  );
}
