import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MAX_THEME_NAME_LENGTH, groupHintText, type GroupHint, type SeasonalThemeDraft } from '@/lib/seasonalHomework';

export interface SeasonalLesson {
  id: string;
  course_id: string;
  lesson_number: number;
  title: string;
}

const NONE = '__none__';

function GroupHints({ hints }: { hints: GroupHint[] }) {
  if (hints.length === 0) {
    return <p className="text-xs text-muted-foreground">Nessun gruppo attivo con calendario per questo corso.</p>;
  }
  return (
    <ul className="list-none p-0 m-0 space-y-0.5 text-xs text-muted-foreground">
      {hints.map((h) => (
        <li key={h.groupId}>{groupHintText(h)}</li>
      ))}
    </ul>
  );
}

function LessonSelect({
  id,
  lessons,
  value,
  onChange,
  allowNone,
}: {
  id: string;
  lessons: SeasonalLesson[];
  value: string;
  onChange: (value: string) => void;
  allowNone?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Scegli la lezione" />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>Non inserire</SelectItem>}
        {lessons.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            L{l.lesson_number} · {l.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------

interface ThemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = nuovo tema */
  initial: SeasonalThemeDraft | null;
  onSave: (draft: SeasonalThemeDraft) => Promise<boolean>;
}

const EMPTY_THEME: SeasonalThemeDraft = { name: '', emoji: '✨', prompt: '', period_hint: '' };

export function ThemeDialog({ open, onOpenChange, initial, onSave }: ThemeDialogProps) {
  const [draft, setDraft] = useState<SeasonalThemeDraft>(EMPTY_THEME);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(initial ?? EMPTY_THEME);
  }, [open, initial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader className="pr-6">
            <DialogTitle>{initial ? 'Modifica tema' : 'Nuovo tema'}</DialogTitle>
            <DialogDescription>
              La richiesta standard è il punto di partenza di ogni corso: poi la personalizzi corso per corso.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[5rem_1fr] gap-3">
            <div className="space-y-2">
              <Label htmlFor="theme-emoji">Emoji</Label>
              <Input
                id="theme-emoji"
                value={draft.emoji}
                maxLength={8}
                className="text-center text-xl"
                onChange={(e) => setDraft((d) => ({ ...d, emoji: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="theme-name">Nome</Label>
              <Input
                id="theme-name"
                value={draft.name}
                maxLength={MAX_THEME_NAME_LENGTH}
                placeholder="Halloween"
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="theme-period">Periodo (facoltativo)</Label>
            <Input
              id="theme-period"
              value={draft.period_hint ?? ''}
              maxLength={60}
              placeholder="fine ottobre"
              onChange={(e) => setDraft((d) => ({ ...d, period_hint: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="theme-prompt">Richiesta standard</Label>
            <Textarea
              id="theme-prompt"
              value={draft.prompt}
              rows={4}
              maxLength={2000}
              placeholder="Crea una mappa, degli oggetti o un gioco a tema Halloween"
              onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {initial ? 'Salva tema' : 'Crea tema'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

interface PlaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseLabel: string;
  lessons: SeasonalLesson[];
  /** Lezione attuale (per "Sposta") o suggerita (per "Inserisci") */
  initialLessonId: string | null;
  initialDue: string;
  isMove: boolean;
  hints: GroupHint[];
  onSave: (lessonId: string, due: string) => Promise<boolean>;
}

export function PlaceDialog({ open, onOpenChange, courseLabel, lessons, initialLessonId, initialDue, isMove, hints, onSave }: PlaceDialogProps) {
  const [lessonId, setLessonId] = useState('');
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLessonId(initialLessonId ?? '');
      setDue(initialDue);
    }
  }, [open, initialLessonId, initialDue]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonId) return;
    setSaving(true);
    const ok = await onSave(lessonId, due);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader className="pr-6">
            <DialogTitle>{isMove ? 'Sposta in un\'altra lezione' : 'Inserisci in una lezione'}</DialogTitle>
            <DialogDescription>
              {courseLabel}: gli alunni lo vedono come compito per casa della lezione scelta, quando è l'ultima fatta dal loro gruppo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="place-lesson">Lezione</Label>
            {lessons.length === 0 ? (
              <p className="text-sm text-destructive">Questo corso non ha ancora lezioni.</p>
            ) : (
              <LessonSelect id="place-lesson" lessons={lessons} value={lessonId} onChange={setLessonId} />
            )}
          </div>
          <div className="rounded-lg bg-muted/60 p-3 space-y-1">
            <p className="text-xs font-medium">Dove sono i gruppi</p>
            <GroupHints hints={hints} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="place-due">Scadenza (facoltativa)</Label>
            <Input id="place-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={saving || !lessonId}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isMove ? 'Sposta' : 'Inserisci'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

export interface PlaceAllRow {
  homeworkId: string;
  courseLabel: string;
  lessons: SeasonalLesson[];
  /** Lezione attuale, o quella suggerita; null = non inserire */
  defaultLessonId: string | null;
  hints: GroupHint[];
}

interface PlaceAllDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  themeLabel: string;
  rows: PlaceAllRow[];
  onSave: (assignments: { homeworkId: string; lessonId: string }[], due: string) => Promise<boolean>;
}

export function PlaceAllDialog({ open, onOpenChange, themeLabel, rows, onSave }: PlaceAllDialogProps) {
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setChoice(Object.fromEntries(rows.map((r) => [r.homeworkId, r.defaultLessonId ?? NONE])));
      setDue('');
    }
  }, [open, rows]);

  const assignments = rows
    .map((r) => ({ homeworkId: r.homeworkId, lessonId: choice[r.homeworkId] ?? NONE }))
    .filter((a) => a.lessonId !== NONE);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (assignments.length === 0) return;
    setSaving(true);
    const ok = await onSave(assignments, due);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader className="pr-6">
            <DialogTitle>Inserisci {themeLabel} in tutti i corsi</DialogTitle>
            <DialogDescription>
              Per ogni corso è già scelta la prossima lezione della maggior parte dei gruppi: cambiala se serve, o scegli "Non inserire".
            </DialogDescription>
          </DialogHeader>
          <ul className="list-none p-0 m-0 space-y-4">
            {rows.map((r) => (
              <li key={r.homeworkId} className="space-y-1.5">
                <Label htmlFor={`place-all-${r.homeworkId}`} className="font-semibold">
                  {r.courseLabel}
                </Label>
                <LessonSelect
                  id={`place-all-${r.homeworkId}`}
                  lessons={r.lessons}
                  value={choice[r.homeworkId] ?? NONE}
                  onChange={(v) => setChoice((c) => ({ ...c, [r.homeworkId]: v }))}
                  allowNone
                />
                <GroupHints hints={r.hints} />
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="place-all-due">Scadenza per tutti (facoltativa)</Label>
            <Input id="place-all-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            <p className="text-xs text-muted-foreground">Se la lasci vuota, ogni compito tiene la sua.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={saving || assignments.length === 0}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Inserisci in {assignments.length === 1 ? '1 corso' : `${assignments.length} corsi`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
