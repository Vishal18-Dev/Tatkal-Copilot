"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Small animated equalizer — bars pulse while listening or speaking, sit flat otherwise. Purely decorative. */
export function VoiceWaveform({
  active,
  tone = "brand",
  bars = 5,
  className,
}: {
  active: boolean;
  tone?: "brand" | "white";
  bars?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const animated = active && !reduceMotion;

  return (
    <div
      className={cn("flex h-6 items-center justify-center gap-[3px]", className)}
      aria-hidden="true"
    >
      {Array.from({ length: bars }).map((_, i) => (
        <motion.span
          key={i}
          className={cn(
            "w-[3px] rounded-full",
            tone === "brand" ? "bg-brand" : "bg-white"
          )}
          animate={
            animated
              ? { height: ["30%", "100%", "45%", "80%", "30%"] }
              : { height: active ? "70%" : "20%" }
          }
          transition={
            animated
              ? {
                  duration: 0.9 + (i % 3) * 0.15,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.07,
                }
              : { duration: 0.2 }
          }
          style={{ height: "20%" }}
        />
      ))}
    </div>
  );
}
