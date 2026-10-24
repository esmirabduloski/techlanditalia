import { Link } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarDays, KeyRound, Video, MessageCircle, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarDisplay } from "@/components/gamification/AvatarSelector";
import { getLevelFromPoints } from "@/components/gamification/LevelBadge";
import { cn } from "@/lib/utils";
import { formatObjectiveForParent } from "@/lib/lessonObjective";
import { localDateKey, nextLesson } from "@/lib/childProgress";
import {
  useChildAttendance,
  useChildBalance,
  useChildComments,
  useChildHomework,
  useChildSchedule,
} from "@/hooks/useChildProgressData";
import { LOW_BALANCE } from "@/components/dashboard/ParentPaymentHistory";

export type ChildSectionId = "certificazioni" | "calendario" | "compiti" | "presenze" | "saldo" | "commenti" | "competenze" | "percorso" | "traguardi";

interface ChildSummaryCardProps {
  child: { id: string; full_name: string; username: string | null; avatar_id: number; total_points: number };
  groupIds?: string[];
  courseIds?: string[];
  onOpenSection: (id: ChildSectionId) => void;
  onNewPassword?: () => void;
}

/**
 * «In breve»: le cose che un genitore guarda dal telefono, in una schermata.
 * Prossima lezione, lezioni rimaste, compiti mancanti, presenze e ultimo commento;
 * ogni numero apre la sezione di dettaglio. Usa le stesse query delle sezioni.
 */
export function ChildSummaryCard({ child, groupIds, courseIds, onOpenSection, onNewPassword }: ChildSummaryCardProps) {
  const level = getLevelFromPoints(child.total_points);
  const schedule = useChildSchedule(child.id, groupIds);
  const balance = useChildBalance(child.id);
  const homework = useChildHomework(child.id, courseIds);
  const attendance = useChildAttendance(child.id, groupIds);
  const comments = useChildComments(child.id);

  const today = localDateKey();
  const next = schedule.data ? nextLesson(schedule.data, today) : null;
  const isToday = next?.lesson_date === today;
  const time = next && (next.lesson_time || next.group.lesson_time)?.substring(0, 5);
  const objective = next ? formatObjectiveForParent(next.objective, false) : "";

  const lessonsLeft = balance.data?.balance;
  const missing = homework.data?.counts.missing;
  const pending = homework.data?.counts.pending ?? 0;
  const stats = attendance.data?.stats;
  const lastComment = comments.data?.[0];

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-4">
        {/* Chi è e a che livello è: una riga sola */}
        <div className="flex items-center gap-3">
          <AvatarDisplay avatarId={child.avatar_id} level={level.level} size="sm" showLevel={false} />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-lg leading-tight truncate">{child.full_name}</h3>
            <p className="text-sm text-muted-foreground truncate">
              Livello {level.level} {level.name} · {child.total_points} punti
            </p>
            {child.username && (
              <p className="text-xs text-muted-foreground truncate">Nome utente: {child.username}</p>
            )}
          </div>
        </div>

        {/* Prossima lezione */}
        <div className={cn("rounded-xl border p-3", isToday ? "border-primary bg-primary/10" : "bg-muted/40")}>
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
            {isToday ? "Lezione di oggi" : "Prossima lezione"}
          </p>
          {schedule.isLoading ? (
            <div className="h-6 mt-1 w-40 rounded bg-muted animate-pulse" />
          ) : next ? (
            <>
              <p className="font-semibold mt-1 capitalize">
                {format(new Date(`${next.lesson_date}T12:00:00`), "EEEE d MMMM", { locale: it })}
                {time && <span className="font-normal text-muted-foreground"> · ore {time}</span>}
              </p>
              {objective && <p className="text-sm text-muted-foreground mt-1">🎯 {objective}</p>}
              {isToday && next.group.student_meeting_link && (
                <Button asChild className="w-full mt-3 min-h-[44px]">
                  <a href={next.group.student_meeting_link} target="_blank" rel="noopener noreferrer">
                    <Video className="w-4 h-4 mr-2" />
                    Entra in lezione
                  </a>
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Nessuna lezione in programma</p>
          )}
        </div>

        {/* Tre numeri: ognuno porta al dettaglio */}
        <div className="grid grid-cols-3 gap-2">
          <StatTile
            label="Lezioni rimaste"
            value={lessonsLeft}
            tone={lessonsLeft !== undefined && lessonsLeft <= LOW_BALANCE ? "warn" : "neutral"}
            onClick={() => onOpenSection("saldo")}
          />
          <StatTile
            label={missing ? (missing === 1 ? "Compito mancante" : "Compiti mancanti") : pending ? (pending === 1 ? "Compito da fare" : "Compiti da fare") : "Compiti"}
            value={missing === undefined ? undefined : missing || pending || "✓"}
            tone={missing ? "bad" : pending ? "neutral" : "good"}
            onClick={() => onOpenSection("compiti")}
          />
          <StatTile
            label="Presenze"
            value={stats === undefined ? undefined : stats.total ? `${stats.percentage}%` : "—"}
            tone={!stats?.total ? "neutral" : stats.percentage >= 80 ? "good" : stats.percentage >= 60 ? "neutral" : "bad"}
            onClick={() => onOpenSection("presenze")}
          />
        </div>

        {lessonsLeft !== undefined && lessonsLeft <= LOW_BALANCE && (
          <Link
            to="/area-riservata/acquisti"
            className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm min-h-[44px]"
          >
            <span>{lessonsLeft === 0 ? "Lezioni esaurite" : `Restano solo ${lessonsLeft} ${lessonsLeft === 1 ? "lezione" : "lezioni"}`}: ricarica per non saltarne</span>
            <ChevronRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </Link>
        )}

        {/* Ultimo commento dell'insegnante */}
        {lastComment && (
          <button
            type="button"
            onClick={() => onOpenSection("commenti")}
            className="w-full text-left rounded-xl border p-3 hover:bg-muted/40 transition-colors"
          >
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
              {lastComment.author?.full_name || "Insegnante"} · {format(new Date(lastComment.created_at), "d MMM", { locale: it })}
            </p>
            <p className="text-sm mt-1 line-clamp-2">{lastComment.content}</p>
            <p className="text-xs text-primary font-medium mt-1">
              {(comments.data?.length ?? 0) > 1 ? `Leggi tutti i commenti (${comments.data!.length})` : "Apri i commenti"}
            </p>
          </button>
        )}

        {onNewPassword && (
          <Button variant="outline" size="sm" className="w-full min-h-[44px]" onClick={onNewPassword}>
            <KeyRound className="w-4 h-4 mr-2" />
            Nuova password
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StatTile({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number | string | undefined;
  tone: "good" | "bad" | "warn" | "neutral";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-2 text-center min-h-[76px] flex flex-col items-center justify-center active:scale-[0.97] transition-transform",
        tone === "good" && "bg-green-500/10 border-green-500/30",
        tone === "bad" && "bg-red-500/10 border-red-500/30",
        tone === "warn" && "bg-amber-500/10 border-amber-500/40",
        tone === "neutral" && "bg-card",
      )}
    >
      {value === undefined ? (
        <span className="h-7 w-8 rounded bg-muted animate-pulse" />
      ) : (
        <span className={cn(
          "text-2xl font-bold leading-none",
          tone === "good" && "text-green-700 dark:text-green-400",
          tone === "bad" && "text-red-700 dark:text-red-400",
          tone === "warn" && "text-amber-700 dark:text-amber-400",
        )}>
          {value}
        </span>
      )}
      <span className="text-xs text-muted-foreground mt-1 leading-tight">{label}</span>
    </button>
  );
}

