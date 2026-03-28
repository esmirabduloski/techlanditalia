interface CourseEmojiProps {
  emoji: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
  lg: 'w-9 h-9',
  xl: 'w-11 h-11',
};

const textSizeMap = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
};

export function CourseEmoji({ emoji, className = '', size = 'md' }: CourseEmojiProps) {
  if (emoji === '⛏️') {
    return (
      <img
        src="/images/minecraft-logo.png"
        alt="Minecraft"
        className={`${sizeMap[size]} object-contain ${className}`}
      />
    );
  }

  return <span className={`${textSizeMap[size]} ${className}`}>{emoji}</span>;
}
