import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Sparkles } from 'lucide-react';
import { SocialShareButton } from './SocialShareButton';

interface Confetti {
  id: number;
  x: number;
  color: string;
  delay: number;
  size: number;
}

interface CelebrationOverlayProps {
  type: 'badge' | 'level-up';
  title: string;
  subtitle?: string;
  emoji?: string;
  isVisible: boolean;
  onClose: () => void;
}

const colors = [
  'hsl(152, 60%, 50%)', // Primary green
  'hsl(190, 70%, 55%)', // Cyan
  'hsl(45, 90%, 55%)',  // Gold
  'hsl(280, 70%, 60%)', // Purple
  'hsl(340, 80%, 60%)', // Pink
  'hsl(210, 70%, 55%)', // Blue
];

export function CelebrationOverlay({ 
  type, 
  title, 
  subtitle, 
  emoji, 
  isVisible, 
  onClose 
}: CelebrationOverlayProps) {
  const [confetti, setConfetti] = useState<Confetti[]>([]);

  const generateConfetti = useCallback(() => {
    const pieces: Confetti[] = [];
    for (let i = 0; i < 50; i++) {
      pieces.push({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
        size: Math.random() * 8 + 4,
      });
    }
    setConfetti(pieces);
  }, []);

  useEffect(() => {
    if (isVisible) {
      generateConfetti();
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, generateConfetti, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm pointer-events-auto"
          />

          {/* Confetti */}
          <div className="absolute inset-0 overflow-hidden">
            {confetti.map((piece) => (
              <motion.div
                key={piece.id}
                initial={{ 
                  y: -20, 
                  x: `${piece.x}vw`,
                  rotate: 0,
                  opacity: 1 
                }}
                animate={{ 
                  y: '110vh',
                  rotate: 720,
                  opacity: [1, 1, 0]
                }}
                transition={{ 
                  duration: 3 + Math.random() * 2,
                  delay: piece.delay,
                  ease: 'linear'
                }}
                className="absolute"
                style={{
                  width: piece.size,
                  height: piece.size,
                  backgroundColor: piece.color,
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                }}
              />
            ))}
          </div>

          {/* Celebration Card */}
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ 
              scale: 1, 
              rotate: 0,
              transition: { 
                type: 'spring', 
                stiffness: 200, 
                damping: 15,
                delay: 0.1 
              }
            }}
            exit={{ scale: 0, rotate: 10 }}
            className="relative z-10 pointer-events-auto"
          >
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute inset-0 blur-3xl opacity-50">
                <div className={`w-full h-full rounded-3xl ${
                  type === 'level-up' 
                    ? 'bg-gradient-to-br from-primary via-accent to-secondary' 
                    : 'bg-gradient-to-br from-yellow-400 via-orange-400 to-pink-400'
                }`} />
              </div>

              {/* Card */}
              <div className="relative bg-card border-2 border-primary/30 rounded-3xl p-8 shadow-2xl max-w-sm mx-4">
                {/* Sparkles decoration */}
                <motion.div
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.2, 1]
                  }}
                  transition={{ 
                    rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
                    scale: { duration: 2, repeat: Infinity }
                  }}
                  className="absolute -top-4 -right-4"
                >
                  <Sparkles className="w-8 h-8 text-yellow-400" />
                </motion.div>
                
                <motion.div
                  animate={{ 
                    rotate: -360,
                    scale: [1, 1.3, 1]
                  }}
                  transition={{ 
                    rotate: { duration: 15, repeat: Infinity, ease: 'linear' },
                    scale: { duration: 1.5, repeat: Infinity, delay: 0.5 }
                  }}
                  className="absolute -bottom-3 -left-3"
                >
                  <Star className="w-6 h-6 text-primary fill-primary" />
                </motion.div>

                {/* Icon */}
                <motion.div 
                  className="flex justify-center mb-4"
                  animate={{ 
                    y: [0, -10, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                >
                  {type === 'level-up' ? (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Trophy className="w-12 h-12 text-primary" />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400/20 to-orange-400/20 flex items-center justify-center">
                      <span className="text-5xl">{emoji || '🏆'}</span>
                    </div>
                  )}
                </motion.div>

                {/* Text */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-center"
                >
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    {type === 'level-up' ? '🎉 Nuovo Livello!' : '🏅 Nuovo Badge!'}
                  </p>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="text-muted-foreground">
                      {subtitle}
                    </p>
                  )}
                </motion.div>

                {/* Close hint */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5 }}
                  className="text-center text-xs text-muted-foreground mt-6"
                >
                  Tocca per continuare
                </motion.p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
