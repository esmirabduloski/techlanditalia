import { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  type AiConsent,
  type AiConsentEvent,
  type AiDecidedAs,
  aiConsentStatus,
  aiDecisionText,
  aiErrorMessage,
  fetchAiConsentEvents,
  fetchAiConsentVersion,
  fetchAiConsents,
  fetchBirthYears,
  setAiConsent,
} from '@/lib/aiConsents';

type Student = { id: string; name: string; parentName: string | null };

const DECIDED_AS: Record<AiDecidedAs, string> = {
  parent: 'dal genitore',
  student: 'dallo studente',
  admin: 'dalla segreteria',
};

/**
 * Consenso agli strumenti AI (L. 132/2025, art. 4 c. 4) nella pagina dei
 * consensi. Lo danno il genitore o lo studente dai 14 anni; l'admin può solo
 * registrare una revoca arrivata per email o telefono.
 */
export function AiConsentsAdminCard({ students }: { students: Student[] }) {
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState<string | null>(null);
  const [consents, setConsents] = useState<Map<string, AiConsent>>(new Map());
  const [birthYears, setBirthYears] = useState<Map<string, number>>(new Map());
  const [events, setEvents] = useState<AiConsentEvent[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [v, c, b, e] = await Promise.all([
      fetchAiConsentVersion(),
      fetchAiConsents(),
      fetchBirthYears(),
      fetchAiConsentEvents(),
    ]);
    setVersion(v);
    setConsents(c);
    setBirthYears(b);
    setEvents(e);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const studentName = new Map(students.map((s) => [s.id, s.name]));
  const active = students.filter((s) => aiConsentStatus(consents.get(s.id), version) === 'granted').length;

  const recordRevocation = async (student: Student) => {
    const { error } = await setAiConsent(student.id, false, version);
    if (error) {
      toast.error('Revoca non registrata', { description: aiErrorMessage(error) });
      return;
    }
    toast.success(`Revoca registrata per ${student.name}`);
    load();
  };

  return (
    <Card data-testid="ai-consents-admin">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> Strumenti AI
        </CardTitle>
        <CardDescription>
          Sotto i 14 anni il consenso lo dà il genitore, dai 14 anche lo studente (L. 132/2025). Senza consenso lo
          studente non vede gli strumenti AI e le funzioni AI rifiutano le sue richieste.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        ) : !version ? (
          <p className="text-sm text-muted-foreground">
            Nessuno strumento AI attivo: il consenso si chiederà ai genitori quando ne aggiungeremo uno.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {active} su {students.length} con strumenti AI attivi · informativa in vigore: {version}
            </p>
            <div className="divide-y">
              {students.map((s) => {
                const consent = consents.get(s.id);
                const status = aiConsentStatus(consent, version);
                const year = birthYears.get(s.id);
                return (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.parentName ? `Genitore: ${s.parentName} · ` : ''}
                        {year ? `Nato nel ${year}` : 'Anno di nascita non indicato'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={status === 'revoked' ? 'destructive' : 'outline'}
                        className={status === 'granted' ? 'bg-primary/15 text-primary hover:bg-primary/15' : undefined}
                      >
                        {aiDecisionText(consent, version, { id: '', studentName: s.name })}
                      </Badge>
                      {status === 'granted' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">Registra revoca</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Registrare la revoca?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Usalo quando arriva per email o telefono la richiesta di disattivare gli strumenti AI per{' '}
                                {s.name}, dal genitore o dallo studente se ha almeno 14 anni. Potranno riattivarli solo
                                loro dalla propria area.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction onClick={() => recordRevocation(s)}>Registra revoca</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {events.length > 0 && (
          <div className="space-y-2 border-t pt-3 text-sm">
            <p className="font-medium">Ultime modifiche</p>
            {events.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{studentName.get(e.student_id) ?? 'Studente'}</span>
                <span className="text-muted-foreground">
                  {e.granted ? 'Attivati' : 'Disattivati'} {DECIDED_AS[e.decided_as] ?? ''} il{' '}
                  {format(parseISO(e.decided_at), 'dd/MM/yyyy HH:mm')}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
