"use client";

import { Languages } from "lucide-react";
import { useLang } from "@/lib/i18n";

export function LanguageToggle() {
  const { toggle, t } = useLang();
  return (
    <button
      onClick={toggle}
      aria-label={t("lang.aria")}
      className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 h-9 text-sm font-medium text-ink-soft transition-colors hover:text-ink hover:bg-surface-muted"
    >
      <Languages className="h-4 w-4" strokeWidth={2} />
      {t("lang.label")}
    </button>
  );
}
