import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AVATAR_CHARACTERS, getAvatar, stageName } from '@/lib/avatars/catalog';
import { getAvatarImage } from '@/lib/avatars/images';
import { Avatar3D } from './Avatar3D';

/** Compatibilità con i vecchi import: ora gli avatar sono figure 3D che crescono con il livello. */
const AVATARS = AVATAR_CHARACTERS;

interface AvatarSelectorProps {
  selectedId: number;
  onSelect: (id: number) => void;
  level?: number;
  disabled?: boolean;
}

/** Griglia dei personaggi, ognuno mostrato nella forma del livello dello studente. */
export function AvatarSelector({ selectedId, onSelect, level = 1, disabled = false }: AvatarSelectorProps) {
  const getLevelBorder = (lvl: number) => {
    if (lvl >= 10) return 'ring-4 ring-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)]';
    if (lvl >= 7) return 'ring-3 ring-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.4)]';
    if (lvl >= 4) return 'ring-2 ring-primary shadow-[0_0_10px_hsl(var(--primary)/0.3)]';
    return 'ring-2 ring-muted';
  };

  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3">
      {AVATARS.map((avatar) => (
        <button
          key={avatar.id}
          type="button"
          onClick={() => onSelect(avatar.id)}
          disabled={disabled}
          aria-pressed={selectedId === avatar.id}
          className={cn(
            'relative flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-xl transition-all duration-200',
            'hover:bg-accent/20 hover:scale-105',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            selectedId === avatar.id
              ? `bg-primary/10 ${getLevelBorder(level)}`
              : 'bg-muted/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          title={`${avatar.name}: ${stageName(avatar.id, level)}`}
        >
          <img
            src={getAvatarImage(avatar.id, level, 'face')}
            alt=""
            loading="lazy"
            draggable={false}
            className="w-full aspect-square rounded-lg object-cover"
          />
          <span className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate w-full text-center">
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
  /** Figura 3D intera e animata al posto del primo piano. */
  live?: boolean;
  /** Con live: si può girare trascinando. */
  interactive?: boolean;
}

export function AvatarDisplay({ avatarId, level, size = 'md', showLevel = true, live = false, interactive = false }: AvatarDisplayProps) {
  const avatar = getAvatar(avatarId);
  const src = getAvatarImage(avatarId, level, 'face');
  const [brokenSrc, setBrokenSrc] = useState<string>();

  const sizeClasses = {
    sm: 'w-10 h-10 text-xl',
    md: 'w-14 h-14 text-2xl',
    lg: 'w-20 h-20 text-4xl',
    xl: 'w-28 h-28 text-5xl',
  };
  // la figura intera ha bisogno di un po' più di spazio del primo piano
  const liveSizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24 sm:w-28 sm:h-28',
    xl: 'w-56 h-56',
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
          'flex items-center justify-center overflow-hidden',
          live ? 'rounded-2xl' : 'rounded-full',
          live ? liveSizeClasses[size] : sizeClasses[size],
          getLevelStyle(level),
          'transition-all duration-300'
        )}
      >
        {live ? (
          <Avatar3D avatarId={avatarId} level={level} interactive={interactive} className="h-full w-full" />
        ) : src && src !== brokenSrc ? (
          <img
            src={src}
            alt={`${avatar.name}: ${stageName(avatarId, level)}`}
            loading="lazy"
            draggable={false}
            onError={() => setBrokenSrc(src)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{avatar.emoji}</span>
        )}
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
