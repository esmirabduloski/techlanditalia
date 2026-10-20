import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { seasonalTitle, type SeasonalTheme } from '@/lib/seasonalHomework';
import { fetchSeasonalThemes } from '@/lib/seasonalHomeworkClient';

// Una sola lettura dei temi per pagina, anche con tanti badge
let themesPromise: Promise<SeasonalTheme[]> | null = null;

function loadThemes(): Promise<SeasonalTheme[]> {
  if (!themesPromise) {
    themesPromise = fetchSeasonalThemes().then((themes) => {
      if (themes === null) themesPromise = null; // riprova alla prossima pagina
      return themes ?? [];
    });
  }
  return themesPromise;
}

/** Tema di un compito stagionale; null finché non è caricato o se il compito non ne ha */
function useSeasonalTheme(themeId: string | null | undefined): SeasonalTheme | null {
  const [theme, setTheme] = useState<SeasonalTheme | null>(null);

  useEffect(() => {
    if (!themeId) {
      setTheme(null);
      return;
    }
    let alive = true;
    loadThemes().then((themes) => {
      if (alive) setTheme(themes.find((t) => t.id === themeId) ?? null);
    });
    return () => {
      alive = false;
    };
  }, [themeId]);

  return theme;
}

/** "🎃 Missione Halloween" sui compiti stagionali; niente sugli altri */
export function SeasonalBadge({ themeId, className }: { themeId: string | null | undefined; className?: string }) {
  const theme = useSeasonalTheme(themeId);
  if (!theme) return null;
  return (
    <Badge variant="outline" className={cn('border-primary/40 text-primary whitespace-nowrap', className)}>
      {seasonalTitle(theme)}
    </Badge>
  );
}
