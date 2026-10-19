import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { storagePathFrom } from '@/lib/storagePaths';

export { storagePathFrom };

/**
 * Hook to generate signed URLs for private storage bucket files
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket (can be null/undefined)
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 */
export function useSignedUrl(
  bucket: string,
  path: string | null | undefined,
  expiresIn: number = 3600
) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!path) {
      setSignedUrl(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getSignedUrl(bucket, path, expiresIn)
      .then((url) => {
        if (cancelled) return;
        setSignedUrl(url);
        if (!url) setError(new Error('Failed to generate signed URL'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bucket, path, expiresIn]);

  return { signedUrl, isLoading, error };
}

/**
 * Utility function to generate a signed URL (non-hook version for callbacks)
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string | null> {
  if (!path) return null;

  const storagePath = storagePathFrom(bucket, path);
  // URL esterno (non di questo bucket): lo usiamo così com'è
  if (storagePath === null) return path;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error('Error generating signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('Error generating signed URL:', err);
    return null;
  }
}

/**
 * Apre in una nuova scheda un file di un bucket privato, firmando il link al
 * momento del clic (così non scade se la pagina resta aperta a lungo).
 * La scheda viene aperta subito, prima dell'attesa, altrimenti il browser la
 * bloccherebbe come popup. Restituisce false se il file non è disponibile.
 */
export async function openStorageFile(bucket: string, path: string): Promise<boolean> {
  const tab = window.open('about:blank', '_blank');
  const url = await getSignedUrl(bucket, path, 300);
  if (!url) {
    tab?.close();
    return false;
  }
  if (tab) {
    tab.opener = null;
    tab.location.href = url;
  } else {
    // Popup bloccato: riprova senza lasciare la pagina (es. una valutazione in corso)
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  return true;
}
