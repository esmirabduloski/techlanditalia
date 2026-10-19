import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useSkillAssessmentMutations } from '@/hooks/useSkillMap';
import {
  MAX_ASSESSMENT_NOTE_LENGTH,
  SKILL_LEVELS,
  evidenceText,
  isSkillLevel,
  levelInfo,
  type SkillLevel,
  type SkillMapEntry,
} from '@/lib/skillMap';

/** L'insegnante conferma o cambia il livello di un concetto; il suo livello vince sul calcolo. */
export function SkillAssessmentDialog({
  studentId,
  studentName,
  entry,
  onOpenChange,
}: {
  studentId: string;
  studentName?: string;
  entry: SkillMapEntry | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { save, reset } = useSkillAssessmentMutations(studentId);
  const [level, setLevel] = useState<SkillLevel>(0);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!entry) return;
    setLevel(entry.level);
    setNote(entry.confirmed ? entry.evidence?.teacher_note ?? '' : '');
  }, [entry]);

  const busy = save.isPending || reset.isPending;
  const firstName = studentName?.split(' ')[0];

  const onSave = async () => {
    if (!entry || !user) return;
    try {
      await save.mutateAsync({ concept: entry.concept.id, level, note: note.trim() || null, assessedBy: user.id });
      toast({ title: 'Livello salvato', description: `${entry.concept.label}: ${levelInfo(level).label}` });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Errore', description: (error as Error).message || 'Impossibile salvare il livello', variant: 'destructive' });
    }
  };

  const onReset = async () => {
    if (!entry) return;
    try {
      await reset.mutateAsync(entry.concept.id);
      toast({ title: 'Torna il calcolo automatico', description: `${entry.concept.label}: ${levelInfo(entry.autoLevel).label}` });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Errore', description: (error as Error).message || 'Impossibile ripristinare il livello', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {entry && (
          <>
            <DialogHeader>
              <DialogTitle>
                {entry.concept.emoji} {entry.concept.label}
                {firstName && ` · ${firstName}`}
              </DialogTitle>
              <DialogDescription>
                Calcolo automatico: <strong>{levelInfo(entry.autoLevel).label}</strong>. {evidenceText(entry)}
              </DialogDescription>
            </DialogHeader>

            <RadioGroup
              value={String(level)}
              onValueChange={(v) => {
                const n = Number(v);
                if (isSkillLevel(n)) setLevel(n);
              }}
              className="gap-2"
              aria-label="Livello"
            >
              {SKILL_LEVELS.map((info) => (
                <Label
                  key={info.level}
                  htmlFor={`skill-level-${info.level}`}
                  className="flex items-start gap-3 rounded-md border p-3 cursor-pointer font-normal has-[[data-state=checked]]:border-primary"
                >
                  <RadioGroupItem id={`skill-level-${info.level}`} value={String(info.level)} className="mt-0.5" />
                  <span>
                    <span className="font-medium">{info.label}</span>
                    {info.digcomp && <span className="text-muted-foreground"> · DigComp {info.digcomp}</span>}
                    <span className="block text-sm text-muted-foreground">{info.description}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>

            <div className="space-y-1">
              <Label htmlFor="skill-note">Nota per lo studente e la famiglia (facoltativa)</Label>
              <Textarea
                id="skill-note"
                value={note}
                maxLength={MAX_ASSESSMENT_NOTE_LENGTH}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Es. Usa i cicli con sicurezza anche nei progetti liberi."
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">{note.length}/{MAX_ASSESSMENT_NOTE_LENGTH}</p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              {entry.confirmed && (
                <Button variant="ghost" onClick={onReset} disabled={busy} className="sm:mr-auto">
                  Torna al calcolo automatico
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Annulla
              </Button>
              <Button onClick={onSave} disabled={busy || !user}>
                {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salva
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
