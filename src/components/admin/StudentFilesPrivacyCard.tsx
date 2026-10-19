import { useState } from 'react';
import { CheckCircle2, FolderLock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { listLegacyStudentWebAssets, moveLegacyStudentWebAssets } from '@/lib/studentWebAssets';

type State =
  | { step: 'idle' }
  | { step: 'checking' }
  | { step: 'checked'; paths: string[] }
  | { step: 'moving'; total: number; done: number }
  | { step: 'moved'; moved: number; failed: string[] }
  | { step: 'error'; message: string };

/**
 * File degli studenti in spazi privati (migrazione 0055). Consegne e attestati
 * lo sono già; i file caricati nel compilatore web prima del passaggio sono
 * ancora nel bucket pubblico web-compiler-assets: qui l'admin li trova e li
 * sposta nel bucket privato, con lo stesso percorso (l'app li riconosce).
 */
export function StudentFilesPrivacyCard() {
  const [state, setState] = useState<State>({ step: 'idle' });
  const busy = state.step === 'checking' || state.step === 'moving';

  const check = async () => {
    setState({ step: 'checking' });
    try {
      setState({ step: 'checked', paths: await listLegacyStudentWebAssets(supabase) });
    } catch (e) {
      setState({ step: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const move = async (paths: string[]) => {
    setState({ step: 'moving', total: paths.length, done: 0 });
    const result = await moveLegacyStudentWebAssets(supabase, paths, (done) =>
      setState({ step: 'moving', total: paths.length, done }),
    );
    setState({ step: 'moved', ...result });
  };

  return (
    <Card data-testid="student-files-privacy">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderLock className="w-4 h-4 text-primary" /> File degli studenti
          </CardTitle>
          <Button size="sm" variant="outline" onClick={check} disabled={busy}>
            {state.step === 'checking' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Controlla
          </Button>
        </div>
        <CardDescription>
          Consegne dei compiti, attestati e file caricati nel compilatore web stanno in spazi privati: si aprono solo
          con link firmati, per lo studente, i suoi insegnanti e i genitori. Il controllo cerca i file caricati nel
          compilatore web prima del passaggio, ancora nello spazio pubblico.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {state.step === 'checked' && state.paths.length === 0 && (
          <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> Nessun file degli studenti nello spazio pubblico.
          </p>
        )}
        {state.step === 'checked' && state.paths.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 p-3">
            <span>
              <strong>{state.paths.length}</strong> file degli studenti ancora nello spazio pubblico.
            </span>
            <Button size="sm" onClick={() => move(state.paths)}>
              Sposta nello spazio privato
            </Button>
          </div>
        )}
        {state.step === 'moving' && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Spostamento in corso: {state.done} di {state.total}…
          </p>
        )}
        {state.step === 'moved' && (
          <div className="space-y-1">
            <p className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Spostati {state.moved} file.
            </p>
            {state.failed.length > 0 && (
              <p className="text-destructive">
                Non spostati {state.failed.length} file (riprova con “Controlla”): {state.failed.slice(0, 5).join(', ')}
                {state.failed.length > 5 ? '…' : ''}
              </p>
            )}
          </div>
        )}
        {state.step === 'error' && <p className="text-destructive">Controllo non riuscito: {state.message}</p>}
      </CardContent>
    </Card>
  );
}
