import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DUNNING_SETTINGS_KEY, type DunningSettings } from '@/lib/payments';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: DunningSettings;
  onSaved: (settings: DunningSettings) => void;
}

const clampInt = (value: string, min: number, max: number) =>
  Math.min(Math.max(parseInt(value, 10) || 0, min), max);

/** Regole dei solleciti automatici delle rate scadute. */
export function DunningSettingsDialog({ open, onOpenChange, settings, onSaved }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('site_settings')
      .upsert(
        { key: DUNNING_SETTINGS_KEY, value: { ...draft }, is_public: false },
        { onConflict: 'key' },
      );
    setSaving(false);
    if (error) {
      toast({ title: 'Errore salvataggio', description: error.message, variant: 'destructive' });
      return;
    }
    onSaved(draft);
    toast({ title: 'Regole dei solleciti aggiornate' });
    onOpenChange(false);
  };

  const field = (
    id: keyof Pick<DunningSettings, 'first_after_days' | 'repeat_every_days' | 'max_reminders'>,
    label: string,
    min: number,
    max: number,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`dunning-${id}`}>{label}</Label>
      <Input
        id={`dunning-${id}`}
        type="number"
        min={min}
        max={max}
        value={draft[id]}
        disabled={!draft.enabled}
        onChange={e => setDraft(d => ({ ...d, [id]: clampInt(e.target.value, min, max) }))}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solleciti automatici</DialogTitle>
          <DialogDescription>
            Se una rata non viene segnata come pagata, ogni mattina ti arriva una notifica per sollecitarla.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="dunning-enabled">Solleciti attivi</Label>
            <Switch
              id="dunning-enabled"
              checked={draft.enabled}
              onCheckedChange={enabled => setDraft(d => ({ ...d, enabled }))}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {field('first_after_days', 'Dopo quanti giorni', 0, 60)}
            {field('repeat_every_days', 'Ripeti ogni (giorni)', 1, 60)}
            {field('max_reminders', 'Quante volte al massimo', 1, 10)}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="dunning-client" className="font-normal">
              Manda il sollecito anche al cliente
              <span className="block text-xs text-muted-foreground mt-0.5">
                Solo per le rate con la notifica al cliente attiva e se il cliente ha le notifiche abilitate
              </span>
            </Label>
            <Switch
              id="dunning-client"
              checked={draft.notify_client}
              disabled={!draft.enabled}
              onCheckedChange={notify_client => setDraft(d => ({ ...d, notify_client }))}
            />
          </div>

          {draft.enabled && (
            <p className="text-sm text-muted-foreground rounded-lg bg-muted/50 p-3">
              Esempio: una rata scaduta il 1° del mese viene sollecitata il {1 + draft.first_after_days}
              {draft.max_reminders > 1 && <>, poi ogni {draft.repeat_every_days} giorni</>}, fino a {draft.max_reminders}{' '}
              {draft.max_reminders === 1 ? 'volta' : 'volte'}.
            </p>
          )}
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
