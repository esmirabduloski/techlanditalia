import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { STUDENT_RISK_RULES_KEY, type StudentRiskRules } from '@/lib/studentRisk';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: StudentRiskRules;
  onSaved: (rules: StudentRiskRules) => void;
}

type NumberKey = Exclude<keyof StudentRiskRules, 'enabled' | 'low_balance_threshold'>;

const clampInt = (value: string, min: number, max: number) =>
  Math.min(Math.max(parseInt(value, 10) || 0, min), max);

/** Soglie dell'avviso "studente a rischio abbandono". */
export function StudentRiskSettingsDialog({ open, onOpenChange, rules, onSaved }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState(rules);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(rules);
  }, [open, rules]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: STUDENT_RISK_RULES_KEY, value: draft, is_public: false }, { onConflict: 'key' });
    setSaving(false);
    if (error) {
      toast({ title: 'Errore salvataggio', description: error.message, variant: 'destructive' });
      return;
    }
    onSaved(draft);
    toast({ title: 'Soglie aggiornate', description: 'Valgono dal prossimo controllo.' });
    onOpenChange(false);
  };

  const field = (id: NumberKey, label: string, min: number, max: number) => (
    <div className="space-y-1.5">
      <Label htmlFor={`risk-${id}`}>{label}</Label>
      <Input
        id={`risk-${id}`}
        type="number"
        min={min}
        max={max}
        value={draft[id]}
        disabled={!draft.enabled}
        onChange={e => setDraft(d => ({ ...d, [id]: clampInt(e.target.value, min, max) }))}
      />
    </div>
  );

  const balanceOn = draft.low_balance_threshold !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Studenti a rischio abbandono</DialogTitle>
          <DialogDescription>
            Ogni mattina il CRM controlla presenze, compiti, streak e saldo lezioni e crea un'attività per chiamare la famiglia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="risk-enabled">Controllo attivo</Label>
            <Switch id="risk-enabled" checked={draft.enabled} onCheckedChange={enabled => setDraft(d => ({ ...d, enabled }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('absences_in_a_row', 'Assenze di fila', 1, 10)}
            {field('homework_missing_min', 'Compiti non consegnati', 1, 10)}
            {field('homework_window_days', 'Compiti scaduti negli ultimi (giorni)', 1, 90)}
            {field('streak_window_days', 'Streak azzerata negli ultimi (giorni)', 1, 90)}
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Le assenze giustificate non contano.</p>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="risk-balance-on" className="font-normal">
                Saldo lezioni basso
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Solo per gli studenti che hanno comprato pacchetti di lezioni
                </span>
              </Label>
              <Switch
                id="risk-balance-on"
                checked={balanceOn}
                disabled={!draft.enabled}
                onCheckedChange={on => setDraft(d => ({ ...d, low_balance_threshold: on ? 2 : null }))}
              />
            </div>
            {balanceOn && (
              <div className="space-y-1.5">
                <Label htmlFor="risk-balance">Avvisa quando restano al massimo (lezioni)</Label>
                <Input
                  id="risk-balance"
                  type="number"
                  min={0}
                  max={20}
                  value={draft.low_balance_threshold ?? 0}
                  disabled={!draft.enabled}
                  onChange={e => setDraft(d => ({ ...d, low_balance_threshold: clampInt(e.target.value, 0, 20) }))}
                />
              </div>
            )}
          </div>

          {field('cooldown_days', 'Dopo una chiamata, non riavvisare per gli stessi motivi per (giorni)', 0, 90)}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
