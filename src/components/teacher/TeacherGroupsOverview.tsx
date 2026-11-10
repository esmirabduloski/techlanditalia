import { useState } from "react";
import { Link } from "react-router-dom";
import { Award, CalendarClock, ChevronRight, Users, UsersRound, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface OverviewGroup {
  id: string;
  title: string;
  course_title?: string;
  course_emoji?: string;
  max_lessons: number;
  student_count?: number;
  lesson_time?: string | null;
  status: string;
  lessons_completed?: number;
  teacher_meeting_link?: string | null;
}

export interface OverviewNextLesson {
  lesson_date: string;
  lesson_number: number;
  lesson_time: string | null;
}

interface Props {
  groups: OverviewGroup[];
  /** Prossima lezione in calendario per gruppo (id gruppo -> lezione). */
  nextLessons: Map<string, OverviewNextLesson>;
  /** Percentuale di presenze per gruppo; assente se non ci sono ancora presenze segnate. */
  attendanceRates: Map<string, number>;
  /** Etichetta leggibile della data: "Oggi", "Domani", "lun 16 nov". */
  dateLabel: (date: string) => string;
  today: string;
}

const attendanceTone = (rate: number) =>
  rate >= 80
    ? "text-green-700 dark:text-green-400"
    : rate >= 60
      ? "text-amber-700 dark:text-amber-400"
      : "text-red-700 dark:text-red-400";

export function TeacherGroupsOverview({ groups, nextLessons, attendanceRates, dateLabel, today }: Props) {
  const [showArchived, setShowArchived] = useState(false);

  const archived = groups.filter((g) => g.status === "archived");
  // In cima il gruppo con la lezione più vicina; quelli senza lezioni in calendario in fondo.
  const active = groups
    .filter((g) => g.status !== "archived")
    .sort((a, b) => {
      const da = nextLessons.get(a.id)?.lesson_date ?? "9999";
      const db = nextLessons.get(b.id)?.lesson_date ?? "9999";
      return da.localeCompare(db) || a.title.localeCompare(b.title);
    });
  const visible = showArchived ? [...active, ...archived] : active;

  return (
    <section aria-labelledby="gruppi-heading" className="mb-6 sm:mb-8">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="gruppi-heading" className="text-lg sm:text-xl font-semibold flex items-center gap-2">
          <UsersRound className="w-5 h-5 text-tech-teal" />
          I miei gruppi
          {active.length > 0 && <Badge variant="secondary">{active.length}</Badge>}
        </h2>
        {archived.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}>
            {showArchived ? "Nascondi archiviati" : `Mostra archiviati (${archived.length})`}
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <Card className="p-8 text-center">
          <UsersRound className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">
            {groups.length === 0 ? "Non hai ancora gruppi assegnati" : "Nessun gruppo attivo"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {groups.length === 0
              ? "Appena la segreteria ti assegna un gruppo lo trovi qui."
              : "Usa “Mostra archiviati” per rivedere i gruppi conclusi."}
          </p>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((group) => {
            const isArchived = group.status === "archived";
            const next = nextLessons.get(group.id);
            const nextTime = (next?.lesson_time || group.lesson_time)?.substring(0, 5);
            const isToday = next?.lesson_date === today;
            const done = group.lessons_completed || 0;
            const progress = group.max_lessons > 0 ? Math.min(100, Math.round((done / group.max_lessons) * 100)) : 0;
            const attendance = attendanceRates.get(group.id);

            return (
              <li key={group.id}>
                <Card
                  className={cn(
                    "h-full flex flex-col overflow-hidden transition-shadow hover:shadow-md",
                    isToday && "border-primary/60 ring-1 ring-primary/30",
                    isArchived && "opacity-70",
                  )}
                >
                  <Link
                    to={`/insegnante/gruppo/${group.id}`}
                    className="flex-1 p-4 space-y-3 no-underline hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-3xl leading-none" aria-hidden="true">
                        {group.course_emoji || "📚"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold leading-snug truncate">{group.title}</h3>
                        <p className="text-sm text-muted-foreground truncate">{group.course_title}</p>
                      </div>
                      {isArchived ? (
                        <Badge variant="secondary" className="flex-shrink-0">Archiviato</Badge>
                      ) : (
                        <ChevronRight className="w-4 h-4 mt-1 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>

                    {!isArchived && (
                      <div
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm",
                          isToday ? "bg-primary/10 text-primary font-medium" : "bg-muted text-foreground",
                        )}
                      >
                        <CalendarClock className="w-4 h-4 flex-shrink-0" />
                        {next ? (
                          <span className="truncate">
                            {dateLabel(next.lesson_date)}
                            {nextTime && ` alle ${nextTime}`} · Lezione {next.lesson_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Nessuna lezione in calendario</span>
                        )}
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Lezioni svolte</span>
                        <span className="font-medium text-foreground">
                          {done}/{group.max_lessons}
                        </span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        {group.student_count ?? 0} {group.student_count === 1 ? "studente" : "studenti"}
                      </span>
                      {attendance !== undefined && (
                        <span className={cn("font-medium", attendanceTone(attendance))}>
                          {attendance}% presenze
                        </span>
                      )}
                    </div>
                  </Link>

                  {!isArchived && (
                    <div className="flex gap-2 border-t p-2">
                      {group.teacher_meeting_link && (
                        <Button asChild size="sm" variant={isToday ? "default" : "outline"} className="flex-1">
                          <a href={group.teacher_meeting_link} target="_blank" rel="noopener noreferrer" className="no-underline">
                            <Video className="w-4 h-4 mr-1.5" />
                            Avvia lezione
                          </a>
                        </Button>
                      )}
                      <Button asChild size="sm" variant="ghost" className="flex-1">
                        <Link to={`/insegnante/valutazioni?gruppo=${group.id}`} className="no-underline">
                          <Award className="w-4 h-4 mr-1.5" />
                          Compiti
                        </Link>
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
