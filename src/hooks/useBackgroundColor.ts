import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Light theme colors (pastello, buon contrasto con testo scuro)
export const LIGHT_COLORS = [
  { id: 'green', label: 'Verde', value: '#daffcb' },
  { id: 'blue', label: 'Azzurro', value: '#cbedff' },
  { id: 'pink', label: 'Rosa', value: '#ffd6e8' },
  { id: 'yellow', label: 'Giallo', value: '#fff5cb' },
  { id: 'orange', label: 'Arancione', value: '#ffe4cb' },
];

// Dark theme colors (toni scuri, buon contrasto con testo chiaro)
export const DARK_COLORS = [
  { id: 'green-dark', label: 'Verde', value: '#1a2e1a' },
  { id: 'blue-dark', label: 'Azzurro', value: '#1a2230' },
  { id: 'pink-dark', label: 'Rosa', value: '#2e1a24' },
  { id: 'yellow-dark', label: 'Giallo', value: '#2e2a1a' },
  { id: 'orange-dark', label: 'Arancione', value: '#2e221a' },
];

export function useBackgroundColor() {
  const { user } = useAuth();
  const [bgColor, setBgColor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchColor = async () => {
      if (!user) { setIsLoading(false); return; }
      const { data } = await supabase
        .from('profiles')
        .select('bg_color, role')
        .eq('id', user.id)
        .maybeSingle();
      if (data?.role === 'student') {
        setBgColor(data.bg_color || null);
      }
      setIsLoading(false);
    };
    fetchColor();
  }, [user]);

  const updateColor = async (color: string | null) => {
    if (!user) return false;
    const { error } = await supabase
      .from('profiles')
      .update({ bg_color: color })
      .eq('id', user.id);
    if (!error) {
      setBgColor(color);
      return true;
    }
    return false;
  };

  return { bgColor, updateColor, isLoading };
}
