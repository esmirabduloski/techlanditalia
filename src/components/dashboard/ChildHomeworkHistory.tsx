import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Minus, AlertCircle, RefreshCw, ChevronDown, Filter, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const INITIAL_ITEMS_COUNT = 8;

interface HomeworkStatus {
  lessonNumber: number;
  lessonTitle: string | null;
  hasHomework: boolean;
  homeworkId?: string;
  homeworkTitle?: string;
  isSubmitted: boolean;
  submittedAt?: string;
  status?: string;
  grade?: number;
  lessonDate?: string;
  dueDate?: string;
  computedStatus: 'pending' | 'submitted' | 'graded' | 'missing' | 'none';
}

interface ChildHomeworkHistoryProps {
  childId: string;
  childName: string;
  courseIds?: string[];
}

export function ChildHomeworkHistory({ childId, childName, courseIds: filterCourseIds }: ChildHomeworkHistoryProps) {
  const [homeworkHistory, setHomeworkHistory] = useState<Record<string, HomeworkStatus[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (childId) {
      fetchHomeworkHistory();
    }
  }, [childId, filterCourseIds?.join(',')]);

  const fetchHomeworkHistory = async () => {
    setError(null);
    setIsLoading(true);
    try {
      let courseIds: string[];

      if (filterCourseIds) {
        courseIds = filterCourseIds;
      } else {
        const { data: groupStudentData, error: groupError } = await supabase
          .from("group_students")
          .select(`group_id, group:group_id ( id, course_id )`)
          .eq("student_id", childId);

        if (groupError) {
          setError(`Errore di caricamento gruppi: ${groupError.message}`);
          setIsLoading(false);
          return;
        }

        if (!groupStudentData || groupStudentData.length === 0) {
          setHomeworkHistory({});
          setIsLoading(false);
          return;
        }

        courseIds = [...new Set(groupStudentData.map((gs: any) => gs.group.course_id))];
      }

      if (courseIds.length === 0) {
        setHomeworkHistory({});
        setIsLoading(false);
        return;
      }

      const { data: lessonsData } = await supabase
        .from("lessons")
        .select(`id, lesson_number, title, course_id, course:course_id ( title, emoji )`)
        .in("course_id", courseIds)
        .order("lesson_number", { ascending: true });

      const lessonIds = lessonsData?.map(l => l.id) || [];
      const { data: homeworkData } = await supabase
        .from("homework")
        .select("id, lesson_id, title")
        .in("lesson_id", lessonIds);

      const homeworkIds = homeworkData?.map(h => h.id) || [];
      const { data: submissionsData } = await supabase
        .from("homework_submissions")
        .select("homework_id, submitted_at, status, grade")
        .eq("student_id", childId)
        .in("homework_id", homeworkIds);

      // Fetch group info for schedule and deadlines
      const { data: groupStudentsForSchedule } = await supabase
        .from("group_students")
        .select("group_id")
        .eq("student_id", childId);

      const groupIdsForSchedule = groupStudentsForSchedule?.map(gs => gs.group_id) || [];

      let lessonDateMap = new Map<string, string>();
      let nextLessonDateMap = new Map<string, string>();
      const groupToCourse = new Map<string, string>();

      if (groupIdsForSchedule.length > 0) {
        const { data: scheduleData } = await supabase
          .from("group_lesson_schedule")
          .select("group_id, lesson_number, lesson_date")
          .in("group_id", groupIdsForSchedule)
          .order("lesson_number", { ascending: true });

        const { data: groupsData } = await supabase
          .from("student_groups")
          .select("id, course_id")
          .in("id", groupIdsForSchedule);

        groupsData?.forEach(g => groupToCourse.set(g.id, g.course_id));

        // Build lesson date map and next lesson date map
        const courseSchedules = new Map<string, { lessonNumber: number; date: string }[]>();
        scheduleData?.forEach(s => {
          const cId = groupToCourse.get(s.group_id);
          if (cId) {
            lessonDateMap.set(`${cId}-${s.lesson_number}`, s.lesson_date);
            if (!courseSchedules.has(cId)) courseSchedules.set(cId, []);
            courseSchedules.get(cId)!.push({ lessonNumber: s.lesson_number, date: s.lesson_date });
          }
        });

        // For each lesson, find the next lesson's date as due date
        courseSchedules.forEach((schedule, cId) => {
          schedule.sort((a, b) => a.lessonNumber - b.lessonNumber);
          for (let i = 0; i < schedule.length - 1; i++) {
            nextLessonDateMap.set(`${cId}-${schedule[i].lessonNumber}`, schedule[i + 1].date);
          }
        });
      }

      // Also fetch group-specific deadlines
      let deadlineMap = new Map<string, string>();
      if (groupIdsForSchedule.length > 0 && homeworkIds.length > 0) {
        const { data: deadlines } = await supabase
          .from("homework_group_deadlines")
          .select("homework_id, due_date")
          .in("group_id", groupIdsForSchedule)
          .in("homework_id", homeworkIds);
        deadlines?.forEach(d => deadlineMap.set(d.homework_id, d.due_date));
      }

      const homeworkByLesson = new Map<string, { id: string; title: string }>();
      homeworkData?.forEach(hw => homeworkByLesson.set(hw.lesson_id, { id: hw.id, title: hw.title }));

      const submissionsByHomework = new Map<string, { submitted_at: string; status: string; grade: number | null }>();
      submissionsData?.forEach(sub => submissionsByHomework.set(sub.homework_id, sub));

      const historyByCourse: Record<string, HomeworkStatus[]> = {};

      lessonsData?.forEach((lesson: any) => {
        const courseKey = `${lesson.course.emoji} ${lesson.course.title}`;
        if (!historyByCourse[courseKey]) historyByCourse[courseKey] = [];

        const homework = homeworkByLesson.get(lesson.id);
        const submission = homework ? submissionsByHomework.get(homework.id) : undefined;
        const dateKey = `${lesson.course_id}-${lesson.lesson_number}`;
        const lessonDate = lessonDateMap.get(dateKey);
        const isPastLesson = lessonDate ? new Date(lessonDate) < new Date(new Date().toDateString()) : false;

        // Determine due date: group deadline > next lesson date
        const groupDeadline = homework ? deadlineMap.get(homework.id) : undefined;
        const nextLesson = nextLessonDateMap.get(dateKey);
        const dueDate = groupDeadline || nextLesson;

        let computedStatus: HomeworkStatus['computedStatus'] = 'none';
        if (homework) {
          if (submission) {
            computedStatus = submission.status === 'graded' ? 'graded' : 'submitted';
          } else if (isPastLesson) {
            computedStatus = 'missing';
          } else {
            computedStatus = 'pending';
          }
        }

        historyByCourse[courseKey].push({
          lessonNumber: lesson.lesson_number,
          lessonTitle: lesson.title,
          hasHomework: !!homework,
          homeworkId: homework?.id,
          homeworkTitle: homework?.title,
          isSubmitted: !!submission,
          submittedAt: submission?.submitted_at,
          status: submission?.status,
          grade: submission?.grade ?? undefined,
          lessonDate,
          dueDate,
          computedStatus,
        });
      });

      setHomeworkHistory(historyByCourse);
    } catch (err: any) {
      console.error("Error fetching homework history:", err);
      setError(`Errore imprevisto: ${err?.message || 'Sconosciuto'}`);
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

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchHomeworkHistory}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Riprova
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const allLessons = Object.values(homeworkHistory).flat();
  const hasAnyHomework = allLessons.some(l => l.hasHomework);

  if (Object.keys(homeworkHistory).length === 0 || !hasAnyHomework) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-center text-muted-foreground">Nessun compito disponibile</p>
        </CardContent>
      </Card>
    );
  }

  // Count by status
  const counts = {
    all: allLessons.filter(l => l.hasHomework).length,
    pending: allLessons.filter(l => l.computedStatus === 'pending').length,
    submitted: allLessons.filter(l => l.computedStatus === 'submitted').length,
    graded: allLessons.filter(l => l.computedStatus === 'graded').length,
    missing: allLessons.filter(l => l.computedStatus === 'missing').length,
  };

  // Filter lessons
  const filterLessons = (lessons: HomeworkStatus[]) => {
    if (statusFilter === "all") return lessons;
    return lessons.filter(l => l.computedStatus === statusFilter);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Filter */}
        <div className="flex items-center justify-end mb-4">
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

        <ScrollArea className="h-[280px]">
          <div className="space-y-6">
            {Object.entries(homeworkHistory).map(([courseTitle, lessons]) => {
              const filtered = filterLessons(lessons);
              if (filtered.length === 0) return null;
              const displayLessons = showAll ? filtered : filtered.slice(0, INITIAL_ITEMS_COUNT);
              const hasMoreLessons = filtered.length > INITIAL_ITEMS_COUNT;

              return (
                <div key={courseTitle} className="space-y-3">
                  <h4 className="font-medium text-foreground text-sm">{courseTitle}</h4>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {displayLessons.map((lesson) => {
                      const lessonLabel = `L${lesson.lessonNumber}`;

                      if (!lesson.hasHomework) {
                        return (
                          <div
                            key={lesson.lessonNumber}
                            className="p-2 rounded-lg bg-muted/30 border border-muted text-center"
                            title="Nessun compito per questa lezione"
                          >
                            <p className="text-xs font-medium text-muted-foreground">{lessonLabel}</p>
                            <Minus className="w-4 h-4 mx-auto mt-1 text-muted-foreground/50" />
                            <p className="text-[10px] text-muted-foreground mt-1">N/D</p>
                          </div>
                        );
                      }

                      const isCompleted = lesson.isSubmitted;
                      const isGraded = lesson.status === 'graded';
                      const isMissing = lesson.computedStatus === 'missing';

                      const cardColor = isCompleted
                        ? "bg-green-500/10 border-green-500/30"
                        : isMissing
                          ? "bg-red-500/10 border-red-500/30"
                          : "bg-muted/30 border-muted";
                      const textColor = isCompleted
                        ? "text-green-600"
                        : isMissing
                          ? "text-red-600"
                          : "text-muted-foreground";

                      return (
                        <div
                          key={lesson.lessonNumber}
                          className={cn("p-2 rounded-lg border text-center transition-colors", cardColor)}
                          title={lesson.homeworkTitle || 'Compito'}
                        >
                          <p className={cn("text-xs font-medium", textColor)}>{lessonLabel}</p>
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 mx-auto mt-1 text-green-600" />
                          ) : isMissing ? (
                            <XCircle className="w-4 h-4 mx-auto mt-1 text-red-600" />
                          ) : (
                            <Minus className="w-4 h-4 mx-auto mt-1 text-muted-foreground/50" />
                          )}
                          {isGraded && lesson.grade !== undefined ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] mt-1 px-1",
                                lesson.grade >= 80 ? "border-green-500 text-green-600" :
                                lesson.grade >= 60 ? "border-yellow-500 text-yellow-600" :
                                "border-red-500 text-red-600"
                              )}
                            >
                              {lesson.grade}%
                            </Badge>
                          ) : (
                            <p className="text-[10px] mt-1 text-muted-foreground">
                              {isCompleted ? "Fatto" : isMissing ? "Mancante" : "Da fare"}
                            </p>
                          )}
                          {/* Due date */}
                          {lesson.dueDate && (
                            <p className={cn(
                              "text-[9px] mt-1 flex items-center justify-center gap-0.5",
                              isMissing ? "text-red-500" : "text-muted-foreground"
                            )}>
                              <Clock className="w-2.5 h-2.5" />
                              {format(new Date(lesson.dueDate), "d MMM", { locale: it })}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {hasMoreLessons && !showAll && (
                    <div className="flex justify-center pt-2">
                      <Button variant="outline" size="sm" onClick={() => setShowAll(true)} className="gap-2">
                        <ChevronDown className="w-4 h-4" />
                        Vedi Altri ({filtered.length - INITIAL_ITEMS_COUNT} rimanenti)
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500/30 border border-green-500/50" />
            <span>Consegnato</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500/50" />
            <span>Mancante</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-muted/50 border border-muted" />
            <span>Da fare</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
