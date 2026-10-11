import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  fetchPendingConsents,
  formatVersionDate,
  LEGAL_DOCUMENTS,
  recordConsents,
  summarizePending,
  type PendingConsent,
} from '@/lib/legalConsents';

/** Mostra i figli solo quando il genitore ha accettato tutto. Per chi non è genitore non c'è nulla in sospeso. */
export default function ConsentCheck({ userId, children }: { userId: string; children: ReactNode }) {
  const { data: pending, isLoading, error } = useQuery({
    queryKey: ['pending-legal-consents', userId],
    queryFn: fetchPendingConsents,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  // Se il controllo fallisce non si blocca l'area riservata: si riproverà al prossimo accesso.
  if (error) console.warn('[consensi] controllo non riuscito', error);
  if (error || !pending?.length) return <>{children}</>;
  return <ConsentScreen userId={userId} pending={pending} />;
}

function ConsentScreen({ userId, pending }: { userId: string; pending: PendingConsent[] }) {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const { documents, children } = summarizePending(pending);
  const [isGuardian, setIsGuardian] = useState(false);
  const [accepts, setAccepts] = useState(false);

  const accept = useMutation({
    mutationFn: () => recordConsents(pending),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['pending-legal-consents', userId] }),
  });

  const canSubmit = accepts && (children.length === 0 || isGuardian) && !accept.isPending;
  const names = children.map((c) => c.name).join(', ');

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <FileCheck2 className="mx-auto mb-2 h-10 w-10 text-primary" />
          <CardTitle>Prima di continuare</CardTitle>
          <CardDescription>
            {children.length > 0
              ? 'I tuoi figli sono minorenni: per loro i documenti li accetti tu. Registriamo data, versione e per quale figlio.'
              : 'Abbiamo aggiornato i documenti che regolano il servizio. Registriamo data e versione accettata.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ul className="space-y-2">
            {documents.map((d) => (
              <li key={d.document} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <a
                  href={LEGAL_DOCUMENTS[d.document].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {LEGAL_DOCUMENTS[d.document].label}
                </a>
                <span className="text-muted-foreground">versione del {formatVersionDate(d.published_at)}</span>
              </li>
            ))}
          </ul>

          {children.length > 0 && (
            <div className="flex items-start gap-3">
              <Checkbox id="consent-guardian" checked={isGuardian} onCheckedChange={(v) => setIsGuardian(v === true)} />
              <Label htmlFor="consent-guardian" className="text-sm font-normal leading-snug">
                Dichiaro di esercitare la responsabilità genitoriale (o la tutela) su <strong>{names}</strong> e di accettare
                per loro conto.
              </Label>
            </div>
          )}
          <div className="flex items-start gap-3">
            <Checkbox id="consent-accept" checked={accepts} onCheckedChange={(v) => setAccepts(v === true)} />
            <Label htmlFor="consent-accept" className="text-sm font-normal leading-snug">
              Ho letto l&apos;Informativa privacy e accetto i Termini e condizioni nelle versioni indicate.
            </Label>
          </div>

          {accept.isError && (
            <p role="alert" className="text-sm text-destructive">
              {accept.error instanceof Error ? accept.error.message : 'Non è stato possibile registrare il consenso.'} Riprova.
            </p>
          )}

          <Button className="w-full" disabled={!canSubmit} onClick={() => accept.mutate()}>
            {accept.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Accetto e continuo
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Se non accetti puoi scriverci o eliminare l&apos;account da{' '}
            <Link to="/area-riservata/profilo" className="text-primary hover:underline">
              Profilo
            </Link>
            .
          </p>
          <div className="border-t pt-4 text-center">
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Esci
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
