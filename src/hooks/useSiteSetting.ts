import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSiteSetting<T = unknown>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchSetting = async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (!cancelled) {
        if (data?.value !== undefined && data?.value !== null) {
          setValue(data.value as T);
        }
        setIsLoading(false);
      }
    };
    fetchSetting();
    return () => { cancelled = true; };
  }, [key]);

  return { value, isLoading, setValue };
}
