import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  duration?: number;
  distance?: number;
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
  duration = 0.6,
}: ScrollRevealProps) {
  const variants: Variants = {
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration, delay, ease: "easeOut" },
    },
  };

  return (
    <motion.div
      initial={false}
      animate="visible"
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}
