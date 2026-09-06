"use client";

import { Languages } from "lucide-react";
import { useVoiceLang } from "@/lib/voice/voice-lang";
import { isVoiceLang } from "@/lib/voice/languages";
import { useLang } from "@/lib/i18n";

/**
 * The spoken-language selector — a normal product setting, not a technical
 * panel (spec §20). A native <select> for full keyboard + screen-reader
 * support; options show each language's own endonym. Picking one locks it as
 * the user's explicit choice; until then detection may follow the speaker.
 */
export function VoiceLangSelect({ className }: { className?: string }) {
  const { voiceLang, setVoiceLang, langs } = useVoiceLang();
  const { t } = useLang();

  return (
    <label
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink-soft focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15"
      }
    >
      <Languages className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
      <span className="sr-only">{t("voice.languageLabel")}</span>
      <select
        value={voiceLang}
        onChange={(e) => {
          if (isVoiceLang(e.target.value)) setVoiceLang(e.target.value);
        }}
        aria-label={t("voice.languageLabel")}
        className="cursor-pointer appearance-none bg-transparent pr-1 font-medium text-ink focus:outline-none"
      >
        {langs.map((l) => (
          <option key={l.code} value={l.code} className="bg-surface text-ink">
            {l.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
