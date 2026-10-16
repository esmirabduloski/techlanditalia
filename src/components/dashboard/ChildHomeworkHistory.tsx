import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Loader2, CheckCircle2, XCircle, Minus, AlertCircle, RefreshCw, ChevronDown, Clock, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useChildHomework, type HomeworkItem } from "@/hooks/useChildProgressData";

const INITIAL_ITEMS_COUNT = 8;

type Filter = "all" | "pending" | "submitted" | "graded" | "missing";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Tutti" },
  { value: "missing", label: "Mancanti" },
  { value: "pending", label: "Da fare" },
  { value: "submitted", label: "Consegnati" },
  { value: "graded", label: "Valutati" },
];

const STATUS_LABEL: Record<HomeworkItem["computedStatus"], string> = {
  pending: "Da fare",
  submitted: "Consegnato",
  graded: "Valutato",
  missing: "Mancante",
  none: "Nessun compito",
};

interface ChildHomeworkHistoryProps {
  childId: string;
  childName: string;
  courseIds?: string[];
}

const shortDate = (d: string) => format(new Date(d.length === 10 ? `${d}T12:00:00` : d), "d MMM", { locale: it });

/** Compiti del figlio per lezione; toccando una casella si leggono voto e commento dell'insegnante. */
export function ChildHomeworkHistory({ childId, childName, courseIds }: ChildHomeworkHistoryProps) {
  const { data, isLoading, error, refetch } = useChildHomework(childId, courseIds);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<HomeworkItem | null>(null);

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

  const byCourse = data?.byCourse ?? {};
  const counts = data?.counts;
  if (!counts || counts.all === 0) {
    return <p className="text-center text-muted-foreground py-4">Nessun compito assegnato a {childName}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Filtro a pillole: scorre in orizzontale se non ci sta */}
      <div className="-mx-1 overflow-x-auto" role="radiogroup" aria-label="Filtra i compiti">
        <div className="flex gap-2 px-1 pb-1 w-max">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={filter === f.value}
              onClick={() => { setFilter(f.value); setShowAll(false); }}
              className={cn(
                "min-h-[40px] px-3 rounded-full border text-sm font-medium whitespace-nowrap transition-colors",
                filter === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted",
              )}
            >
              {f.label} ({counts[f.value]})
            </button>
          ))}
        </div>
      </div>

      {Object.entries(byCourse).map(([courseTitle, lessons]) => {
        const filtered = lessons.filter((l) => (filter === "all" ? l.hasHomework : l.computedStatus === filter));
        if (filtered.length === 0) return null;
        const display = showAll ? filtered : filtered.slice(0, INITIAL_ITEMS_COUNT);

        return (
          <div key={courseTitle} className="space-y-3">
            {Object.keys(byCourse).length > 1 && <h4 className="font-medium text-foreground text-sm">{courseTitle}</h4>}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {display.map((lesson) => (
                <HomeworkCell key={lesson.lessonNumber} lesson={lesson} onOpen={() => setSelected(lesson)} />
              ))}
            </div>
            {filtered.length > INITIAL_ITEMS_COUNT && !showAll && (
              <Button variant="outline" className="w-full gap-2" onClick={() => setShowAll(true)}>
                <ChevronDown className="w-4 h-4" />
                Mostra tutti ({filtered.length - INITIAL_ITEMS_COUNT} in più)
              </Button>
            )}
          </div>
        );
      })}

      {filter !== "all" && counts[filter] === 0 && (
        <p className="text-center text-sm text-muted-foreground py-2">Nessun compito in questo stato</p>
      )}

      <p className="text-xs text-muted-foreground">Tocca un compito per vedere scadenza, voto e commento dell'insegnante.</p>

      <Drawer open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DrawerContent>
          {selected && <HomeworkDetail lesson={selected} />}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function statusStyle(status: HomeworkItem["computedStatus"]) {
  switch (status) {
    case "submitted":
    case "graded":
      return { card: "bg-green-500/10 border-green-500/30", text: "text-green-700 dark:text-green-400", Icon: CheckCircle2 };
    case "missing":
      return { card: "bg-red-500/10 border-red-500/30", text: "text-red-700 dark:text-red-400", Icon: XCircle };
    default:
      return { card: "bg-muted/30 border-muted", text: "text-muted-foreground", Icon: Minus };
  }
}

function HomeworkCell({ lesson, onOpen }: { lesson: HomeworkItem; onOpen: () => void }) {
  const { card, text, Icon } = statusStyle(lesson.computedStatus);
  const hasGrade = lesson.computedStatus === "graded" && lesson.grade !== undefined;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Lezione ${lesson.lessonNumber}: ${lesson.homeworkTitle ?? "compito"}, ${STATUS_LABEL[lesson.computedStatus]}`}
      className={cn("p-2 rounded-lg border text-center min-h-[72px] active:scale-[0.97] transition-transform", card)}
    >
      <span className={cn("block text-xs font-semibold", text)}>L{lesson.lessonNumber}</span>
      {hasGrade ? (
        <span className={cn("block text-sm font-bold mt-1", text)}>{lesson.grade}%</span>
      ) : (
        <Icon className={cn("w-4 h-4 mx-auto mt-1", text)} aria-hidden="true" />
      )}
      {lesson.dueDate && (
        <span className={cn("block text-[11px] mt-1", lesson.computedStatus === "missing" ? text : "text-muted-foreground")}>
          {shortDate(lesson.dueDate)}
        </span>
      )}
    </button>
  );
}

function HomeworkDetail({ lesson }: { lesson: HomeworkItem }) {
  const { text } = statusStyle(lesson.computedStatus);
  return (
    <div className="mx-auto w-full max-w-md pb-[env(safe-area-inset-bottom)]">
      <DrawerHeader className="text-left">
        <DrawerTitle>{lesson.homeworkTitle ?? "Compito"}</DrawerTitle>
        <DrawerDescription>
          Lezione {lesson.lessonNumber}
          {lesson.lessonTitle && lesson.lessonTitle !== `Lezione ${lesson.lessonNumber}` ? ` · ${lesson.lessonTitle}` : ""}
        </DrawerDescription>
      </DrawerHeader>
      <dl className="px-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Stato</dt>
          <dd className={cn("font-medium", text)}>{STATUS_LABEL[lesson.computedStatus]}</dd>
        </div>
        {lesson.dueDate && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Scadenza</dt>
            <dd>{format(new Date(lesson.dueDate.length === 10 ? `${lesson.dueDate}T12:00:00` : lesson.dueDate), "EEEE d MMMM", { locale: it })}</dd>
          </div>
        )}
        {lesson.submittedAt && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Consegnato il</dt>
            <dd>{format(new Date(lesson.submittedAt), "d MMMM, HH:mm", { locale: it })}</dd>
          </div>
        )}
        {lesson.grade !== undefined && lesson.computedStatus === "graded" && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Voto</dt>
            <dd>
              <Badge variant="outline" className={cn(
                lesson.grade >= 80 ? "border-green-500 text-green-700 dark:text-green-400" :
                lesson.grade >= 60 ? "border-yellow-500 text-yellow-700 dark:text-yellow-400" :
                "border-red-500 text-red-700 dark:text-red-400",
              )}>
                {lesson.grade}%
              </Badge>
            </dd>
          </div>
        )}
      </dl>
      {lesson.teacherFeedback && (
        <div className="mx-4 mt-4 rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Commento dell'insegnante</p>
          <p className="text-sm whitespace-pre-line">{lesson.teacherFeedback}</p>
        </div>
      )}
      <DrawerFooter>
        <DrawerClose asChild>
          <Button variant="outline" className="min-h-[44px]">Chiudi</Button>
        </DrawerClose>
      </DrawerFooter>
    </div>
  );
}
