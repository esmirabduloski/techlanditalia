import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  fileKey,
  resolveStudentWebAssets,
  SIGNED_URL_REFRESH_MS,
  type StudentWebFile,
} from '@/lib/studentWebAssets';

/**
 * Link firmati dei file caricati dallo studente, per l'anteprima del
 * compilatore web: riferimento usato nel codice -> link. Si rinnovano prima
 * che scadano, così l'anteprima funziona anche se la pagina resta aperta.
 */
export function useStudentWebAssetUrls(files: StudentWebFile[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = files.map(fileKey).join('\n');

  useEffect(() => {
    let cancelled = false;
    const sign = () =>
      resolveStudentWebAssets(supabase, files)
        .then((resolved) => {
          if (!cancelled) setUrls(resolved);
        })
        .catch((error) => console.error('Error signing web assets:', error));

    if (files.length === 0) {
      setUrls((prev) => (Object.keys(prev).length ? {} : prev));
      return;
    }
    void sign();
    const timer = setInterval(sign, SIGNED_URL_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key riassume files
  }, [key]);

  return urls;
}
