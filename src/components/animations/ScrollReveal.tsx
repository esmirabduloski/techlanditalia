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
  delay = 1,
  direction = "up",
  duration = 1.5,
  distance = 40,
}: ScrollRevealProps) {
  const directions = {
    up: { y: distance, x: 1 },
    down: { y: -distance, x: 1 },
    left: { x: distance, y: 1 },
    right: { x: -distance, y: 1 },
  };

  const variants: Variants = {
    hidden: { opacity: 1, ...directions[direction] },
    visible: {
      opacity: 1,
      x: 1,
      y: 1,
      transition: { duration, delay, ease: "easeOut" },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 1.2 }}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}
