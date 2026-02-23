import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CalendarDays, Clock, Video } from "lucide-react";
import { format, isPast, isToday, isFuture } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
    student_meeting_link: string | null;
    course: {
      title: string;
      emoji: string;
    };
  };
}

interface StudentLessonScheduleProps {
  studentId: string;
}

export function StudentLessonSchedule({ studentId }: StudentLessonScheduleProps) {
  const [lessons, setLessons] = useState<LessonSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (studentId) {
      fetchLessonSchedule();
    }
  }, [studentId]);

  const fetchLessonSchedule = async () => {
    setError(null);
    setIsLoading(true);
    try {
      // Get the groups the student is in
      const { data: groupStudentData, error: groupError } = await supabase
        .from("group_students")
        .select("group_id")
        .eq("student_id", studentId);

      if (groupError) {
        setError(`Errore di caricamento gruppi: ${groupError.message}`);
        setIsLoading(false);
        return;
      }

      if (!groupStudentData || groupStudentData.length === 0) {
        setLessons([]);
        setIsLoading(false);
        return;
      }

      const groupIds = groupStudentData.map(gs => gs.group_id);

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
            Calendario Lezioni
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
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
            Calendario Lezioni
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

  // Find today's lessons with meeting links
  const todayLessons = lessons.filter(l => isToday(new Date(l.lesson_date)) && l.group.student_meeting_link);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Calendario Lezioni
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Prominent "Join Lesson" buttons for today */}
        {todayLessons.length > 0 && (
          <div className="mb-4 space-y-2">
            {todayLessons.map((lesson) => (
              <a
                key={`join-${lesson.id}`}
                href={lesson.group.student_meeting_link!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full px-6 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-base shadow-tech-glow hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
              >
                <Video className="w-5 h-5" />
                🚀 Entra a Lezione — {lesson.group.course.emoji} {getLessonLabel(lesson.lesson_number, lesson.lesson_title)}
                {(lesson.lesson_time || lesson.group.lesson_time) && (
                  <span className="text-primary-foreground/80 text-sm font-normal ml-1">
                    ore {(lesson.lesson_time || lesson.group.lesson_time)?.substring(0, 5)}
                  </span>
                )}
              </a>
            ))}
          </div>
        )}

        <ScrollArea className="h-[400px]">
          <div className="space-y-6 pr-4">
            {Object.entries(lessonsByCourse).map(([courseTitle, courseData]) => (
              <div key={courseTitle} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{courseData.emoji}</span>
                  <h4 className="font-medium text-foreground">{courseTitle}</h4>
                </div>
                <div className="space-y-2">
                  {courseData.lessons.map((lesson) => {
                    const date = new Date(lesson.lesson_date);
                    const isPastLesson = isPast(date) && !isToday(date);
                    const isTodayLesson = isToday(date);
                    const displayTime = lesson.lesson_time || lesson.group.lesson_time;
                    
                    return (
                      <div
                        key={lesson.id}
                        className={cn(
                          "p-3 rounded-lg border transition-colors",
                          isTodayLesson && "bg-primary/10 border-primary",
                          isPastLesson && "bg-muted/50 border-muted",
                          isFuture(date) && !isTodayLesson && "bg-card border-border hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className={cn(
                              "font-semibold text-sm",
                              isPastLesson ? "text-muted-foreground" : "text-foreground"
                            )}>
                              {getLessonLabel(lesson.lesson_number, lesson.lesson_title)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {lesson.group.title}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              {format(date, "d MMM", { locale: it })}
                            </p>
                            {displayTime && (
                              <p className="text-xs font-medium flex items-center gap-1 text-foreground">
                                <Clock className="w-3 h-3" />
                                {displayTime.substring(0, 5)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          {isTodayLesson && lesson.group.student_meeting_link ? (
                            <a
                              href={lesson.group.student_meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                            >
                              <Video className="w-3 h-3" />
                              Entra
                            </a>
                          ) : <span />}
                          {getStatusBadge(lesson.lesson_date)}
                        </div>
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
