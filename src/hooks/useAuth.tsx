import { createContext, useContext, useEffect, useState, startTransition, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabase } from '@/integrations/supabase/lazyClient';

/**
 * Stato della verifica in due passaggi per la sessione corrente.
 * `needsMfa`: l'utente deve configurare o inserire il codice prima di accedere
 * ai dati (il database rifiuta comunque le query finché la sessione non è aal2).
 */
export interface MfaState {
  needsMfa: boolean;
  currentLevel: 'aal1' | 'aal2' | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  mfa: MfaState;
  refreshAccess: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mfa, setMfa] = useState<MfaState>({ needsMfa: false, currentLevel: null });

  useEffect(() => {
    // Il client Supabase è importato in modo dinamico (vedi lazyClient.ts): sulle
    // pagine pubbliche prerenderate non deve stare sul percorso critico.
    // Gli aggiornamenti iniziali sono in startTransition: questo provider sta sopra
    // tutta la pagina prerenderata e un setState urgente durante l'hydration fa
    // scartare a React l'HTML del server (errore #421 -> schermo vuoto sui telefoni).
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;

    getSupabase().then((supabase) => {
      if (cancelled) return;

      // Set up auth state listener FIRST
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        startTransition(() => {
          setSession(session);
          setUser(session?.user ?? null);
        });

        // Check admin role with setTimeout to avoid deadlock
        if (session?.user) {
          startTransition(() => setIsLoading(true));
          setTimeout(async () => {
            await loadAccess(session.user.id);
            startTransition(() => setIsLoading(false));
          }, 0);
        } else {
          startTransition(() => {
            setIsAdmin(false);
            setMfa({ needsMfa: false, currentLevel: null });
            setIsLoading(false);
          });
        }
      });
      subscription = data.subscription;

      // THEN check for existing session (attendi il controllo ruolo prima di sbloccare le guard)
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (cancelled) return;
        startTransition(() => {
          setSession(session);
          setUser(session?.user ?? null);
        });
        if (session?.user) {
          await loadAccess(session.user.id);
        }
        startTransition(() => setIsLoading(false));
      });
    });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  const checkAdminRole = async (userId: string) => {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      setIsAdmin(!error && data !== null);
    } catch {
      setIsAdmin(false);
    }
  };

  // Livello della sessione (aal1/aal2) e obbligo di 2FA (admin, insegnanti,
  // operatori o chiunque abbia attivato un fattore): vedi migrazione 0019.
  const checkMfa = async () => {
    try {
      const supabase = await getSupabase();
      const [{ data: aal }, { data: required }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.rpc('my_mfa_required' as never),
      ]);
      const currentLevel = (aal?.currentLevel ?? null) as MfaState['currentLevel'];
      const needsMfa = currentLevel !== 'aal2' && (required === true || aal?.nextLevel === 'aal2');
      setMfa({ needsMfa, currentLevel });
    } catch {
      setMfa({ needsMfa: false, currentLevel: null });
    }
  };

  const loadAccess = async (userId: string) => {
    await Promise.all([checkAdminRole(userId), checkMfa()]);
  };

  const refreshAccess = async () => {
    const supabase = await getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await loadAccess(session.user.id);
  };

  const signIn = async (email: string, password: string) => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    // If login successful, check admin role immediately and wait for it
    if (!error && data?.user) {
      await loadAccess(data.user.id);
    }
    
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl }
    });
    return { error };
  };

  const signOut = async () => {
    const supabase = await getSupabase();
    await supabase.auth.signOut();
    setIsAdmin(false);
    setMfa({ needsMfa: false, currentLevel: null });
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isLoading, mfa, refreshAccess, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
