import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AiToolsList } from '@/components/ai/AiToolsList';
import {
  type ChildAiState,
  aiConsentStatus,
  aiDecisionText,
  aiErrorMessage,
  birthYearOptions,
  canSelfConsent,
  fetchChildrenAiState,
  setAiConsent,
  setBirthYear,
} from '@/lib/aiConsents';

function birthYearHint(birthYear: number | null) {
  if (!birthYear) return 'Ci serve per sapere da quando potrà decidere anche da solo (dai 14 anni).';
  if (canSelfConsent(birthYear)) return 'Ha almeno 14 anni: può decidere anche da solo dalla sua area.';
  return "Fino all'anno dopo i 14 anni decidi tu.";
}

/**
 * Consenso agli strumenti AI dei figli, solo per i genitori (L. 132/2025,
 * art. 4 c. 4). Compare quando esiste il primo strumento AI. Con l'anno di
 * nascita il genitore indica anche da quando il figlio può decidere da solo.
 */
export function AiConsentCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<{ version: string; children: ChildAiState[] } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setState(await fetchChildrenAiState(user.id));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user || !state) return null;

  const save = async (key: string, action: () => PromiseLike<{ error: unknown }>, done: string) => {
    setSaving(key);
    const { error } = await action();
    setSaving(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Non è stato possibile salvare', description: aiErrorMessage(error) });
      return;
    }
    toast({ title: done });
    await load();
  };

  return (
    <Card data-testid="ai-consent-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5 text-primary" /> Strumenti di intelligenza artificiale
        </CardTitle>
        <CardDescription className="space-y-2">
          <span className="block">
            Alcune attività usano strumenti di intelligenza artificiale. Per legge (L. 132/2025) sotto i 14 anni serve
            il tuo consenso; dai 14 anni tuo figlio può decidere anche da solo e vale l&apos;ultima decisione presa.
          </span>
          <span className="block">
            È facoltativo: senza consenso partecipa normalmente alle lezioni, solo senza questi strumenti. Puoi
            disattivarli quando vuoi.{' '}
            <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
          </span>
        </CardDescription>
        <AiToolsList />
      </CardHeader>
      <CardContent className="space-y-4">
        {state.children.map((child) => {
          const status = aiConsentStatus(child.consent, state.version);
          const switchId = `ai-consent-${child.id}`;
          const yearId = `ai-birth-year-${child.id}`;
          return (
            <div key={child.id} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <label htmlFor={switchId} className="text-sm font-medium text-foreground cursor-pointer">
                    {child.full_name ?? 'Studente'}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {aiDecisionText(child.consent, state.version, { id: user.id, studentName: child.full_name })}
                  </p>
                </div>
                {saving === `consent:${child.id}` ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground shrink-0" />
                ) : (
                  <Switch
                    id={switchId}
                    checked={status === 'granted'}
                    disabled={saving !== null}
                    onCheckedChange={(checked) =>
                      save(
                        `consent:${child.id}`,
                        () => setAiConsent(child.id, checked, state.version),
                        checked ? 'Strumenti AI attivati' : 'Strumenti AI disattivati',
                      )
                    }
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label htmlFor={yearId} className="text-muted-foreground">Anno di nascita</label>
                <Select
                  value={child.birthYear ? String(child.birthYear) : undefined}
                  disabled={saving !== null}
                  onValueChange={(value) =>
                    save(`year:${child.id}`, () => setBirthYear(child.id, Number(value)), 'Anno di nascita salvato')
                  }
                >
                  <SelectTrigger id={yearId} className="h-8 w-28">
                    <SelectValue placeholder="Scegli" />
                  </SelectTrigger>
                  <SelectContent>
                    {birthYearOptions().map((year) => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">{birthYearHint(child.birthYear)}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
