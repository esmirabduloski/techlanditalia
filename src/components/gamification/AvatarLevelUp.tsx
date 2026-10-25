import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getAvatarImage } from '@/lib/avatars/images';
import { Avatar3D } from './Avatar3D';

interface AvatarLevelUpProps {
  avatarId: number;
  from: number;
  to: number;
  reducedMotion?: boolean | null;
}

/**
 * Evoluzione nella festa di nuovo livello: la forma vecchia trema, un lampo,
 * poi compare la nuova in 3D. Con reduced motion si vede subito la nuova.
 */
export function AvatarLevelUp({ avatarId, from, to, reducedMotion }: AvatarLevelUpProps) {
  const [phase, setPhase] = useState<'old' | 'flash' | 'new'>(reducedMotion ? 'new' : 'old');

  useEffect(() => {
    if (reducedMotion) return;
    const flash = setTimeout(() => setPhase('flash'), 1000);
    const reveal = setTimeout(() => setPhase('new'), 1350);
    return () => {
      clearTimeout(flash);
      clearTimeout(reveal);
    };
  }, [reducedMotion]);

  return (
    <div className="relative w-40 h-40" data-phase={phase}>
      {phase === 'new' ? (
        <motion.div
          className="absolute inset-0"
          initial={reducedMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reducedMotion ? { duration: 0.3 } : { type: 'spring', stiffness: 220, damping: 13 }}
        >
          <Avatar3D avatarId={avatarId} level={to} className="w-full h-full" />
        </motion.div>
      ) : (
        <motion.img
          src={getAvatarImage(avatarId, from)}
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
          animate={phase === 'old' ? { x: [0, -3, 3, -2, 2, 0] } : { scale: 1.12, opacity: 0.4 }}
          transition={phase === 'old' ? { duration: 0.45, repeat: Infinity } : { duration: 0.3 }}
        />
      )}
      <AnimatePresence>
        {phase === 'flash' && (
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-full bg-white blur-md"
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1.25 }}
            exit={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
