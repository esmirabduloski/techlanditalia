import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CalendarDays, Clock, AlertCircle, RefreshCw, Video, Eye, EyeOff, BookOpen } from "lucide-react";
import { format, isPast, isToday, isFuture } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface LessonSchedule {
  id: string;
  lesson_number: number;
  lesson_date: string;
  lesson_title: string | null;
  lesson_time: string | null;
  group: {
    id: string;
    title: string;
    lesson_time: string | null;
    status: string;
    student_meeting_link: string | null;
    course: {
      id: string;
      title: string;
      emoji: string;
    };
  };
}

interface ChildLessonCalendarProps {
  childId: string;
  childName: string;
  groupIds?: string[];
}

export function ChildLessonCalendar({ childId, childName, groupIds: filterGroupIds }: ChildLessonCalendarProps) {
  const [lessons, setLessons] = useState<LessonSchedule[]>([]);
  const [existingLessons, setExistingLessons] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (childId) {
      fetchLessonSchedule();
    }
  }, [childId, filterGroupIds?.join(',')]);

  const fetchLessonSchedule = async () => {
    setError(null);
    setIsLoading(true);
    try {
      let groupIds = filterGroupIds;

      if (!groupIds) {
        // Fallback: fetch all groups the child is in
        const { data: groupStudentData, error: groupError } = await supabase
          .from("group_students")
          .select("group_id")
          .eq("student_id", childId);

        if (groupError) {
          console.error("Error fetching group_students:", groupError);
          setError(`Errore di caricamento gruppi: ${groupError.message}`);
          setIsLoading(false);
          return;
        }

        if (!groupStudentData || groupStudentData.length === 0) {
          setLessons([]);
          setIsLoading(false);
          return;
        }

        groupIds = groupStudentData.map(gs => gs.group_id);
      }

      if (groupIds.length === 0) {
        setLessons([]);
        setIsLoading(false);
        return;
      }

      // Fetch the lesson schedule for those groups
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("group_lesson_schedule")
        .select(`
          id,
          lesson_number,
          lesson_date,
          lesson_title,
          lesson_time,
          group:group_id (
            id,
            title,
            lesson_time,
            status,
            student_meeting_link,
            course:course_id (
              title,
              emoji
            )
          )
        `)
        .in("group_id", groupIds)
        .order("lesson_date", { ascending: true });

      if (scheduleError) {
        console.error("Error fetching group_lesson_schedule:", scheduleError);
        setError(`Errore di caricamento calendario: ${scheduleError.message}`);
        setIsLoading(false);
        return;
      }

      if (scheduleData) {
        const typedLessons: LessonSchedule[] = scheduleData.map((s: any) => ({
          id: s.id,
          lesson_number: s.lesson_number,
          lesson_date: s.lesson_date,
          lesson_title: s.lesson_title,
          lesson_time: s.lesson_time,
          group: {
            id: s.group.id,
            title: s.group.title,
            lesson_time: s.group.lesson_time,
            status: s.group.status || 'active',
            student_meeting_link: s.group.student_meeting_link || null,
            course: {
              title: s.group.course.title,
              emoji: s.group.course.emoji,
            },
          },
        }));
        setLessons(typedLessons);
      }
    } catch (err: any) {
      console.error("Error fetching lesson schedule:", err);
      setError(`Errore imprevisto: ${err?.message || 'Sconosciuto'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getLessonLabel = (lessonNumber: number, lessonTitle: string | null) => {
    if (lessonTitle) return lessonTitle;
    return `M${Math.ceil(lessonNumber / 4)}L${((lessonNumber - 1) % 4) + 1}`;
  };

  const getStatusBadge = (lessonDate: string) => {
    const date = new Date(lessonDate);
    if (isToday(date)) {
      return <Badge className="bg-primary text-primary-foreground">Oggi</Badge>;
    }
    if (isPast(date)) {
      return <Badge variant="secondary">Completata</Badge>;
    }
    return <Badge variant="outline">Programmata</Badge>;
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
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Calendario Lezioni di {childName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchLessonSchedule}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Riprova
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (lessons.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Calendario Lezioni di {childName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            Nessuna lezione programmata
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group lessons by course
  const lessonsByCourse = lessons.reduce((acc, lesson) => {
    const courseTitle = lesson.group.course.title;
    if (!acc[courseTitle]) {
      acc[courseTitle] = {
        emoji: lesson.group.course.emoji,
        lessons: [],
      };
    }
    acc[courseTitle].lessons.push(lesson);
    return acc;
  }, {} as Record<string, { emoji: string; lessons: LessonSchedule[] }>);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Calendario Lezioni di {childName}
          </CardTitle>
          <div className="flex items-center gap-2">
            {showCompleted ? <Eye className="w-4 h-4 text-muted-foreground" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
            <Label htmlFor="show-completed" className="text-xs text-muted-foreground cursor-pointer">
              Completate
            </Label>
            <Switch
              id="show-completed"
              checked={showCompleted}
              onCheckedChange={setShowCompleted}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-6">
            {Object.entries(lessonsByCourse).map(([courseTitle, courseData]) => (
              <div key={courseTitle} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{courseData.emoji}</span>
                  <h4 className="font-medium text-foreground">{courseTitle}</h4>
                  {courseData.lessons[0]?.group.status === 'archived' && (
                    <Badge variant="secondary" className="text-[10px]">Archiviato</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {courseData.lessons
                    .filter((lesson) => {
                      if (showCompleted) return true;
                      const date = new Date(lesson.lesson_date);
                      return isToday(date) || isFuture(date);
                    })
                    .map((lesson) => {
                    const date = new Date(lesson.lesson_date);
                    const isPastLesson = isPast(date) && !isToday(date);
                    const isTodayLesson = isToday(date);
                    
                    return (
                      <div
                        key={lesson.id}
                        className={cn(
                          "p-2 rounded-lg border text-center transition-colors",
                          isTodayLesson && "bg-primary/10 border-primary",
                          isPastLesson && "bg-muted/50 border-muted",
                          isFuture(date) && !isTodayLesson && "bg-card border-border hover:border-primary/50"
                        )}
                      >
                        <p className={cn(
                          "text-sm font-semibold",
                          isPastLesson ? "text-muted-foreground" : "text-foreground"
                        )}>
                          {getLessonLabel(lesson.lesson_number, lesson.lesson_title)}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {format(date, "d MMM", { locale: it })}
                          {(lesson.lesson_time || lesson.group.lesson_time) && (
                            <span>· {(lesson.lesson_time || lesson.group.lesson_time)?.substring(0, 5)}</span>
                          )}
                        </p>
                        {isTodayLesson && (
                          <div className="flex flex-col items-center gap-1">
                            <Badge className="text-[10px] bg-primary text-primary-foreground">
                              Oggi
                            </Badge>
                            {lesson.group.student_meeting_link && (
                              <a
                                href={lesson.group.student_meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-semibold hover:bg-primary/90 transition-colors"
                              >
                                <Video className="w-2.5 h-2.5" />
                                Entra
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
