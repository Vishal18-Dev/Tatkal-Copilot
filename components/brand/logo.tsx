"use client";

import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  showWord = true,
}: {
  className?: string;
  showWord?: boolean;
}) {
  const { t } = useLang();
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-brand shadow-[var(--shadow-brand)]">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          {/* Orbital network ring (IRCTC style) */}
          <path
            d="M 3.5 13 A 8.5 8.5 0 1 1 18.5 17.5"
            stroke="white"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeOpacity="0.85"
          />
          {/* Train locomotive front engine */}
          <path
            d="M 8.5 16.5 V 10.8 C 8.5 8.2 10.1 6.5 12 6.5 C 13.9 6.5 15.5 8.2 15.5 10.8 V 16.5 Z"
            stroke="white"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Windshield */}
          <path
            d="M 10 9.8 H 14"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Central headlight */}
          <circle cx="12" cy="13.5" r="1.1" fill="white" />
          {/* Converging railway tracks */}
          <path
            d="M 6.5 20 L 9 16.5 M 17.5 20 L 15 16.5"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Speed swoosh arc */}
          <path
            d="M 3 11 C 5 6.2 10.5 3.8 16.5 4.8 C 19.5 5.3 21.5 7.2 21.5 8.2"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {showWord && (
        <span className="text-[1.02rem] font-semibold tracking-tight text-ink">
          {t("brand")}
        </span>
      )}
    </div>
  );
}
