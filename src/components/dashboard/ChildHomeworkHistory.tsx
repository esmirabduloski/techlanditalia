import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ClipboardCheck, CheckCircle2, XCircle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

interface ChildHomeworkHistoryProps {
  childId: string;
  childName: string;
}

export function ChildHomeworkHistory({ childId, childName }: ChildHomeworkHistoryProps) {
  const [homeworkHistory, setHomeworkHistory] = useState<Record<string, HomeworkStatus[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (childId) {
      fetchHomeworkHistory();
    }
  }, [childId]);

  const fetchHomeworkHistory = async () => {
    try {
      // Get child's groups
      const { data: groupStudentData } = await supabase
        .from("group_students")
        .select(`
          group_id,
          group:group_id (
            id,
            title,
            course_id,
            course:course_id (
              id,
              title,
              emoji
            )
          )
        `)
        .eq("student_id", childId);

      if (!groupStudentData || groupStudentData.length === 0) {
        setHomeworkHistory({});
        setIsLoading(false);
        return;
      }

      const courseIds = [...new Set(groupStudentData.map((gs: any) => gs.group.course_id))];

      // Get all lessons for these courses
      const { data: lessonsData } = await supabase
        .from("lessons")
        .select(`
          id,
          lesson_number,
          title,
          course_id,
          course:course_id (
            title,
            emoji
          )
        `)
        .in("course_id", courseIds)
        .order("lesson_number", { ascending: true });

      // Get all homework for these lessons
      const lessonIds = lessonsData?.map(l => l.id) || [];
      const { data: homeworkData } = await supabase
        .from("homework")
        .select("id, lesson_id, title")
        .in("lesson_id", lessonIds);

      // Get child's homework submissions
      const homeworkIds = homeworkData?.map(h => h.id) || [];
      const { data: submissionsData } = await supabase
        .from("homework_submissions")
        .select("homework_id, submitted_at, status, grade")
        .eq("student_id", childId)
        .in("homework_id", homeworkIds);

      // Build the homework map
      const homeworkByLesson = new Map<string, { id: string; title: string }>();
      homeworkData?.forEach(hw => {
        homeworkByLesson.set(hw.lesson_id, { id: hw.id, title: hw.title });
      });

      const submissionsByHomework = new Map<string, { submitted_at: string; status: string; grade: number | null }>();
      submissionsData?.forEach(sub => {
        submissionsByHomework.set(sub.homework_id, {
          submitted_at: sub.submitted_at,
          status: sub.status,
          grade: sub.grade,
        });
      });

      // Group by course
      const historyByCourse: Record<string, HomeworkStatus[]> = {};

      lessonsData?.forEach((lesson: any) => {
        const courseKey = `${lesson.course.emoji} ${lesson.course.title}`;
        if (!historyByCourse[courseKey]) {
          historyByCourse[courseKey] = [];
        }

        const homework = homeworkByLesson.get(lesson.id);
        const submission = homework ? submissionsByHomework.get(homework.id) : undefined;

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
        });
      });

      setHomeworkHistory(historyByCourse);
    } catch (error) {
      console.error("Error fetching homework history:", error);
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

  const hasAnyHomework = Object.values(homeworkHistory).some(lessons => 
    lessons.some(l => l.hasHomework)
  );

  if (Object.keys(homeworkHistory).length === 0 || !hasAnyHomework) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Storico Compiti di {childName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            Nessun compito disponibile
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          Storico Compiti di {childName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[250px]">
          <div className="space-y-6">
            {Object.entries(homeworkHistory).map(([courseTitle, lessons]) => (
              <div key={courseTitle} className="space-y-3">
                <h4 className="font-medium text-foreground">{courseTitle}</h4>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {lessons.map((lesson) => {
                    const lessonLabel = `L${lesson.lessonNumber}`;
                    
                    if (!lesson.hasHomework) {
                      return (
                        <div
                          key={lesson.lessonNumber}
                          className="p-2 rounded-lg bg-muted/30 border border-muted text-center"
                          title="Nessun compito per questa lezione"
                        >
                          <p className="text-xs font-medium text-muted-foreground">
                            {lessonLabel}
                          </p>
                          <Minus className="w-4 h-4 mx-auto mt-1 text-muted-foreground/50" />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            N/D
                          </p>
                        </div>
                      );
                    }

                    const isCompleted = lesson.isSubmitted;
                    const isGraded = lesson.status === 'graded';
                    
                    return (
                      <div
                        key={lesson.lessonNumber}
                        className={cn(
                          "p-2 rounded-lg border text-center transition-colors",
                          isCompleted 
                            ? "bg-green-500/10 border-green-500/30" 
                            : "bg-red-500/10 border-red-500/30"
                        )}
                        title={lesson.homeworkTitle || 'Compito'}
                      >
                        <p className={cn(
                          "text-xs font-medium",
                          isCompleted ? "text-green-600" : "text-red-600"
                        )}>
                          {lessonLabel}
                        </p>
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 mx-auto mt-1 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 mx-auto mt-1 text-red-600" />
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
                            {isCompleted ? "Fatto" : "Da fare"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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
            <span>Non consegnato</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-muted/50 border border-muted" />
            <span>Nessun compito</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
