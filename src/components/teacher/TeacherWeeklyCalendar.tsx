import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarDays, Link2, Check, Loader2 } from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, isToday, addWeeks, subWeeks } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  recording_url?: string | null;
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

function RecordingLinkPopover({
  lesson,
  onSaved,
}: {
  lesson: ScheduledLesson;
  onSaved: (id: string, url: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(lesson.recording_url || "");
  const [saving, setSaving] = useState(false);
  const hasLink = !!lesson.recording_url;

  const handleSave = async () => {
    const trimmed = value.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast.error("Inserisci un URL valido (https://...)");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("group_lesson_schedule")
      .update({ recording_url: trimmed || null })
      .eq("id", lesson.id);
    setSaving(false);
    if (error) {
      toast.error("Errore nel salvataggio: " + error.message);
      return;
    }
    toast.success(trimmed ? "Link registrazione salvato" : "Link rimosso");
    onSaved(lesson.id, trimmed || null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label={hasLink ? "Modifica link registrazione" : "Aggiungi link registrazione"}
          title={hasLink ? "Modifica link registrazione" : "Aggiungi link registrazione"}
          className={cn(
            "absolute top-0.5 right-0.5 z-20 flex items-center justify-center w-5 h-5 rounded border transition-all hover:scale-110",
            hasLink
              ? "bg-sky-500 border-sky-600 text-white"
              : "bg-background/90 border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {hasLink ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-3 space-y-2"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-sm font-semibold">Link registrazione lezione</p>
          <p className="text-xs text-muted-foreground">
            L{lesson.lesson_number} — {lesson.group_title}
          </p>
        </div>
        <Input
          type="url"
          placeholder="https://..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          {hasLink && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setValue("");
              }}
            >
              Svuota
            </Button>
          )}
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Salva
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TeacherWeeklyCalendar({ lessons }: TeacherWeeklyCalendarProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [localLessons, setLocalLessons] = useState(lessons);
  const navigate = useNavigate();

  // Sync when parent lessons change
  useMemo(() => setLocalLessons(lessons), [lessons]);

  const updateRecording = (id: string, url: string | null) => {
    setLocalLessons((prev) =>
      prev.map((l) => (l.id === id ? { ...l, recording_url: url } : l))
    );
  };

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)),
    [currentWeekStart]
  );

  const groupColorMap = useMemo(() => {
    const uniqueGroups = [...new Set(localLessons.map(l => l.group_id))];
    const map = new Map<string, string>();
    uniqueGroups.forEach((gId, i) => {
      map.set(gId, GROUP_COLORS[i % GROUP_COLORS.length]);
    });
    return map;
  }, [localLessons]);

  const weekLessons = useMemo(() =>
    localLessons.filter(l => {
      const d = new Date(l.lesson_date);
      return weekDays.some(wd => isSameDay(wd, d));
    }),
    [localLessons, weekDays]
  );

  const getLessonsForDay = (day: Date) =>
    weekLessons.filter(l => isSameDay(new Date(l.lesson_date), day));

  const parseTime = (timeStr: string | null): number | null => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(":").map(Number);
    return h + m / 60;
  };

  const getLessonStyle = (lesson: ScheduledLesson) => {
    const time = lesson.lesson_time || lesson.group_lesson_time;
    const startDecimal = parseTime(time);
    if (startDecimal === null) return null;

    const top = ((startDecimal - 8) / 13) * 100;
    const durationHours = 1;
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
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
          <Link2 className="w-3 h-3" />
          Clicca l'icona in alto a destra di ogni lezione per aggiungere il link della registrazione
        </p>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <div className="min-w-[700px]">
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

          <div className="grid grid-cols-[60px_repeat(7,1fr)] relative" style={{ height: `${HOURS.length * 60}px` }}>
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

            {weekDays.map(day => {
              const dayLessons = getLessonsForDay(day);
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
                  {HOURS.map(hour => (
                    <div
                      key={hour}
                      className="absolute w-full border-t border-border/50"
                      style={{ top: `${((hour - 8) / 13) * 100}%` }}
                    />
                  ))}

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
                        <RecordingLinkPopover lesson={lesson} onSaved={updateRecording} />
                        <p className="text-[10px] font-bold truncate leading-tight pr-5">
                          {lesson.course_emoji} {lesson.group_title}
                        </p>
                        <p className="text-[9px] opacity-80 truncate leading-tight">
                          L{lesson.lesson_number} {time ? `• ${time.substring(0, 5)}` : ""}
                        </p>
                      </div>
                    );
                  })}

                  {untimedLessons.length > 0 && (
                    <div className="absolute top-1 left-1 right-1 z-10 space-y-0.5">
                      {untimedLessons.map(lesson => {
                        const colorClass = groupColorMap.get(lesson.group_id) || GROUP_COLORS[0];
                        return (
                          <div
                            key={lesson.id}
                            className={cn(
                              "relative rounded px-1.5 py-0.5 border cursor-pointer text-[9px] font-medium truncate hover:shadow-sm pr-6",
                              colorClass
                            )}
                            onClick={() => navigate(`/insegnante/gruppo/${lesson.group_id}`)}
                          >
                            <RecordingLinkPopover lesson={lesson} onSaved={updateRecording} />
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
