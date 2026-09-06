"use client";

import { Languages } from "lucide-react";
import { useLang } from "@/lib/i18n";
import type { SupportedLanguage } from "@/lib/i18n/types";

const UI_LOCALES: { code: SupportedLanguage; label: string }[] = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "mr-IN", label: "मराठी" },
  { code: "kn-IN", label: "ಕನ್ನಡ" },
  { code: "ta-IN", label: "தமிழ்" },
  { code: "te-IN", label: "తెలుగు" },
  { code: "gu-IN", label: "ગુજરાતી" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ" },
  { code: "ur-IN", label: "اردو" },
  { code: "ml-IN", label: "മലയാളം" },
];

export function LanguageToggle() {
  const { uiLanguage, setUiLanguage, t } = useLang();

  return (
    <label className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-2.5 h-9 text-sm font-medium text-ink-soft transition-colors hover:text-ink hover:bg-surface-muted focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
      <Languages className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
      <span className="sr-only">{t("lang.aria")}</span>
      <select
        value={uiLanguage}
        onChange={(e) => setUiLanguage(e.target.value as SupportedLanguage)}
        aria-label={t("lang.aria")}
        className="cursor-pointer appearance-none bg-transparent pr-1 font-medium text-ink focus:outline-none"
      >
        {UI_LOCALES.map((loc) => (
          <option key={loc.code} value={loc.code} className="bg-surface text-ink">
            {loc.label}
          </option>
        ))}
      </select>
    </label>
  );
}
