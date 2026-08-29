"use client";

import { useEffect, useState } from "react";
import {
  motion,
  useMotionValue,
  animate,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  value: number; // 0–100
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
  delay?: number;
}

/** Animated circular confirmation dial with counting number. */
export function ProbabilityRing({
  value,
  size = 168,
  stroke = 12,
  label,
  className,
  delay = 0.2,
}: Props) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useMotionValue(0);
  const dashoffset = useTransform(
    progress,
    (v) => circumference - (v / 100) * circumference
  );
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(progress, value, {
      duration: 1.4,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return controls.stop;
  }, [value, delay, progress]);

  // Colour reflects strength of the odds.
  const color =
    value >= 60
      ? "var(--color-confirm)"
      : value >= 40
      ? "var(--color-caution)"
      : "var(--color-danger)";

  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashoffset }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div
            className="tabular font-semibold leading-none"
            style={{ fontSize: size * 0.28, color }}
          >
            {display}
            <span style={{ fontSize: size * 0.13 }}>%</span>
          </div>
          {label && (
            <div className="mt-1 text-xs text-ink-faint max-w-[9rem] leading-tight">
              {label}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
