import { cn } from '@/lib/utils';

const AVATARS = [
  { id: 1, emoji: '🤖', name: 'Robot' },
  { id: 2, emoji: '🦊', name: 'Volpe Tech' },
  { id: 3, emoji: '🚀', name: 'Razzo' },
  { id: 4, emoji: '🎮', name: 'Gamer' },
  { id: 5, emoji: '🐱', name: 'Gatto Ninja' },
  { id: 6, emoji: '🦸', name: 'Supereroe' },
  { id: 7, emoji: '🧙', name: 'Mago' },
  { id: 8, emoji: '🐉', name: 'Drago' },
  { id: 9, emoji: '🦄', name: 'Unicorno' },
  { id: 10, emoji: '🤓', name: 'Nerd' },
];

interface AvatarSelectorProps {
  selectedId: number;
  onSelect: (id: number) => void;
  level?: number;
  disabled?: boolean;
}

export function AvatarSelector({ selectedId, onSelect, level = 1, disabled = false }: AvatarSelectorProps) {
  const getLevelBorder = (lvl: number) => {
    if (lvl >= 10) return 'ring-4 ring-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)]';
    if (lvl >= 7) return 'ring-3 ring-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.4)]';
    if (lvl >= 4) return 'ring-2 ring-primary shadow-[0_0_10px_hsl(var(--primary)/0.3)]';
    return 'ring-2 ring-muted';
  };

  return (
    <div className="grid grid-cols-5 gap-3">
      {AVATARS.map((avatar) => (
        <button
          key={avatar.id}
          onClick={() => onSelect(avatar.id)}
          disabled={disabled}
          className={cn(
            'relative flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200',
            'hover:bg-accent/20 hover:scale-105',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            selectedId === avatar.id 
              ? `bg-primary/10 ${getLevelBorder(level)}` 
              : 'bg-muted/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          title={avatar.name}
        >
          <span className="text-3xl">{avatar.emoji}</span>
          <span className="text-xs text-muted-foreground mt-1 truncate w-full text-center">
            {avatar.name}
          </span>
        </button>
      ))}
    </div>
  );
}

interface AvatarDisplayProps {
  avatarId: number;
  level: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLevel?: boolean;
}

export function AvatarDisplay({ avatarId, level, size = 'md', showLevel = true }: AvatarDisplayProps) {
  const avatar = AVATARS.find(a => a.id === avatarId) || AVATARS[0];
  
  const sizeClasses = {
    sm: 'w-10 h-10 text-xl',
    md: 'w-14 h-14 text-2xl',
    lg: 'w-20 h-20 text-4xl',
    xl: 'w-28 h-28 text-5xl',
  };

  const getLevelStyle = (lvl: number) => {
    if (lvl >= 10) return 'ring-4 ring-yellow-400 bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/30 shadow-[0_0_25px_rgba(250,204,21,0.5)]';
    if (lvl >= 7) return 'ring-3 ring-purple-400 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 shadow-[0_0_18px_rgba(192,132,252,0.4)]';
    if (lvl >= 4) return 'ring-2 ring-primary bg-gradient-to-br from-primary/10 to-accent/10 shadow-[0_0_12px_hsl(var(--primary)/0.3)]';
    return 'ring-2 ring-muted bg-muted/50';
  };

  return (
    <div className="relative inline-flex">
      <div 
        className={cn(
          'rounded-full flex items-center justify-center',
          sizeClasses[size],
          getLevelStyle(level),
          'transition-all duration-300'
        )}
      >
        <span>{avatar.emoji}</span>
      </div>
      {showLevel && (
        <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-md">
          {level}
        </div>
      )}
    </div>
  );
}

export { AVATARS };
