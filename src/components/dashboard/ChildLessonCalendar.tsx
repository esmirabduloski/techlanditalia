import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Clock, AlertCircle, RefreshCw, Video, BookOpen, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatObjectiveForParent } from "@/lib/lessonObjective";
import { localDateKey } from "@/lib/childProgress";
import { useChildSchedule, type ScheduledLesson } from "@/hooks/useChildProgressData";

const INITIAL_COUNT = 4;

interface ChildLessonCalendarProps {
  childId: string;
  childName: string;
  groupIds?: string[];
}

/**
 * Calendario lezioni del figlio, pensato per il telefono: le prossime lezioni
 * in elenco (niente riquadro a scorrimento dentro la pagina) e le passate a richiesta.
 * Va dentro una sezione dell'area genitore che ne fa da titolo.
 */
export function ChildLessonCalendar({ childId, childName, groupIds }: ChildLessonCalendarProps) {
  const { data: lessons = [], isLoading, error, refetch } = useChildSchedule(childId, groupIds);
  const [showPast, setShowPast] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    return (
      <div className="py-6 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{(error as Error).message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Riprova
        </Button>
      </div>
    );
  }

  if (lessons.length === 0) {
    return <p className="text-center text-muted-foreground py-4">Nessuna lezione programmata per {childName}</p>;
  }

  const today = localDateKey();
  // Solo la prossima lezione di ogni corso si può aprire
  const nextByCourse = new Map<string, string>();
  for (const l of lessons) {
    if (l.lesson_date >= today && !nextByCourse.has(l.group.course.id)) nextByCourse.set(l.group.course.id, l.id);
  }

  const upcoming = lessons.filter((l) => l.lesson_date >= today);
  const past = lessons.filter((l) => l.lesson_date < today).reverse();
  const list = showPast ? past : upcoming;
  const visible = showAll ? list : list.slice(0, INITIAL_COUNT);
  const archived = lessons.some((l) => l.group.status === "archived");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {archived && <Badge variant="secondary" className="text-xs">Corso archiviato</Badge>}
        <div className="flex items-center gap-2 ml-auto min-h-[44px]">
          <Label htmlFor={`show-past-${childId}`} className="text-sm text-muted-foreground cursor-pointer">
            Mostra lezioni passate
          </Label>
          <Switch
            id={`show-past-${childId}`}
            checked={showPast}
            onCheckedChange={(v) => { setShowPast(v); setShowAll(false); }}
          />
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-4">
          {showPast ? "Nessuna lezione ancora svolta" : "Nessuna lezione in programma"}
        </p>
      ) : (
        <ul className="space-y-2 list-none p-0 m-0">
          {visible.map((lesson) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              today={today}
              isUnlocked={nextByCourse.get(lesson.group.course.id) === lesson.id}
            />
          ))}
        </ul>
      )}

      {list.length > INITIAL_COUNT && !showAll && (
        <Button variant="outline" className="w-full gap-2" onClick={() => setShowAll(true)}>
          <ChevronDown className="w-4 h-4" />
          Mostra tutte ({list.length - INITIAL_COUNT} in più)
        </Button>
      )}
    </div>
  );
}

function LessonRow({ lesson, today, isUnlocked }: { lesson: ScheduledLesson; today: string; isUnlocked: boolean }) {
  const isToday = lesson.lesson_date === today;
  const isPast = lesson.lesson_date < today;
  const courseId = lesson.group.course.id;
  const time = (lesson.lesson_time || lesson.group.lesson_time)?.substring(0, 5);
  const objective = formatObjectiveForParent(lesson.objective, isPast);
  const canOpen = lesson.hasMaterial && isUnlocked;
  const label = lesson.lesson_title || `Lezione ${lesson.lesson_number}`;

  return (
    <li
      className={cn(
        "rounded-xl border p-3",
        isToday ? "bg-primary/10 border-primary" : isPast ? "bg-muted/40 border-muted" : "bg-card border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("font-semibold", isPast ? "text-muted-foreground" : "text-foreground")}>{label}</p>
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="capitalize">{format(new Date(`${lesson.lesson_date}T12:00:00`), "EEE d MMM", { locale: it })}</span>
            {time && <span>· {time}</span>}
          </p>
        </div>
        {isToday ? (
          <Badge className="bg-primary text-primary-foreground shrink-0">Oggi</Badge>
        ) : isPast ? (
          <Badge variant="secondary" className="shrink-0">Svolta</Badge>
        ) : null}
      </div>

      {objective && <p className="text-sm text-muted-foreground mt-2">🎯 {objective}</p>}

      {(isToday && lesson.group.student_meeting_link) || canOpen ? (
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          {isToday && lesson.group.student_meeting_link && (
            <Button asChild className="min-h-[44px] flex-1 no-underline">
              <a href={lesson.group.student_meeting_link} target="_blank" rel="noopener noreferrer">
                <Video className="w-4 h-4 mr-2" />
                Entra in lezione
              </a>
            </Button>
          )}
          {canOpen && (
            <Button asChild variant="outline" className="min-h-[44px] flex-1 no-underline">
              <Link to={`/area-riservata/corso/${courseId}/lezione/${lesson.lesson_number}`}>
                <BookOpen className="w-4 h-4 mr-2" />
                Vai alla lezione
              </Link>
            </Button>
          )}
        </div>
      ) : !isPast && lesson.hasMaterial ? (
        <p className="text-xs text-muted-foreground mt-2">🔒 Il materiale si apre quando è la prossima lezione</p>
      ) : null}
    </li>
  );
}
