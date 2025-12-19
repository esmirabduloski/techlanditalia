import { cn } from '@/lib/utils';

interface Level {
  level: number;
  name: string;
  min_points: number;
  badge_emoji: string;
}

const LEVELS: Level[] = [
  { level: 1, name: 'Principiante', min_points: 0, badge_emoji: '🌱' },
  { level: 2, name: 'Apprendista', min_points: 100, badge_emoji: '🌿' },
  { level: 3, name: 'Esploratore', min_points: 300, badge_emoji: '🧭' },
  { level: 4, name: 'Costruttore', min_points: 600, badge_emoji: '🔧' },
  { level: 5, name: 'Inventore', min_points: 1000, badge_emoji: '💡' },
  { level: 6, name: 'Creatore', min_points: 1500, badge_emoji: '🎨' },
  { level: 7, name: 'Maestro', min_points: 2200, badge_emoji: '🎓' },
  { level: 8, name: 'Esperto', min_points: 3000, badge_emoji: '⭐' },
  { level: 9, name: 'Ninja Digitale', min_points: 4000, badge_emoji: '🥷' },
  { level: 10, name: 'Leggenda Tech', min_points: 5500, badge_emoji: '🏆' },
];

export function getLevelFromPoints(points: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].min_points) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}

export function getNextLevel(currentLevel: number): Level | null {
  const nextLevelIndex = LEVELS.findIndex(l => l.level === currentLevel + 1);
  return nextLevelIndex !== -1 ? LEVELS[nextLevelIndex] : null;
}

export function getProgressToNextLevel(points: number): { progress: number; pointsNeeded: number; pointsToNext: number } {
  const currentLevel = getLevelFromPoints(points);
  const nextLevel = getNextLevel(currentLevel.level);
  
  if (!nextLevel) {
    return { progress: 100, pointsNeeded: 0, pointsToNext: 0 };
  }
  
  const pointsInCurrentLevel = points - currentLevel.min_points;
  const pointsRequiredForNext = nextLevel.min_points - currentLevel.min_points;
  const progress = Math.min(100, (pointsInCurrentLevel / pointsRequiredForNext) * 100);
  
  return {
    progress,
    pointsNeeded: pointsRequiredForNext,
    pointsToNext: nextLevel.min_points - points,
  };
}

interface LevelBadgeProps {
  points: number;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  showProgress?: boolean;
}

export function LevelBadge({ points, size = 'md', showName = true, showProgress = false }: LevelBadgeProps) {
  const level = getLevelFromPoints(points);
  const { progress, pointsToNext } = getProgressToNextLevel(points);
  const nextLevel = getNextLevel(level.level);

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  const containerClasses = {
    sm: 'px-2 py-1 gap-1',
    md: 'px-3 py-2 gap-2',
    lg: 'px-4 py-3 gap-3',
  };

  return (
    <div className="flex flex-col">
      <div 
        className={cn(
          'inline-flex items-center rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20',
          containerClasses[size]
        )}
      >
        <span className={sizeClasses[size]}>{level.badge_emoji}</span>
        {showName && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">Livello {level.level}</span>
            <span className="text-xs text-muted-foreground">{level.name}</span>
          </div>
        )}
      </div>
      
      {showProgress && nextLevel && (
        <div className="mt-2 space-y-1">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {pointsToNext} punti per {nextLevel.name} {nextLevel.badge_emoji}
          </p>
        </div>
      )}
    </div>
  );
}

export function PointsDisplay({ points, size = 'md' }: { points: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  return (
    <div className={cn('flex items-center gap-1 font-bold text-primary', sizeClasses[size])}>
      <span>⚡</span>
      <span>{points.toLocaleString()}</span>
      <span className="text-muted-foreground font-normal text-sm">punti</span>
    </div>
  );
}

export { LEVELS };
