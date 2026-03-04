import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, Clock } from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, isToday, addWeeks, subWeeks } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface ScheduledLesson {
  id: string;
  group_id: string;
  group_title: string;
  group_lesson_time: string | null;
  lesson_number: number;
  lesson_date: string;
  lesson_title: string | null;
  lesson_time: string | null;
  course_emoji?: string;
  course_title?: string;
  teacher_meeting_link?: string | null;
}

interface TeacherWeeklyCalendarProps {
  lessons: ScheduledLesson[];
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 - 20:00

const GROUP_COLORS = [
  "bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300",
  "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  "bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300",
  "bg-orange-500/15 border-orange-500/40 text-orange-700 dark:text-orange-300",
  "bg-pink-500/15 border-pink-500/40 text-pink-700 dark:text-pink-300",
  "bg-teal-500/15 border-teal-500/40 text-teal-700 dark:text-teal-300",
  "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300",
  "bg-indigo-500/15 border-indigo-500/40 text-indigo-700 dark:text-indigo-300",
];

export function TeacherWeeklyCalendar({ lessons }: TeacherWeeklyCalendarProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const navigate = useNavigate();

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)),
    [currentWeekStart]
  );

  // Assign consistent colors to groups
  const groupColorMap = useMemo(() => {
    const uniqueGroups = [...new Set(lessons.map(l => l.group_id))];
    const map = new Map<string, string>();
    uniqueGroups.forEach((gId, i) => {
      map.set(gId, GROUP_COLORS[i % GROUP_COLORS.length]);
    });
    return map;
  }, [lessons]);

  // Filter lessons for current week
  const weekLessons = useMemo(() =>
    lessons.filter(l => {
      const d = new Date(l.lesson_date);
      return weekDays.some(wd => isSameDay(wd, d));
    }),
    [lessons, weekDays]
  );

  // Get lessons for a specific day
  const getLessonsForDay = (day: Date) =>
    weekLessons.filter(l => isSameDay(new Date(l.lesson_date), day));

  // Parse time string to hour decimal
  const parseTime = (timeStr: string | null): number | null => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(":").map(Number);
    return h + m / 60;
  };

  // Get lesson position and height in the grid
  const getLessonStyle = (lesson: ScheduledLesson) => {
    const time = lesson.lesson_time || lesson.group_lesson_time;
    const startDecimal = parseTime(time);
    if (startDecimal === null) return null;

    const top = ((startDecimal - 8) / 13) * 100;
    const durationHours = 1; // Default 1 hour per lesson
    const height = (durationHours / 13) * 100;

    return {
      top: `${Math.max(0, Math.min(top, 100 - height))}%`,
      height: `${Math.max(height, (1 / 13) * 100)}%`,
    };
  };

  const goToToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const goPrev = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const goNext = () => setCurrentWeekStart(prev => addWeeks(prev, 1));

  const weekLabel = `${format(weekDays[0], "d MMM", { locale: it })} — ${format(weekDays[6], "d MMM yyyy", { locale: it })}`;

  return (
    <Card className="mb-8">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Calendario Settimanale
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday} className="text-xs">
              Oggi
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[160px] text-center">{weekLabel}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30">
            <div className="p-2" />
            {weekDays.map(day => (
              <div
                key={day.toISOString()}
                className={cn(
                  "p-2 text-center border-l",
                  isToday(day) && "bg-primary/10"
                )}
              >
                <p className="text-xs text-muted-foreground uppercase">
                  {format(day, "EEE", { locale: it })}
                </p>
                <p className={cn(
                  "text-lg font-bold leading-tight",
                  isToday(day) ? "text-primary" : "text-foreground"
                )}>
                  {format(day, "d")}
                </p>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] relative" style={{ height: `${HOURS.length * 60}px` }}>
            {/* Hour labels */}
            <div className="relative">
              {HOURS.map(hour => (
                <div
                  key={hour}
                  className="absolute w-full text-right pr-2 text-xs text-muted-foreground"
                  style={{ top: `${((hour - 8) / 13) * 100}%`, transform: "translateY(-50%)" }}
                >
                  {hour}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map(day => {
              const dayLessons = getLessonsForDay(day);
              // Separate timed and untimed
              const timedLessons = dayLessons.filter(l => l.lesson_time || l.group_lesson_time);
              const untimedLessons = dayLessons.filter(l => !l.lesson_time && !l.group_lesson_time);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "relative border-l",
                    isToday(day) && "bg-primary/5"
                  )}
                >
                  {/* Hour lines */}
                  {HOURS.map(hour => (
                    <div
                      key={hour}
                      className="absolute w-full border-t border-border/50"
                      style={{ top: `${((hour - 8) / 13) * 100}%` }}
                    />
                  ))}

                  {/* Timed lessons */}
                  {timedLessons.map(lesson => {
                    const style = getLessonStyle(lesson);
                    if (!style) return null;
                    const colorClass = groupColorMap.get(lesson.group_id) || GROUP_COLORS[0];
                    const time = lesson.lesson_time || lesson.group_lesson_time;

                    return (
                      <div
                        key={lesson.id}
                        className={cn(
                          "absolute left-1 right-1 rounded-md border px-1.5 py-1 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] z-10 overflow-hidden",
                          colorClass
                        )}
                        style={style}
                        onClick={() => navigate(`/insegnante/gruppo/${lesson.group_id}`)}
                        title={`${lesson.group_title} — Lezione ${lesson.lesson_number}`}
                      >
                        <p className="text-[10px] font-bold truncate leading-tight">
                          {lesson.course_emoji} {lesson.group_title}
                        </p>
                        <p className="text-[9px] opacity-80 truncate leading-tight">
                          L{lesson.lesson_number} {time ? `• ${time.substring(0, 5)}` : ""}
                        </p>
                      </div>
                    );
                  })}

                  {/* Untimed lessons — shown as chips at top */}
                  {untimedLessons.length > 0 && (
                    <div className="absolute top-1 left-1 right-1 z-10 space-y-0.5">
                      {untimedLessons.map(lesson => {
                        const colorClass = groupColorMap.get(lesson.group_id) || GROUP_COLORS[0];
                        return (
                          <div
                            key={lesson.id}
                            className={cn(
                              "rounded px-1.5 py-0.5 border cursor-pointer text-[9px] font-medium truncate hover:shadow-sm",
                              colorClass
                            )}
                            onClick={() => navigate(`/insegnante/gruppo/${lesson.group_id}`)}
                          >
                            {lesson.course_emoji} {lesson.group_title} — L{lesson.lesson_number}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
