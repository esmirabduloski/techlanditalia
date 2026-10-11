import { lazy, ReactNode, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

// Import dinamico: MfaGate sta in App.tsx (tutte le pagine) e non deve portare
// il client Supabase nel bundle iniziale delle pagine pubbliche (vedi lazyClient.ts).
const MfaScreen = lazy(() => import('./MfaScreen'));

// Aree con dati personali: qui la 2FA va completata prima di mostrare la pagina.
const GATED_PREFIXES = ['/admin', '/insegnante', '/area-riservata', '/auth', '/account'];

function isGated(pathname: string) {
  return GATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Blocca le aree private finché la sessione non è aal2 per chi deve usare la
 * 2FA. È solo l'interfaccia: il blocco vero è nel database (policy
 * mfa_required) e nelle edge function admin.
 */
export function MfaGate({ children }: { children: ReactNode }) {
  const { user, mfa } = useAuth();
  const { pathname } = useLocation();

  if (!user || !mfa.needsMfa || !isGated(pathname)) return <>{children}</>;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <MfaScreen email={user.email ?? ''} />
    </Suspense>
  );
}
