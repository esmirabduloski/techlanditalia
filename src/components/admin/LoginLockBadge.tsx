import { useState } from 'react';
import { Loader2, Lock, LockOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { minutesLeft, unlockLogin, type LoginLock } from '@/lib/loginLocks';

interface Props {
  lock: LoginLock | undefined;
  userName: string;
  onUnlocked: (userId: string) => void;
}

/** Badge "Accesso bloccato" con il pulsante per sbloccare subito l'account. */
export function LoginLockBadge({ lock, userName, onUnlocked }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  if (!lock) return null;

  const unlock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await unlockLogin(lock.userId);
      toast({ title: 'Account sbloccato', description: `${userName} può accedere di nuovo subito.` });
      onUnlocked(lock.userId);
    } catch (error) {
      toast({
        title: 'Errore',
        description: error instanceof Error ? error.message : "Impossibile sbloccare l'account",
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Badge
        variant="destructive"
        className="gap-1"
        title={`${lock.failedAttempts} tentativi falliti, sblocco automatico tra circa ${minutesLeft(lock)} min`}
      >
        <Lock className="w-3 h-3" />
        Accesso bloccato
      </Badge>
      <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1" onClick={unlock} disabled={busy}>
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <LockOpen className="w-3 h-3" />}
        Sblocca
      </Button>
    </span>
  );
}
