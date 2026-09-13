import { createContext, useContext, useEffect, useState, startTransition, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabase } from '@/integrations/supabase/lazyClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
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
            await checkAdminRole(session.user.id);
            startTransition(() => setIsLoading(false));
          }, 0);
        } else {
          startTransition(() => {
            setIsAdmin(false);
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
          await checkAdminRole(session.user.id);
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

  const signIn = async (email: string, password: string) => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    // If login successful, check admin role immediately and wait for it
    if (!error && data?.user) {
      await checkAdminRole(data.user.id);
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
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isLoading, signIn, signUp, signOut }}>
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
