import { useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { CheckCircle2, Info, Loader2, Map as MapIcon, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SkillAssessmentDialog } from '@/components/skills/SkillAssessmentDialog';
import { useSkillMap } from '@/hooks/useSkillMap';
import { cn } from '@/lib/utils';
import {
  DIGCOMP_COMPETENCES,
  buildSkillMap,
  digcompSummary,
  evidenceText,
  isRelevant,
  levelInfo,
  nextStepText,
  type SkillLevel,
  type SkillMapEntry,
} from '@/lib/skillMap';

export type SkillMapVariant = 'student' | 'parent' | 'teacher';

/** Le descrizioni dei livelli parlano allo studente in seconda persona. */
const STUDENT_LEVEL_TEXT: Record<SkillLevel, string> = {
  0: 'Lo scoprirai nelle prossime lezioni.',
  1: 'Lo conosci e lo usi con un po’ di aiuto.',
  2: 'Lo usi da solo per risolvere problemi.',
  3: 'Lo usi con sicurezza e puoi aiutare gli altri.',
};

export const SKILL_MAP_DISCLAIMER =
  'Indicazione basata sulle lezioni e sui compiti svolti, allineata al quadro europeo delle competenze digitali DigComp 2.2: non è una certificazione.';

/** Tre tacche sulla stessa tinta: piene fino al livello, il binario è la tinta più chiara. */
export function SkillLevelMeter({ level, className }: { level: SkillLevel; className?: string }) {
  const info = levelInfo(level);
  return (
    <div
      role="img"
      aria-label={`Livello ${info.label}${level > 0 ? ` (${level} su 3)` : ''}`}
      className={cn('flex gap-0.5', className)}
    >
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          className={cn('h-2 flex-1 rounded-[4px]', step <= level ? 'bg-primary' : 'bg-primary/15')}
        />
      ))}
    </div>
  );
}

function LevelLabel({ level }: { level: SkillLevel }) {
  const info = levelInfo(level);
  return (
    <span className="text-sm">
      <span className={cn('font-medium', level === 0 && 'text-muted-foreground')}>{info.label}</span>
      {info.digcomp && <span className="text-muted-foreground"> · DigComp {info.digcomp}</span>}
    </span>
  );
}

function WhyPopover({ entry, variant }: { entry: SkillMapEntry; variant: SkillMapVariant }) {
  const e = entry.evidence;
  const next = nextStepText(entry);
  const levelText = variant === 'student' ? STUDENT_LEVEL_TEXT[entry.level] : levelInfo(entry.level).description;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" aria-label={`Perché questo livello in ${entry.concept.label}?`}>
          <Info className="w-4 h-4" aria-hidden="true" />
          <span className="ml-1 text-xs">Perché?</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm space-y-2" align="end">
        <p className="font-semibold">
          {entry.concept.emoji} {entry.concept.label}: {levelInfo(entry.level).label}
        </p>
        <p className="text-muted-foreground">{levelText}</p>
        {entry.confirmed && e ? (
          <div className="rounded-md bg-muted p-2 space-y-1">
            <p>
              Confermato da {e.assessed_by_name ?? 'un insegnante'}
              {e.assessed_at && ` il ${format(new Date(e.assessed_at), 'd MMMM yyyy', { locale: it })}`}.
            </p>
            {e.teacher_note && <p className="italic">“{e.teacher_note}”</p>}
            {entry.autoLevel !== entry.level && (
              <p className="text-xs text-muted-foreground">Dalle attività risulterebbe: {levelInfo(entry.autoLevel).label}.</p>
            )}
          </div>
        ) : null}
        <p>{evidenceText(entry)}</p>
        {next && <p className="text-muted-foreground">{next}</p>}
      </PopoverContent>
    </Popover>
  );
}

function ConceptTile({
  entry,
  variant,
  onEdit,
}: {
  entry: SkillMapEntry;
  variant: SkillMapVariant;
  onEdit?: (entry: SkillMapEntry) => void;
}) {
  return (
    <li
      className={cn('rounded-lg border bg-card p-3 flex flex-col gap-2', entry.level === 0 && 'bg-muted/40')}
      data-testid={`skill-${entry.concept.id}`}
    >
      <div className="flex items-start gap-2">
        <span className="text-xl leading-none" aria-hidden="true">{entry.concept.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{entry.concept.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{entry.concept.description}</p>
        </div>
      </div>
      <SkillLevelMeter level={entry.level} />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <LevelLabel level={entry.level} />
        {entry.confirmed && (
          <Badge variant="secondary" className="gap-1 font-normal">
            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
            Confermato dall’insegnante
          </Badge>
        )}
        <div className="ml-auto flex items-center">
          <WhyPopover entry={entry} variant={variant} />
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => onEdit(entry)}
              aria-label={`Valuta ${entry.concept.label}`}
            >
              <Pencil className="w-4 h-4" aria-hidden="true" />
              <span className="ml-1 text-xs">Valuta</span>
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/** Mappa già calcolata: concetti raggruppati per competenza DigComp. */
export function SkillMapView({
  entries,
  variant,
  onEdit,
}: {
  entries: SkillMapEntry[];
  variant: SkillMapVariant;
  onEdit?: (entry: SkillMapEntry) => void;
}) {
  const summary = digcompSummary(entries);
  const shown = entries.filter(isRelevant);
  // Vista insegnante: gli argomenti fuori dai suoi corsi restano valutabili, in una riga compatta
  const others = entries.filter((e) => !isRelevant(e));
  const competences = DIGCOMP_COMPETENCES.filter((c) => shown.some((e) => e.concept.digcomp === c.id));

  return (
    <div className="space-y-5" data-testid="skill-map">
      {shown.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nessuna lezione dei suoi corsi è ancora collegata a un argomento della mappa.
        </p>
      )}
      {competences.map((competence) => {
        const s = summary.find((x) => x.competence.id === competence.id);
        return (
          <section key={competence.id} aria-labelledby={`digcomp-${competence.id}`} className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">DigComp {competence.id}</p>
                <h4 id={`digcomp-${competence.id}`} className="font-semibold">{competence.title}</h4>
              </div>
              {s && (
                <div className="flex items-center gap-2" data-testid={`digcomp-${competence.id}-level`}>
                  <SkillLevelMeter level={s.level} className="w-16" />
                  <LevelLabel level={s.level} />
                </div>
              )}
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown
                .filter((e) => e.concept.digcomp === competence.id)
                .map((entry) => (
                  <ConceptTile key={entry.concept.id} entry={entry} variant={variant} onEdit={onEdit} />
                ))}
            </ul>
          </section>
        );
      })}
      {onEdit && others.length > 0 && (
        <section aria-labelledby="skill-map-others" className="space-y-2" data-testid="skill-map-others">
          <div>
            <h4 id="skill-map-others" className="font-semibold">Altri argomenti</h4>
            <p className="text-sm text-muted-foreground">Non ancora nelle lezioni dei suoi corsi: se li ha imparati altrove puoi valutarli lo stesso.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {others.map((entry) => (
              <Button
                key={entry.concept.id}
                variant="outline"
                size="sm"
                className="h-8 rounded-full"
                onClick={() => onEdit(entry)}
                aria-label={`Valuta ${entry.concept.label}`}
              >
                {entry.concept.emoji} {entry.concept.label}
              </Button>
            ))}
          </div>
        </section>
      )}
      <p className="text-xs text-muted-foreground">{SKILL_MAP_DISCLAIMER}</p>
    </div>
  );
}

/**
 * Scheda con la mappa di uno studente. Per studente e genitore resta nascosta
 * finché non c'è niente da mostrare; l'insegnante vede tutto il catalogo e,
 * con `editable`, può confermare o cambiare i livelli.
 */
export function SkillMapCard({
  studentId,
  studentName,
  variant,
  editable = false,
  className,
}: {
  studentId: string;
  studentName?: string;
  variant: SkillMapVariant;
  editable?: boolean;
  className?: string;
}) {
  const { data, isLoading } = useSkillMap(studentId);
  const [editing, setEditing] = useState<SkillMapEntry | null>(null);

  if (isLoading && variant === 'teacher') {
    return (
      <SkillMapShell variant={variant} className={className}>
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </SkillMapShell>
    );
  }
  if (!data) return null;
  const entries = buildSkillMap(data, { includeAll: variant === 'teacher' });
  if (variant !== 'teacher' && entries.length === 0) return null;

  return (
    <SkillMapShell variant={variant} className={className}>
      <SkillMapView entries={entries} variant={variant} onEdit={editable ? setEditing : undefined} />
      {editable && (
        <SkillAssessmentDialog
          studentId={studentId}
          studentName={studentName}
          entry={editing}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </SkillMapShell>
  );
}

function SkillMapShell({ variant, className, children }: { variant: SkillMapVariant; className?: string; children: ReactNode }) {
  const student = variant === 'student';
  return (
    <Card className={className} id={student ? 'competenze' : undefined} data-testid={`skill-map-card-${variant}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapIcon className="w-5 h-5 text-primary" aria-hidden="true" />
          {student ? 'La mia mappa delle competenze' : 'Mappa delle competenze'}
        </CardTitle>
        <CardDescription>
          {student
            ? 'Ecco cosa sai fare con il coding. Ogni lezione e ogni compito ti fanno salire di livello!'
            : 'Livello per argomento in tutti i corsi, dalle lezioni e dai compiti. Con «Valuta» puoi confermarlo o cambiarlo: il tuo livello vince sul calcolo automatico.'}
        </CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
