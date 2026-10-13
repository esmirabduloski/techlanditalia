import { Pause } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  PAUSE_REASON_LABELS,
  pausePeriodLabel,
  shortDate,
  type SubscriptionPause,
  type SubscriptionPauseWithStudent,
} from '@/lib/subscriptionPause';

/** Badge "IN PAUSA" per le famiglie con l'abbonamento sospeso. */
export function SubscriptionPauseBadge({
  pauses,
  className,
}: {
  pauses: SubscriptionPauseWithStudent[];
  className?: string;
}) {
  if (pauses.length === 0) return null;
  const title = pauses
    .map((p) => `${p.student?.full_name ?? 'Studente'}: ${PAUSE_REASON_LABELS[p.reason]}, ${pausePeriodLabel(p)}`)
    .join('\n');
  return (
    <Badge
      title={title}
      className={cn(
        'gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0 hover:bg-amber-500/15 font-semibold',
        className,
      )}
    >
      <Pause className="w-3 h-3" /> IN PAUSA
    </Badge>
  );
}

/** Pulsante accanto al saldo lezioni: "Pausa", oppure "In pausa fino al …". */
export function SubscriptionPauseButton({ pause, onClick }: { pause?: SubscriptionPause | null; onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      title={pause ? "Gestisci la pausa dell'abbonamento" : "Metti in pausa l'abbonamento (le lezioni non vengono scalate)"}
      className={pause ? 'border-amber-500/50 text-amber-700 dark:text-amber-300' : undefined}
    >
      <Pause className="w-4 h-4 mr-1" />
      {!pause ? 'Pausa' : pause.ends_on ? `In pausa fino al ${shortDate(pause.ends_on)}` : 'In pausa'}
    </Button>
  );
}
