import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAvatar } from '@/lib/avatars/catalog';
import { getAvatarImage } from '@/lib/avatars/images';
import { LEVELS, getLevelFromPoints, getProgressToNextLevel } from './LevelBadge';

interface AvatarEvolutionProps {
  avatarId: number;
  points: number;
}

/**
 * Le 10 forme dell'avatar scelto, con la stessa inquadratura: si vede crescere.
 * Le forme raggiunte sono a colori, le prossime sono sagome col lucchetto e il
 * nome si scopre solo per quella successiva.
 */
export function AvatarEvolution({ avatarId, points }: AvatarEvolutionProps) {
  const avatar = getAvatar(avatarId);
  const level = getLevelFromPoints(points).level;
  const { pointsToNext } = getProgressToNextLevel(points);

  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-3">Evoluzione: {avatar.name}</p>
      <ol className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {LEVELS.map(({ level: lvl }) => {
          const reached = lvl <= level;
          const current = lvl === level;
          const known = lvl <= level + 1;
          const stage = known ? avatar.stages[lvl - 1] : 'da scoprire';
          return (
            <li
              key={lvl}
              title={`Livello ${lvl} · ${stage}`}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'relative flex flex-col items-center rounded-xl p-1',
                current ? 'bg-primary/10 ring-2 ring-primary' : reached ? 'bg-muted/50' : 'bg-muted/25'
              )}
            >
              <img
                src={getAvatarImage(avatarId, lvl)}
                alt={reached ? `Livello ${lvl}: ${stage}` : `Livello ${lvl}: forma ancora bloccata`}
                loading="lazy"
                draggable={false}
                className={cn('w-full aspect-square object-contain', !reached && 'brightness-0 opacity-20 dark:invert')}
              />
              {!reached && <Lock className="absolute top-1 right-1 h-3 w-3 text-muted-foreground" aria-hidden />}
              <span className={cn('text-[10px] leading-tight', current ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                Lv {lvl}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground mt-3 text-center">
        {level < 10
          ? <>Prossima evoluzione: <span className="font-medium text-foreground">{avatar.stages[level]}</span> tra {pointsToNext.toLocaleString()} punti</>
          : <>Hai raggiunto la forma leggendaria: <span className="font-medium text-foreground">{avatar.stages[9]}</span>!</>}
      </p>
    </div>
  );
}
