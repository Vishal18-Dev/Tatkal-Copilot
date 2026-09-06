"use client";

import { cn } from "@/lib/utils";

export interface CopilotAvatarProps {
  state?: string;
  voiceState?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function CopilotAvatar({
  state = "idle",
  voiceState = "idle",
  size = "md",
  className,
}: CopilotAvatarProps) {
  const sizeClasses = {
    sm: "h-9 w-9",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  }[size];

  const isLive = state === "listening" || state === "thinking" || state === "speaking" || voiceState !== "idle";

  return (
    <div className={cn("relative inline-block shrink-0", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-full border-2 border-brand/40 bg-brand-soft shadow-md transition-all duration-300",
          sizeClasses,
          isLive && "ring-2 ring-brand/50 ring-offset-2"
        )}
      >
        <img
          src="/aarav.jpg"
          alt="Aarav — Tatkal Copilot Guide"
          className="h-full w-full object-cover object-center"
        />
      </div>

      {/* Live Status Indicator Dot */}
      <span className="absolute bottom-0 right-0 flex h-3.5 w-3.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-confirm opacity-75 motion-reduce:animate-none" />
        <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-surface bg-confirm" />
      </span>
    </div>
  );
}

