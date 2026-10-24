import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChildCertificates, useChildTimeline } from "@/hooks/useChildProgressData";
import {
  buildTimeline,
  groupByMonth,
  timelineSummary,
  type TimelineEvent,
  type TimelineKind,
} from "@/lib/childTimeline";
import type { SkillMapEntry } from "@/lib/skillMap";
import type { ChildSectionId } from "@/components/dashboard/ChildSummaryCard";

/** Traguardi mostrati prima di «Mostra tutto»; il primo giorno resta sempre in fondo. */
const PREVIEW = 6;

/** Traguardi che portano alla sezione col dettaglio (attestato da scaricare, competenza, badge). */
const SECTION_BY_KIND: Partial<Record<TimelineKind, ChildSectionId>> = {
  certificate: "certificazioni",
  skill: "competenze",
  badge: "traguardi",
  streak: "traguardi",
};

interface TimelineChild {
  id: string;
  full_name: string;
  created_at?: string | null;
}

interface ChildTimelineProps {
  child: TimelineChild;
  skills: SkillMapEntry[];
  /** Sezioni presenti nella pagina: solo queste diventano link. */
  sections: ChildSectionId[];
  onOpenSection: (id: ChildSectionId) => void;
}

/** Stesse query della sezione e del suo riassunto: si scaricano una volta sola. */
function useTimeline(child: TimelineChild, skills: SkillMapEntry[]) {
  const sources = useChildTimeline(child.id);
  const certificates = useChildCertificates(child.id);
  if (!sources.data || certificates.isLoading) {
    return { isLoading: sources.isLoading || certificates.isLoading, isError: sources.isError, events: [], summary: null };
  }
  const input = {
    ...sources.data,
    firstName: child.full_name.split(" ")[0],
    createdAt: child.created_at,
    certificates: certificates.data ?? [],
    skills,
  };
  const events = buildTimeline(input);
  return { isLoading: false, isError: false, events, summary: timelineSummary(input, events) };
}

const day = (date: string, pattern: string) => format(new Date(`${date}T12:00:00`), pattern, { locale: it });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Numero di traguardi per l'intestazione della sezione. */
export function TimelineHint({ child, skills }: { child: TimelineChild; skills: SkillMapEntry[] }) {
  const { events } = useTimeline(child, skills);
  const count = events.filter((e) => e.kind !== "start").length;
  if (events.length === 0) return null;
  return <>{count ? plural(count, "traguardo", "traguardi") : "Appena iniziato"}</>;
}

/**
 * Linea del tempo dei progressi: tutti i traguardi del figlio dal primo giorno,
 * dal più recente, divisi per mese. In tutti i corsi, non solo in quello scelto.
 */
export function ChildTimeline({ child, skills, sections, onOpenSection }: ChildTimelineProps) {
  const { events, summary, isLoading, isError } = useTimeline(child, skills);
  const [showAll, setShowAll] = useState(false);
  const firstName = child.full_name.split(" ")[0];

  if (isLoading) {
    return (
      <div className="py-6 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-muted-foreground text-center py-4">Non riesco a caricare il percorso di {firstName}. Riprova tra poco.</p>;
  }

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">Il percorso di {firstName} comincia con la prima lezione.</p>;
  }

  const start = events.find((e) => e.kind === "start");
  const milestones = events.filter((e) => e.kind !== "start");
  const hidden = showAll ? 0 : Math.max(0, milestones.length - PREVIEW);
  // Tutto visibile: il primo giorno sta nel suo mese; altrimenti chiude l'elenco da solo
  const months = groupByMonth(hidden ? milestones.slice(0, PREVIEW) : events);
  const linkFor = (event: TimelineEvent) => {
    const section = SECTION_BY_KIND[event.kind];
    return section && sections.includes(section) ? () => onOpenSection(section) : undefined;
  };

  const counts = summary
    ? [
        summary.lessons > 0 && `📚 ${plural(summary.lessons, "lezione", "lezioni")}`,
        summary.homework > 0 && `📝 ${plural(summary.homework, "compito", "compiti")}`,
        summary.exercises > 0 && `💻 ${plural(summary.exercises, "esercizio", "esercizi")}`,
        summary.badges > 0 && `🏅 ${plural(summary.badges, "badge", "badge")}`,
        summary.certificates > 0 && `🎓 ${plural(summary.certificates, "attestato", "attestati")}`,
      ].filter((c): c is string => !!c)
    : [];

  return (
    <div className="space-y-4 pb-1" data-testid="parent-timeline">
      {summary?.since && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {firstName} è su TechLand dal {day(summary.since, "d MMMM yyyy")}.
            {milestones.length === 0 && " I traguardi compariranno qui, lezione dopo lezione."}
          </p>
          {counts.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="In tutto">
              {counts.map((c) => (
                <li key={c} className="rounded-full border bg-muted/40 px-3 py-1 text-sm">{c}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="relative">
        {/* Il filo della linea del tempo, dietro i pallini */}
        <div aria-hidden="true" className="absolute left-[19px] top-5 bottom-5 w-0.5 bg-border" />
        <div className="space-y-4">
          {months.map((m) => (
            <section key={m.month} aria-label={day(`${m.month}-01`, "MMMM yyyy")}>
              <h4 className="pl-14 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {day(`${m.month}-01`, "MMMM yyyy")}
              </h4>
              <ol className="space-y-1">
                {m.events.map((e) => (
                  <TimelineItem key={e.id} event={e} onOpen={linkFor(e)} />
                ))}
              </ol>
            </section>
          ))}

          {hidden > 0 && (
            <>
              <div className="pl-14">
                <Button variant="outline" className="w-full gap-2 min-h-[44px] h-auto whitespace-normal py-2" onClick={() => setShowAll(true)}>
                  <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                  Mostra tutto ({plural(hidden, "traguardo", "traguardi")} in più)
                </Button>
              </div>
              {start && (
                <ol>
                  <TimelineItem event={start} fullDate />
                </ol>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ event, onOpen, fullDate }: { event: TimelineEvent; onOpen?: () => void; fullDate?: boolean }) {
  const highlight = event.kind === "certificate" || event.kind === "start";
  const date = day(event.date, fullDate || event.kind === "start" ? "d MMMM yyyy" : "d MMM");
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-medium leading-snug">{event.title}</span>
        <span className="block text-sm text-muted-foreground leading-snug">
          <time dateTime={event.date}>{date}</time>
          {event.detail && <> · {event.detail}</>}
        </span>
      </span>
      {onOpen && <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </>
  );
  return (
    <li className="relative flex gap-4">
      <span
        aria-hidden="true"
        className={cn(
          "relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg",
          highlight ? "border-primary bg-primary/10" : "bg-card",
        )}
      >
        {event.emoji}
      </span>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-h-[48px] flex-1 items-center gap-2 rounded-lg px-2 -mx-2 py-1.5 text-left hover:bg-muted/60 transition-colors"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-h-[48px] flex-1 items-center gap-2 py-1.5">{body}</div>
      )}
    </li>
  );
}
