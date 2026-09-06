"use client";

import { useEffect, useRef } from "react";
import { MonitorUp, MonitorOff, ShieldCheck } from "lucide-react";
import { useScreenShare } from "@/lib/voice/screen-share";
import { useLang } from "@/lib/i18n";

/**
 * Guided screen-share assistance inside the voice surface. The citizen can show
 * the Copilot what they're doing and be walked through it. The browser's own
 * picker governs consent; sharing can be stopped from here or from the browser.
 *
 * Honest framing: this is co-presence + journey-grounded guidance, not a vision
 * model reading the screen — the copy never claims to "see" specific pixels.
 */
export function ScreenShareAssist() {
  const { supported, sharing, stream, error, start, stop } = useScreenShare();
  const { t } = useLang();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  if (!supported) return null;

  if (!sharing) {
    return (
      <div className="mt-6 w-full">
        <button
          onClick={start}
          className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-line-strong bg-surface p-3.5 text-left transition-colors hover:border-brand hover:bg-brand-soft/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
            <MonitorUp className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">{t("voice.screenShare")}</span>
            <span className="block text-xs text-ink-soft">{t("voice.screenShareHint")}</span>
          </span>
        </button>
        {error === "failed" && (
          <p className="mt-1.5 text-center text-xs text-danger">{t("voice.screenShareError")}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 w-full overflow-hidden rounded-[var(--radius-lg)] border border-brand/40 bg-brand-soft/30">
      <div className="relative aspect-video w-full bg-ink/80">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="h-full w-full object-contain" muted playsInline />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-danger px-2 py-0.5 text-[0.65rem] font-semibold text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" />
          {t("voice.screenShareLive")}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 p-3">
        <span className="flex items-center gap-1.5 text-xs text-ink-soft">
          <ShieldCheck className="h-3.5 w-3.5 text-confirm" />
          {t("voice.screenShareActive")}
        </span>
        <button
          onClick={stop}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-muted"
        >
          <MonitorOff className="h-3.5 w-3.5" />
          {t("voice.screenShareStop")}
        </button>
      </div>
    </div>
  );
}
