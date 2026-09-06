"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ============================================================
   Screen sharing for guided assistance.

   Lets a citizen show the Copilot what they're doing so it can
   walk them through it. Uses the browser's native getDisplayMedia
   (the user always picks what to share and can stop anytime — we
   never capture without that explicit OS-level consent).

   Honesty note: this streams the screen for co-presence and lets
   the guidance react to the journey the user is on; it is NOT a
   vision model reading pixels. The assistance is grounded in the
   real journey state (via lib/copilot), not in interpreting the
   captured frames.
   ============================================================ */

export interface ScreenShareState {
  supported: boolean;
  sharing: boolean;
  stream: MediaStream | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useScreenShare(): ScreenShareState {
  const [supported, setSupported] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getDisplayMedia === "function"
    );
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setSharing(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("unsupported");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      streamRef.current = s;
      setStream(s);
      setSharing(true);
      // The user can end sharing from the browser's own control — mirror that.
      s.getVideoTracks()[0]?.addEventListener("ended", () => stop());
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      // NotAllowedError = the user dismissed the picker; not an error to shout about.
      setError(name === "NotAllowedError" ? "declined" : "failed");
    }
  }, [stop]);

  return { supported, sharing, stream, error, start, stop };
}
