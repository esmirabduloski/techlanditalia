import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { getAvatar, stageName } from '@/lib/avatars/catalog';
import { getAvatarImage } from '@/lib/avatars/images';
import type { AvatarHandle } from '@/lib/avatars/scene';

interface Avatar3DProps {
  avatarId: number;
  level: number;
  /** Si può girare trascinando in orizzontale. */
  interactive?: boolean;
  className?: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Figura 3D live dell'avatar. three.js arriva con import() solo qui; finché
 * non c'è il primo frame (o se WebGL manca) si vede l'immagine pre-renderizzata
 * dello stesso modello, con la stessa inquadratura.
 */
export function Avatar3D({ avatarId, level, interactive = false, className }: Avatar3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<AvatarHandle | null>(null);
  const latest = useRef({ avatarId, level });
  latest.current = { avatarId, level };
  const [live, setLive] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    import('@/lib/avatars/scene')
      .then(({ mountAvatar }) => {
        if (cancelled) return;
        handleRef.current = mountAvatar(canvas, {
          ...latest.current,
          interactive,
          animate: !prefersReducedMotion(),
          onFirstFrame: () => !cancelled && setLive(true),
        });
      })
      // senza WebGL (o se il chunk non arriva) resta l'immagine
      .catch(() => undefined);
    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
      setLive(false);
    };
  }, [interactive]);

  useEffect(() => {
    handleRef.current?.update(avatarId, level);
  }, [avatarId, level]);

  return (
    <div
      role="img"
      aria-label={`${getAvatar(avatarId).name}: ${stageName(avatarId, level)}`}
      className={cn('relative', className)}
    >
      <img
        src={getAvatarImage(avatarId, level)}
        alt=""
        draggable={false}
        className={cn('absolute inset-0 h-full w-full object-contain transition-opacity duration-300', live && 'opacity-0')}
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        className={cn('absolute inset-0 h-full w-full transition-opacity duration-300', !live && 'opacity-0')}
      />
    </div>
  );
}
