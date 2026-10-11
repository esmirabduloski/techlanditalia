import { useEffect, useState } from 'react';
import { Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MfaChallenge } from './MfaChallenge';
import { MfaEnroll } from './MfaEnroll';
import { MfaRecovery } from './MfaRecovery';

type Mode = 'loading' | 'challenge' | 'enroll' | 'recovery';

/** Schermata a tutta pagina: configurazione, codice o recupero della 2FA. */
export default function MfaScreen({ email }: { email: string }) {
  const { signOut, refreshAccess } = useAuth();
  const [mode, setMode] = useState<Mode>('loading');

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setMode((data?.totp ?? []).length > 0 ? 'challenge' : 'enroll');
    });
  }, []);

  const done = () => {
    void refreshAccess();
  };

  const title =
    mode === 'enroll' ? 'Attiva la verifica in due passaggi'
    : mode === 'recovery' ? 'Hai perso l’accesso all’app?'
    : 'Verifica in due passaggi';

  const description =
    mode === 'enroll'
      ? 'Il tuo account accede a dati di studenti e pagamenti: per proteggerlo serve un codice dal telefono oltre alla password.'
      : mode === 'recovery'
        ? 'Recupero dell’accesso con conferma via email e approvazione di un amministratore.'
        : 'Inserisci il codice a 6 cifre mostrato dalla tua app di autenticazione.';

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <ShieldCheck className="mx-auto mb-2 h-10 w-10 text-primary" />
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {mode === 'loading' && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {mode === 'enroll' && <MfaEnroll onDone={done} />}
          {mode === 'challenge' && (
            <>
              <MfaChallenge onVerified={done} />
              <div className="text-center">
                <Button variant="link" className="text-sm" onClick={() => setMode('recovery')}>
                  Non ho più accesso all&apos;app
                </Button>
              </div>
            </>
          )}
          {mode === 'recovery' && <MfaRecovery email={email} onBack={() => setMode('challenge')} />}
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
