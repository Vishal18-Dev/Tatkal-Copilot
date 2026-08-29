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
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          {/* signal / rising-confidence mark */}
          <path
            d="M4 17.5C7 13 10 15 13.5 9.5C15.5 6.4 18 5 20 5"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="5" r="2.2" fill="white" />
          <path
            d="M4 20h16"
            stroke="white"
            strokeOpacity="0.5"
            strokeWidth="2.2"
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
