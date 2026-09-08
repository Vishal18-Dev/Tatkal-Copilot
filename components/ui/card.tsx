"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLMotionProps<"div"> {
  lift?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, lift, ...props }, ref) => (
    <motion.div
      ref={ref}
      whileHover={lift ? { y: -3 } : undefined}
      transition={{ type: "spring", stiffness: 450, damping: 32 }}
      className={cn(
        "rounded-[var(--radius-xl)] glass-card border border-line/70 shadow-[var(--shadow-card)] transition-colors duration-200",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";
