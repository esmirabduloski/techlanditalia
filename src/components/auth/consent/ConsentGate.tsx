import { lazy, ReactNode, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

// Import dinamico come MfaGate: niente client Supabase nel bundle delle pagine pubbliche.
const ConsentCheck = lazy(() => import('./ConsentCheck'));

// Profilo escluso: chi non accetta deve poter comunque eliminare l'account.
function isConsentGated(pathname: string) {
  if (pathname === '/area-riservata/profilo') return false;
  return pathname === '/area-riservata' || pathname.startsWith('/area-riservata/');
}

/**
 * Nell'area riservata il genitore deve accettare l'ultima versione di Privacy e
 * Termini, per sé e per ogni figlio, prima di vedere i dati. Solo interfaccia:
 * la prova è in consent_records, scritta dalla funzione record_legal_consents.
 */
export function ConsentGate({ children }: { children: ReactNode }) {
  const { user, isLoading, mfa } = useAuth();
  const { pathname } = useLocation();

  if (!user || isLoading || mfa.needsMfa || !isConsentGated(pathname)) return <>{children}</>;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ConsentCheck userId={user.id}>{children}</ConsentCheck>
    </Suspense>
  );
}
