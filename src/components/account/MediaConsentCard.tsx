import { useCallback, useEffect, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  MEDIA_PURPOSES,
  type MediaConsent,
  type MediaPurpose,
  consentKey,
  consentStatus,
  fetchMediaConsents,
  formatConsentDate,
  setMediaConsent,
} from '@/lib/mediaConsents';

/**
 * Consensi foto e video dei figli, solo per i genitori: uno per finalità,
 * facoltativi e revocabili in qualsiasi momento con lo stesso interruttore.
 */
export function MediaConsentCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [children, setChildren] = useState<{ id: string; full_name: string | null }[] | null>(null);
  const [consents, setConsents] = useState<Map<string, MediaConsent>>(new Map());
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'parent') return;
    const { data: kids } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('parent_id', user.id)
      .eq('role', 'student');
    const list = kids ?? [];
    setConsents(await fetchMediaConsents(list.map((k) => k.id)));
    setChildren(list);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!children || children.length === 0) return null;

  const toggle = async (studentId: string, purpose: MediaPurpose, granted: boolean) => {
    const key = consentKey(studentId, purpose);
    setSaving(key);
    const { error } = await setMediaConsent(studentId, purpose, granted);
    setSaving(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Non è stato possibile salvare', description: 'Riprova o scrivici a info@techlanditalia.it' });
      return;
    }
    toast({ title: granted ? 'Consenso dato' : 'Consenso revocato' });
    setConsents(await fetchMediaConsents(children.map((k) => k.id)));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Camera className="w-5 h-5 text-primary" /> Foto e video
        </CardTitle>
        <CardDescription>
          Un consenso separato per ogni uso. Sono tutti facoltativi: se non li dai, tuo figlio partecipa normalmente
          e noi evitiamo di riprenderlo o lo rendiamo non riconoscibile. Puoi cambiare idea quando vuoi; la revoca vale
          da subito per le nuove pubblicazioni e rimuoviamo quanto già pubblicato.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {children.map((child) => (
          <div key={child.id} className="space-y-3">
            {children.length > 1 && <p className="font-medium text-foreground">{child.full_name ?? 'Studente'}</p>}
            {MEDIA_PURPOSES.map((p) => {
              const key = consentKey(child.id, p.id);
              const consent = consents.get(key);
              const status = consentStatus(consent);
              const id = `media-consent-${key}`;
              return (
                <div key={p.id} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                  <div className="space-y-1">
                    <label htmlFor={id} className="text-sm font-medium text-foreground cursor-pointer">
                      {p.label}
                    </label>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {status === 'granted' && consent && `Consenso dato il ${formatConsentDate(consent.decided_at)}`}
                      {status === 'revoked' && consent && `Revocato il ${formatConsentDate(consent.decided_at)}`}
                      {status === 'none' && 'Non dato'}
                    </p>
                  </div>
                  {saving === key ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground shrink-0" />
                  ) : (
                    <Switch
                      id={id}
                      checked={status === 'granted'}
                      disabled={saving !== null}
                      onCheckedChange={(checked) => toggle(child.id, p.id, checked)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
