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
      whileHover={lift ? { y: -4 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "rounded-[var(--radius-lg)] bg-surface border border-line shadow-[var(--shadow-card)]",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";
