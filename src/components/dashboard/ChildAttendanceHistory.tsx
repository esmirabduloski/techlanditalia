import { useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarCheck, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChildAttendance } from "@/hooks/useChildProgressData";

const INITIAL_ITEMS_COUNT = 8;

interface ChildAttendanceHistoryProps {
  childId: string;
  childName?: string;
  groupIds?: string[];
  /** Senza card e titolo: dentro una sezione dell'area genitore che fa già da titolo. */
  embedded?: boolean;
}

export function ChildAttendanceHistory({ childId, childName, groupIds, embedded = false }: ChildAttendanceHistoryProps) {
  const { data, isLoading, error, refetch } = useChildAttendance(childId, groupIds);
  const [showAll, setShowAll] = useState(false);

  const wrap = (content: ReactNode) =>
    embedded ? (
      <>{content}</>
    ) : (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Storico Presenze{childName ? ` di ${childName}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    );

  if (isLoading) {
    return wrap(
      <div className="py-6 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>,
    );
  }

  if (error) {
    return wrap(
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{(error as Error).message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Riprova
        </Button>
      </div>,
    );
  }

  const byCourse = data?.byCourse ?? {};
  const stats = data!.stats;
  if (Object.keys(byCourse).length === 0) {
    return wrap(<p className="text-center text-muted-foreground py-4">Nessuna presenza registrata</p>);
  }

  const multipleCourses = Object.keys(byCourse).length > 1;

  return wrap(
    <>
      {/* Riepilogo: 2 colonne sul telefono, 4 da tablet in su */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className="text-center p-2 bg-muted/50 rounded-lg">
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Svolte</p>
        </div>
        <div className="text-center p-2 bg-green-500/10 rounded-lg">
          <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.present}</p>
          <p className="text-xs text-muted-foreground">Presenze</p>
        </div>
        <div className="text-center p-2 bg-red-500/10 rounded-lg">
          <p className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.absent}</p>
          <p className="text-xs text-muted-foreground">Assenze</p>
        </div>
        <div className="text-center p-2 bg-yellow-500/10 rounded-lg">
          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{stats.justified}</p>
          <p className="text-xs text-muted-foreground">Giustificate</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">Percentuale presenza</span>
          <span className={cn(
            "font-medium",
            stats.percentage >= 80 ? "text-green-700 dark:text-green-400" :
            stats.percentage >= 60 ? "text-yellow-700 dark:text-yellow-400" : "text-red-700 dark:text-red-400",
          )}>
            {stats.percentage}%
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              stats.percentage >= 80 ? "bg-green-500" : stats.percentage >= 60 ? "bg-yellow-500" : "bg-red-500",
            )}
            style={{ width: `${stats.percentage}%` }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(byCourse).map(([courseTitle, lessons]) => {
          const display = showAll ? lessons : lessons.slice(0, INITIAL_ITEMS_COUNT);
          return (
            <div key={courseTitle} className="space-y-2">
              {multipleCourses && <h4 className="font-medium text-foreground text-sm">{courseTitle}</h4>}
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {display.map((lesson) => (
                  <div
                    key={`${courseTitle}-${lesson.lessonNumber}`}
                    className={cn(
                      "p-2 rounded-lg border text-center",
                      lesson.status === 'present' && "bg-green-500/10 border-green-500/30",
                      lesson.status === 'absent' && "bg-red-500/10 border-red-500/30",
                      lesson.status === 'justified' && "bg-yellow-500/10 border-yellow-500/30",
                      lesson.status === 'pending' && "bg-muted/30 border-muted",
                    )}
                    title={lesson.lessonTitle || `Lezione ${lesson.lessonNumber}`}
                  >
                    <p className={cn(
                      "text-xs font-semibold",
                      lesson.status === 'present' && "text-green-700 dark:text-green-400",
                      lesson.status === 'absent' && "text-red-700 dark:text-red-400",
                      lesson.status === 'justified' && "text-yellow-700 dark:text-yellow-400",
                      lesson.status === 'pending' && "text-muted-foreground",
                    )}>
                      L{lesson.lessonNumber}
                    </p>
                    {lesson.status === 'present' && <CheckCircle2 className="w-4 h-4 mx-auto mt-1 text-green-600" aria-label="Presente" />}
                    {lesson.status === 'absent' && <XCircle className="w-4 h-4 mx-auto mt-1 text-red-600" aria-label="Assente" />}
                    {lesson.status === 'justified' && (
                      <Badge className="text-[11px] mt-1 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-0" aria-label="Giustificato">G</Badge>
                    )}
                    {lesson.status === 'pending' && <Clock className="w-4 h-4 mx-auto mt-1 text-muted-foreground/60" aria-label="Programmata" />}
                  </div>
                ))}
              </div>
              {lessons.length > INITIAL_ITEMS_COUNT && !showAll && (
                <Button variant="outline" className="w-full gap-2" onClick={() => setShowAll(true)}>
                  <ChevronDown className="w-4 h-4" />
                  Mostra tutte ({lessons.length - INITIAL_ITEMS_COUNT} in più)
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-3 border-t text-xs text-muted-foreground">
        <Legend className="bg-green-500/30 border-green-500/50" label="Presente" />
        <Legend className="bg-red-500/30 border-red-500/50" label="Assente" />
        <Legend className="bg-yellow-500/30 border-yellow-500/50" label="Giustificato" />
        <Legend className="bg-muted/50 border-muted" label="Programmata" />
      </div>
    </>,
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("w-3 h-3 rounded border", className)} />
      {label}
    </span>
  );
}
