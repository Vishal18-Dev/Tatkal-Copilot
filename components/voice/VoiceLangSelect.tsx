"use client";

import { Languages } from "lucide-react";
import { useVoiceLang } from "@/lib/voice/voice-lang";
import { isVoiceLang } from "@/lib/voice/languages";
import { useLang } from "@/lib/i18n";

/**
 * The spoken-language selector — a normal product setting, not a technical
 * panel (spec §20). A native <select> for full keyboard + screen-reader
 * support; options show each language's own endonym.
 *
 * Defaults to "Auto-detect": the agent follows whatever language you actually
 * speak, and the little endonym beside the control shows what it heard.
 * Picking a specific language LOCKS it as your explicit choice; choosing
 * "Auto-detect" hands control back to detection (spec §20 manual override).
 */
export function VoiceLangSelect({ className }: { className?: string }) {
  const { voiceLang, locked, setVoiceLang, setAuto, langs } = useVoiceLang();
  const { t } = useLang();

  const current = langs.find((l) => l.code === voiceLang);

  return (
    <span className="inline-flex items-center gap-1.5">
      <label
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink-soft focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15"
        }
      >
        <Languages className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        <span className="sr-only">{t("voice.languageLabel")}</span>
        <select
          value={locked ? voiceLang : "auto"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "auto") setAuto();
            else if (isVoiceLang(v)) setVoiceLang(v);
          }}
          aria-label={t("voice.languageLabel")}
          className="cursor-pointer appearance-none bg-transparent pr-1 font-medium text-ink focus:outline-none"
        >
          <option value="auto" className="bg-surface text-ink">
            {t("voice.langAuto")}
          </option>
          {langs.map((l) => (
            <option key={l.code} value={l.code} className="bg-surface text-ink">
              {l.nativeName}
            </option>
          ))}
        </select>
      </label>

      {/* In auto mode, show the language the agent is currently hearing. */}
      {!locked && current && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[0.7rem] font-semibold text-brand"
          title={t("voice.autoHint")}
        >
          <span aria-hidden="true">●</span>
          {current.nativeName}
        </span>
      )}
    </span>
  );
}
