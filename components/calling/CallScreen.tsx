"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, PhoneIncoming } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { buildCallScript } from "@/lib/calling/script";
import { useCallConversation } from "@/lib/calling/conversation";
import { callingProvider, type CallReason, type PlacedCall } from "@/lib/calling/provider";
import type { CopilotContext } from "@/lib/copilot";
import type { Trip } from "@/types";
import { VoiceWaveform } from "@/components/voice/VoiceWaveform";

function reasonFor(trip: Trip | null): CallReason {
  if (!trip) return "no_trip";
  const s = trip.agentState;
  if (s === "primary_failed" || s === "backup_recommended" || s === "backup_attempt") return "primary_failed";
  if (s === "confirmed") return "confirmed";
  if (s === "window_open" || s === "user_action_required" || s === "booking_in_progress") return "check_in";
  return "tatkal_open_soon";
}

export function CallScreen({ onClose }: { onClose: () => void }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const { trips, user, wallet, identity, travellers } = useStore();
  const activeTrip = trips.find((tr) => tr.agentState !== "confirmed") ?? trips[0] ?? null;

  // One brain: the phone agent reads the journey through the same Copilot tools
  // the browser voice agent uses.
  const ctx: CopilotContext = { lang, trip: activeTrip ?? undefined, wallet, identity, travellers };
  const script = buildCallScript(ctx, user?.name, lang);

  // Telephony boundary: "place" the outbound call through the provider. The
  // mock resolves immediately (the UI renders the ring/audio); a real provider
  // would dial and report failure honestly instead of faking a call.
  const [placed, setPlaced] = useState<PlacedCall | null>(null);
  useEffect(() => {
    let alive = true;
    callingProvider
      .placeCall({ toName: user?.name, reason: reasonFor(activeTrip), tripId: activeTrip?.id })
      .then((r) => {
        if (alive) setPlaced(r);
      });
    return () => {
      alive = false;
    };
  }, [activeTrip, user?.name]);

  const { state, lines, currentStep, ring, accept, decline, reply } = useCallConversation(
    script,
    lang,
    (action) => {
      if (action === "open_trip" && activeTrip) router.push(`/app/trips/${activeTrip.id}`);
      if (action === "open_plan") router.push("/app/plan");
    }
  );

  // Brief ring before it's "answerable". No mount-guard ref here on purpose:
  // React's dev-mode StrictMode double-invokes this effect (schedule → clear
  // → schedule again), and a "have I already started" ref would survive that
  // cleanup and block the second schedule, permanently stranding the call in
  // "idle". Letting the effect re-run freely is safe — clearTimeout always
  // cancels the stale timer first, so `ring()` still fires exactly once.
  useEffect(() => {
    if (!placed?.ok) return; // wait until the provider has placed the call
    const timer = setTimeout(ring, 500);
    return () => clearTimeout(timer);
  }, [placed, ring]);

  useEffect(() => {
    if (state === "ended") {
      const timer = setTimeout(onClose, 1400);
      return () => clearTimeout(timer);
    }
  }, [state, onClose]);

  function handleDecline() {
    decline();
    setTimeout(onClose, 300);
  }

  const ringing = state === "ringing";
  const live = state === "connecting" || state === "speaking" || state === "awaiting_reply";

  // Rendered via a portal straight into <body> — this overlay must cover the
  // whole viewport, and position:fixed only does that if nothing between it
  // and <body> has a transform (any Framer Motion ancestor sets one), which
  // would otherwise confine it to that ancestor's box instead of the screen.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // Honest failure: if the (real) telephony provider can't place the call, say
  // so instead of faking a ring. The mock never hits this path.
  if (placed && !placed.ok) {
    return createPortal(
      <motion.div
        className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-[#0b1626] px-6 text-center text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label={t("call.title")}
      >
        <PhoneOff className="h-10 w-10 text-white/70" />
        <p className="max-w-sm text-white/80">{placed.error ?? t("call.cannotPlace")}</p>
        <button
          onClick={onClose}
          className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
        >
          {t("call.hangUp")}
        </button>
      </motion.div>,
      document.body
    );
  }

  return createPortal(
    <motion.div
      // Deliberately theme-invariant: a call screen reads as a single dark
      // world regardless of the app's light/dark setting, like a real phone
      // call UI — bg-brand-ink would flip to a pale text-emphasis color in
      // dark mode (it's a text token, not a background one) and wash this out.
      className="fixed inset-0 z-[70] flex flex-col items-center justify-between bg-[#0b1626] px-6 py-10 text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={t("call.title")}
    >
      {/* Caller identity */}
      <div className="flex flex-col items-center gap-3 pt-10 text-center">
        <span className="text-xs font-medium uppercase tracking-wide text-white/50">
          {state === "idle"
            ? t("call.incoming")
            : ringing
            ? t("call.incoming")
            : state === "ended"
            ? t("call.ended")
            : t("call.connected")}
        </span>
        <motion.span
          animate={ringing ? { scale: [1, 1.06, 1] } : {}}
          transition={{ duration: 1.1, repeat: ringing ? Infinity : 0 }}
          className="grid h-24 w-24 place-items-center rounded-full bg-white/10 text-white"
        >
          <PhoneIncoming className="h-10 w-10" />
        </motion.span>
        <div>
          <div className="text-xl font-semibold">{script.callerTitle}</div>
          <div className="text-sm text-white/60">{callingProvider.channelLabel(lang)}</div>
        </div>
      </div>

      {/* Live captions / transcript */}
      <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4">
        {live && (
          <>
            <VoiceWaveform active={state === "speaking"} tone="white" />
            <div className="max-h-52 w-full overflow-y-auto text-center">
              <AnimatePresence mode="popLayout">
                {lines.slice(-2).map((l) => (
                  <motion.p
                    key={l.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-2 text-[1.05rem] leading-relaxed text-white/90"
                  >
                    {l.text}
                  </motion.p>
                ))}
              </AnimatePresence>
            </div>

            {state === "awaiting_reply" && currentStep?.replies && (
              <div className="mt-4 flex w-full flex-col gap-2.5">
                {currentStep.replies.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => reply(r.next, r.action)}
                    className="rounded-full bg-white/10 px-5 py-3 text-[0.95rem] font-medium text-white transition-colors hover:bg-white/20"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {state === "ended" && <p className="text-sm text-white/60">{t("call.endedNote")}</p>}
      </div>

      {/* Call controls */}
      <div className="flex items-center gap-10 pb-4">
        {ringing && (
          <>
            <CallButton tone="danger" onClick={handleDecline} label={t("call.decline")}>
              <PhoneOff className="h-6 w-6" />
            </CallButton>
            <CallButton tone="confirm" onClick={accept} label={t("call.accept")}>
              <Phone className="h-6 w-6" />
            </CallButton>
          </>
        )}
        {live && (
          <CallButton tone="danger" onClick={handleDecline} label={t("call.hangUp")}>
            <PhoneOff className="h-6 w-6" />
          </CallButton>
        )}
      </div>

      <p className="text-[0.7rem] italic text-white/40">{t("call.simNote")}</p>
    </motion.div>,
    document.body
  );
}

function CallButton({
  children,
  onClick,
  tone,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: "confirm" | "danger";
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "grid h-16 w-16 place-items-center rounded-full text-white shadow-lg transition-transform hover:scale-105",
        tone === "confirm" ? "bg-confirm" : "bg-danger"
      )}
    >
      {children}
    </button>
  );
}
