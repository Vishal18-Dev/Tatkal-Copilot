"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const emptySubscribe = () => () => {};
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, PhoneIncoming, PhoneCall, Mic, MicOff, Keyboard, Send } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { buildCallScript } from "@/lib/calling/script";
import { useCallConversation } from "@/lib/calling/conversation";
import { callingProvider, RealCallingProvider, type CallReason, type PlacedCall } from "@/lib/calling/provider";
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

  // Browser geolocation retrieval for origin signal
  const [geolocation, setGeolocation] = useState<{ latitude: number; longitude: number } | undefined>();
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeolocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        () => {}
      );
    }
  }, []);

  // Accessibility keyboard fallback toggle
  const [showKeyboardFallback, setShowKeyboardFallback] = useState(false);
  const [typedText, setTypedText] = useState("");

  const ctx: CopilotContext = {
    lang,
    trip: activeTrip ?? undefined,
    wallet,
    identity,
    travellers,
    geolocation,
  };
  const script = buildCallScript(ctx, user?.name, lang);

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

  const {
    state,
    lines,
    interimText,
    isMuted,
    ring,
    accept,
    decline,
    interrupt,
    toggleMute,
    handleUserTurn,
  } = useCallConversation(
    script,
    lang,
    (action) => {
      if (action === "open_trip" && activeTrip) router.push(`/app/trips/${activeTrip.id}`);
      if (action === "open_plan") router.push("/app/plan");
    },
    activeTrip,
    geolocation
  );

  useEffect(() => {
    if (!placed?.ok) return;
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

  function handleSendTyped() {
    if (!typedText.trim()) return;
    void handleUserTurn(typedText.trim());
    setTypedText("");
    setShowKeyboardFallback(false);
  }

  // Real telephony dial
  const [dialing, setDialing] = useState(false);
  const [dialMsg, setDialMsg] = useState<string | null>(null);
  async function callMyMobile() {
    if (dialing) return;
    const rawDigits = (user?.phone ?? "").replace(/\D/g, "");
    const isDummy = !rawDigits || rawDigits === "1234567890" || rawDigits.endsWith("1234567890");
    const targetPhone = isDummy
      ? "+917483976130"
      : user?.phone?.startsWith("+")
        ? user.phone
        : `+91${rawDigits}`;

    setDialing(true);
    setDialMsg(null);
    const real = new RealCallingProvider();
    const r = await real.placeCall({
      reason: reasonFor(activeTrip),
      tripId: activeTrip?.id,
      toName: user?.name,
      toNumber: targetPhone,
      briefing: script.steps.start.text,
    });
    setDialing(false);
    setDialMsg(r.ok ? t("call.dialing") : r.error ?? t("call.cannotPlace"));
  }

  const ringing = state === "ringing";
  const live =
    state === "connecting" ||
    state === "speaking" ||
    state === "listening" ||
    state === "thinking" ||
    state === "interrupted" ||
    state === "awaiting_reply";

  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  if (!mounted) return null;

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
      className="fixed inset-0 z-[70] flex flex-col items-center justify-between bg-[#0b1626] px-6 py-10 text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={t("call.title")}
    >
      {/* Caller identity */}
      <div className="flex flex-col items-center gap-3 pt-6 text-center">
        <span className="text-xs font-medium uppercase tracking-wider text-white/50">
          {state === "idle" || ringing
            ? t("call.incoming")
            : state === "connecting"
            ? "Connecting..."
            : isMuted
            ? "Muted"
            : state === "listening"
            ? "Listening (Speak naturally)..."
            : state === "thinking"
            ? "Thinking..."
            : state === "speaking"
            ? "Speaking..."
            : state === "interrupted"
            ? "Interrupted"
            : state === "ended"
            ? t("call.ended")
            : t("call.connected")}
        </span>
        <motion.span
          animate={ringing ? { scale: [1, 1.06, 1] } : {}}
          transition={{ duration: 1.1, repeat: ringing ? Infinity : 0 }}
          className="grid h-20 w-20 place-items-center rounded-full bg-white/10 text-white"
        >
          <PhoneIncoming className="h-9 w-9" />
        </motion.span>
        <div>
          <div className="text-xl font-semibold">{script.callerTitle}</div>
          <div className="text-xs text-white/60">{callingProvider.channelLabel(lang)}</div>
        </div>
      </div>

      {/* Live captions / Hands-free transcript */}
      <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4">
        {live && (
          <>
            <VoiceWaveform active={state === "speaking" || (state === "listening" && !isMuted)} tone="white" />
            <div className="max-h-56 w-full overflow-y-auto text-center space-y-2.5 px-2">
              <AnimatePresence mode="popLayout">
                {lines.slice(-4).map((l) => (
                  <motion.div
                    key={l.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "text-[0.95rem] leading-relaxed",
                      l.role === "user" ? "text-brand-soft italic font-medium" : "text-white/95"
                    )}
                  >
                    {l.role === "user" && <span className="text-xs text-white/50 block">You:</span>}
                    {l.text}
                  </motion.div>
                ))}
                {interimText && (
                  <motion.div
                    key="interim"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm italic text-white/70 animate-pulse"
                  >
                    {interimText}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {state === "speaking" && (
              <button
                onClick={interrupt}
                className="mt-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/80 hover:bg-white/20"
              >
                Tap to interrupt (Barge-in)
              </button>
            )}

            {/* Accessibility Keyboard Fallback */}
            {showKeyboardFallback && (
              <div className="mt-2 flex w-full items-center gap-2">
                <input
                  type="text"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendTyped()}
                  placeholder="Type a message..."
                  className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/40"
                />
                <button
                  onClick={handleSendTyped}
                  className="rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
        {state === "ended" && <p className="text-sm text-white/60">{t("call.endedNote")}</p>}
      </div>

      {/* Call controls (No prompt buttons! User speaks naturally) */}
      <div className="flex flex-col items-center gap-4 pb-2">
        <div className="flex items-center gap-6">
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
            <>
              {/* Mute button */}
              <button
                onClick={toggleMute}
                aria-label={isMuted ? "Unmute" : "Mute"}
                className={cn(
                  "grid h-12 w-12 place-items-center rounded-full text-white transition-colors",
                  isMuted ? "bg-amber-600 hover:bg-amber-700" : "bg-white/10 hover:bg-white/20"
                )}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>

              {/* End call button */}
              <CallButton tone="danger" onClick={handleDecline} label={t("call.hangUp")}>
                <PhoneOff className="h-6 w-6" />
              </CallButton>

              {/* Accessibility keyboard toggle */}
              <button
                onClick={() => setShowKeyboardFallback((prev) => !prev)}
                aria-label="Toggle keyboard input fallback"
                className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <Keyboard className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Real mobile dial option */}
        {(ringing || live) && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={callMyMobile}
              disabled={dialing}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3.5 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              {dialing ? t("call.dialingShort") : t("call.callMobile")}
            </button>
            {dialMsg && <span className="max-w-xs text-center text-[0.7rem] text-white/60">{dialMsg}</span>}
          </div>
        )}

        <p className="text-[0.7rem] italic text-white/40">{t("call.simNote")}</p>
      </div>
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
