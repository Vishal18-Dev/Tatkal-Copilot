import type { Lang } from "@/lib/i18n";

/* ============================================================
   CallingProvider — the telephony boundary (spec §16).

        PHONE
          ↓
        TELEPHONY        ← this interface
          ↓
        REALTIME VOICE
          ↓
        COPILOT
          ↓
        TOOL LAYER (lib/copilot)   ← the SAME brain as browser voice
          ↓
        EXISTING JOURNEY STATE

   Both providers drive the same Copilot tool layer; only the
   transport differs. The mock powers the in-browser proactive-call
   demo; the real one is the documented seam where a telephony
   vendor (Exotel / Twilio) dials an actual phone. Nothing here
   invents a booking — the call only narrates real journey state
   and hands off to the app.
   ============================================================ */

export type CallReason =
  | "tatkal_open_soon"
  | "primary_failed"
  | "confirmed"
  | "check_in"
  | "no_trip";

export interface OutboundCallContext {
  toName?: string;
  reason: CallReason;
  tripId?: string;
}

export interface PlacedCall {
  ok: boolean;
  /** True for the in-browser simulated call; false for a real telephony call. */
  simulated: boolean;
  sessionId?: string;
  /** User-safe reason when ok === false (e.g. real telephony not configured). */
  error?: string;
}

export interface CallingProvider {
  readonly id: string;
  readonly isReal: boolean;
  /** Short label for the call UI ("Proactive call · Demo" vs a live channel). */
  channelLabel(lang: Lang): string;
  /** Place an outbound proactive call. */
  placeCall(ctx: OutboundCallContext): Promise<PlacedCall>;
}

/**
 * Deterministic and offline. The CallScreen renders the ring, captions and
 * audio in-browser; this represents "the call was placed" so the exact
 * interface a real telephony provider implements is exercised in the demo.
 */
export class MockCallingProvider implements CallingProvider {
  readonly id = "mock-calling";
  readonly isReal = false;

  channelLabel(lang: Lang): string {
    return lang === "hi" ? "प्रोएक्टिव कॉल · डेमो" : "Proactive call · Demo";
  }

  async placeCall(_ctx: OutboundCallContext): Promise<PlacedCall> {
    void _ctx;
    return { ok: true, simulated: true, sessionId: `sim_${Math.random().toString(36).slice(2, 8)}` };
  }
}

/**
 * The seam where real telephony plugs in. Intentionally a stub: a production
 * build would (1) place an outbound call via the vendor's REST API, (2) bridge
 * the call's media to a realtime STT/TTS stream, and (3) drive lib/copilot
 * tools per turn — the same brain browser voice uses. Never enabled in the
 * demo; it dials nothing and reports that it isn't configured.
 */
export class RealCallingProvider implements CallingProvider {
  readonly id = "real-calling";
  readonly isReal = true;

  channelLabel(): string {
    return "Live call";
  }

  async placeCall(): Promise<PlacedCall> {
    return {
      ok: false,
      simulated: false,
      error: "Real telephony isn't configured in this build.",
    };
  }
}

/** Active provider. Swap for RealCallingProvider once telephony is wired. */
export const callingProvider: CallingProvider = new MockCallingProvider();
