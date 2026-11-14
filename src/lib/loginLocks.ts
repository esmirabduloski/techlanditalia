import { supabase } from '@/integrations/supabase/client';

/** Account bloccato per troppi tentativi di accesso falliti. */
export interface LoginLock {
  userId: string;
  failedAttempts: number;
  /** Secondi allo sblocco automatico, al momento della lettura. */
  retryAfterSeconds: number;
}

async function errorMessage(error: unknown, data: { error?: string } | null, fallback: string) {
  let message = data?.error;
  const ctx = (error as { context?: Response } | null)?.context;
  if (!message && ctx && typeof ctx.json === 'function') {
    try { message = (await ctx.clone().json())?.error; } catch { /* corpo non leggibile */ }
  }
  return message || fallback;
}

/** Account bloccati adesso (solo admin), dalla edge function admin-login-lock. */
export async function fetchLoginLocks(): Promise<Map<string, LoginLock>> {
  const map = new Map<string, LoginLock>();
  try {
    const { data, error } = await supabase.functions.invoke('admin-login-lock', { body: { action: 'status' } });
    if (error || !Array.isArray(data?.locked)) return map;
    for (const lock of data.locked as LoginLock[]) map.set(lock.userId, lock);
  } catch {
    // Funzione non ancora pubblicata: nessun blocco mostrato
  }
  return map;
}

/** Cancella i tentativi falliti: l'utente può riprovare subito. */
export async function unlockLogin(userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-login-lock', { body: { action: 'unlock', userId } });
  if (error || data?.error) {
    throw new Error(await errorMessage(error, data, "Impossibile sbloccare l'account"));
  }
}

export function minutesLeft(lock: LoginLock): number {
  return Math.max(1, Math.ceil(lock.retryAfterSeconds / 60));
}
