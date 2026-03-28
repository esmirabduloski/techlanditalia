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

const logoMap: Record<string, { src: string; alt: string }> = {
  '⛏️': { src: '/images/minecraft-logo.png', alt: 'Minecraft' },
  '🐍': { src: '/images/python-logo.png', alt: 'Python' },
  '🤖': { src: '/images/python-logo.png', alt: 'Python PRO & AI' },
  '🏗️': { src: '/images/roblox-logo.png', alt: 'Roblox' },
  '🚀': { src: '/images/roblox-logo.png', alt: 'Roblox Avanzato' },
};

export function CourseEmoji({ emoji, className = '', size = 'md' }: CourseEmojiProps) {
  // Normalize emoji by removing variant selectors (️ = \uFE0F) for reliable matching
  const normalized = emoji?.replace(/\uFE0F/g, '');
  const logo = logoMap[emoji] || Object.entries(logoMap).find(([key]) => key.replace(/\uFE0F/g, '') === normalized)?.[1];
  if (logo) {
    return (
      <img
        src={logo.src}
        alt={logo.alt}
        className={`${sizeMap[size]} object-contain ${className}`}
      />
    );
  }

  return <span className={`${textSizeMap[size]} ${className}`}>{emoji}</span>;
}
