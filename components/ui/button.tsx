"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-white shadow-[var(--shadow-brand)] hover:bg-brand-strong hover-lift active-press hover:shadow-lg transition-all duration-200",
        secondary:
          "glass-pill text-ink border border-line/70 hover:bg-surface-muted/70 hover-lift active-press transition-all duration-200",
        ghost: "text-ink-soft hover:text-ink hover:bg-surface-muted/60 transition-all duration-200",
        confirm: "bg-confirm text-white hover:brightness-105 shadow-xs hover:shadow-md hover-lift active-press transition-all duration-200",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-[0.95rem]",
        lg: "h-14 px-7 text-base",
        xl: "h-16 px-10 text-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "children">,
    VariantProps<typeof buttonVariants> {
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";
