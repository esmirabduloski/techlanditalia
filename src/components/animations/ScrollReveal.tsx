import type { ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  /** Mantenuti per compatibilità con le sezioni esistenti: oggi non producono animazione. */
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  duration?: number;
  distance?: number;
}

/**
 * Wrapper delle sezioni della home.
 *
 * Prima era un `motion.div` di framer-motion con `initial={false}`: non animava
 * nulla ma trascinava framer-motion (~35 KB gzip) nel bundle principale e ogni
 * sezione pagava il costo di hydration di un componente motion. Un div semplice
 * dà lo stesso risultato visivo con zero JavaScript.
 *
 * Se in futuro si vuole un vero "reveal" allo scroll, farlo in CSS con
 * IntersectionObserver che aggiunge una classe: MAI con opacity iniziale 0
 * nell'HTML prerenderato, o il contenuto resta invisibile finché non parte il JS.
 */
export function ScrollReveal({ children, className }: ScrollRevealProps) {
  return <div className={className}>{children}</div>;
}
