import { useState } from "react";
import { CalendarOff, ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { romeToday } from "@/lib/courseProposal";
import { closureCountdown, closureDays, closureForBanner, formatClosureRange } from "@/lib/schoolClosures";
import { useUpcomingClosures } from "@/hooks/useSchoolClosures";

const INITIAL_COUNT = 4;
export const CLOSURES_ANCHOR = "chiusure";

/**
 * Calendario di chiusure e festività per il genitore: tutte quelle non ancora
 * finite, dalla più vicina. Se non ce ne sono (o la lettura fallisce) non mostra nulla.
 */
export function SchoolClosuresCard() {
  const { data: closures = [] } = useUpcomingClosures();
  const [showAll, setShowAll] = useState(false);
  if (closures.length === 0) return null;

  const today = romeToday();
  const visible = showAll ? closures : closures.slice(0, INITIAL_COUNT);

  return (
    <Card id={CLOSURES_ANCHOR} className="mb-8 scroll-mt-28">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarOff className="w-5 h-5 text-primary" />
          Chiusure e festività
        </CardTitle>
        <CardDescription>In questi giorni non ci sono lezioni.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2 list-none p-0 m-0">
          {visible.map((c) => {
            const countdown = closureCountdown(c, today);
            const days = closureDays(c);
            return (
              <li
                key={c.id}
                className={cn("rounded-xl border p-3", countdown ? "bg-primary/10 border-primary" : "bg-card border-border")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{c.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatClosureRange(c, today)}
                      {days > 1 && ` · ${days} giorni`}
                    </p>
                  </div>
                  {countdown && <Badge className="bg-primary text-primary-foreground shrink-0">{countdown}</Badge>}
                </div>
                {c.note && <p className="text-sm text-muted-foreground mt-2">{c.note}</p>}
              </li>
            );
          })}
        </ul>
        {closures.length > INITIAL_COUNT && !showAll && (
          <Button variant="outline" className="w-full gap-2 min-h-[44px]" onClick={() => setShowAll(true)}>
            <ChevronDown className="w-4 h-4" />
            Mostra tutte ({closures.length - INITIAL_COUNT} in più)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Avviso in cima all'area genitore per la chiusura in corso o che inizia entro una settimana. */
export function SchoolClosureBanner() {
  const { data: closures = [] } = useUpcomingClosures();
  const today = romeToday();
  const closure = closureForBanner(closures, today);
  if (!closure) return null;

  const countdown = closureCountdown(closure, today);
  return (
    <a
      href={`#${CLOSURES_ANCHOR}`}
      className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 no-underline text-foreground hover:bg-amber-500/15 transition-colors"
    >
      <CalendarOff className="w-5 h-5 mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {countdown === "In corso" ? "Lezioni sospese" : "Niente lezioni"}: {closure.title}
        </p>
        <p className="text-sm text-muted-foreground">{formatClosureRange(closure, today)}</p>
        {closure.note && <p className="text-sm text-muted-foreground mt-1">{closure.note}</p>}
      </div>
      {countdown && (
        <Badge variant="outline" className="shrink-0 border-amber-500/50 text-amber-700 dark:text-amber-400">
          {countdown}
        </Badge>
      )}
    </a>
  );
}
