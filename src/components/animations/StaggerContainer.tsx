import type { ReactNode } from "react";

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  /** Mantenuto per compatibilità: oggi non produce animazione (vedi ScrollReveal). */
  staggerDelay?: number;
}

/** Griglia/contenitore delle card: div semplice, stesso motivo di ScrollReveal. */
export function StaggerContainer({ children, className }: StaggerContainerProps) {
  return <div className={className}>{children}</div>;
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  return <div className={className}>{children}</div>;
}
