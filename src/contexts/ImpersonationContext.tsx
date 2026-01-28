import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export type ImpersonatedRole = 'student' | 'parent' | 'teacher';

interface ImpersonatedUser {
  id: string;
  fullName: string;
  role: ImpersonatedRole;
  email?: string | null;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedUser: ImpersonatedUser | null;
  startImpersonation: (user: ImpersonatedUser) => void;
  stopImpersonation: () => void;
  getEffectiveUserId: (realUserId: string) => string;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(() => {
    // Restore from sessionStorage on mount
    const stored = sessionStorage.getItem('impersonation');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  });

  const startImpersonation = useCallback((user: ImpersonatedUser) => {
    setImpersonatedUser(user);
    sessionStorage.setItem('impersonation', JSON.stringify(user));
  }, []);

  const stopImpersonation = useCallback(() => {
    setImpersonatedUser(null);
    sessionStorage.removeItem('impersonation');
  }, []);

  const getEffectiveUserId = useCallback((realUserId: string) => {
    return impersonatedUser?.id || realUserId;
  }, [impersonatedUser]);

  return (
    <ImpersonationContext.Provider 
      value={{ 
        isImpersonating: !!impersonatedUser,
        impersonatedUser,
        startImpersonation,
        stopImpersonation,
        getEffectiveUserId
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider');
  }
  return context;
}
