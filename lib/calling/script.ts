import type { Lang } from "@/lib/i18n";
import type { Trip } from "@/types";
import type { CallScript } from "./types";

/**
 * Builds the call script from real trip/agent state — never invents a train,
 * fare, PNR or booking outcome. Mirrors the same three proactive moments
 * described in the product vision (before Tatkal / during booking / a
 * primary failure), branching on the trip's actual `agentState` rather than
 * a fixed narrative. If there's no active trip, the call says so honestly
 * instead of pretending one exists.
 */
export function buildCallScript(trip: Trip | null, userName: string | undefined, lang: Lang): CallScript {
  const hi = lang === "hi";
  const name = userName ? `${hi ? "" : "Hi "}${userName}${hi ? " जी" : ""}` : hi ? "नमस्ते" : "Hi there";
  const callerTitle = hi ? "तत्काल कोपायलट" : "Tatkal Copilot";
  const callerSubtitle = hi ? "प्रोएक्टिव कॉल · डेमो" : "Proactive call · Demo";

  if (!trip) {
    return {
      callerTitle,
      callerSubtitle,
      steps: {
        start: {
          id: "start",
          text: hi
            ? `${name}, अभी आपकी कोई सक्रिय तत्काल योजना नहीं है। क्या मैं एक शुरू करने में मदद करूँ?`
            : `${name}, you don't have an active Tatkal plan right now. Want me to help you start one?`,
          replies: [
            { label: hi ? "हाँ, शुरू करें" : "Yes, let's start", next: "bye_plan", action: "open_plan" },
            { label: hi ? "अभी नहीं" : "Not now", next: "bye_no" },
          ],
        },
        bye_plan: {
          id: "bye_plan",
          text: hi ? "बढ़िया! मैं आपको प्लान स्क्रीन पर ले चल रहा हूँ।" : "Great — taking you to the plan screen now.",
        },
        bye_no: {
          id: "bye_no",
          text: hi ? "ठीक है, जब चाहें बताइएगा। अलविदा!" : "No problem — I'm here whenever you're ready. Bye for now!",
        },
      },
    };
  }

  const primary = trip.primary.trainName;
  const backupLine = trip.backup
    ? hi
      ? `आपका बैकअप ${trip.backup.trainName} भी तैयार है।`
      : `Your backup, ${trip.backup.trainName}, is ready too.`
    : "";

  // Failure / recovery moment.
  if (trip.agentState === "primary_failed" || trip.agentState === "backup_recommended" || trip.agentState === "backup_attempt") {
    return {
      callerTitle,
      callerSubtitle,
      steps: {
        start: {
          id: "start",
          text: hi
            ? `${name}, ${primary} में जगह नहीं मिली। लेकिन घबराइए नहीं — मेरे पास एक बैकअप विकल्प तैयार है।`
            : `${name}, ${primary} didn't come through. Don't worry — I have a backup option ready.`,
          replies: [
            { label: hi ? "बैकअप देखें" : "Show me the backup", next: "bye_trip", action: "open_trip" },
            { label: hi ? "अभी नहीं" : "Not now", next: "bye_no" },
          ],
        },
        bye_trip: {
          id: "bye_trip",
          text: hi ? "मैं आपको अभी वहाँ ले चल रहा हूँ।" : "Taking you there now.",
        },
        bye_no: {
          id: "bye_no",
          text: hi ? "ठीक है, मैं इंतज़ार कर रहा हूँ। अलविदा!" : "Okay, I'll be here when you're ready. Bye for now!",
        },
      },
    };
  }

  // Booking actively underway — informational, no reply needed.
  if (trip.agentState === "window_open" || trip.agentState === "user_action_required" || trip.agentState === "booking_in_progress") {
    return {
      callerTitle,
      callerSubtitle,
      steps: {
        start: {
          id: "start",
          text: hi
            ? `${name}, तत्काल विंडो खुल गई है। आपके प्राथमिक विकल्प ${primary} के लिए कोशिश जारी है।`
            : `${name}, your Tatkal window is open. Your primary option, ${primary}, is being attempted.`,
          replies: [{ label: hi ? "लाइव देखें" : "Watch it live", next: "bye_trip", action: "open_trip" }],
        },
        bye_trip: {
          id: "bye_trip",
          text: hi ? "मैं आपको मिशन कंट्रोल पर ले चल रहा हूँ।" : "Taking you to Mission Control now.",
        },
      },
    };
  }

  // Already confirmed — a happy proactive update.
  if (trip.agentState === "confirmed") {
    return {
      callerTitle,
      callerSubtitle,
      steps: {
        start: {
          id: "start",
          text: hi
            ? `${name}, अच्छी खबर — आपकी ${trip.from} से ${trip.to} यात्रा कन्फर्म हो गई है।`
            : `${name}, good news — your ${trip.from} to ${trip.to} journey is confirmed.`,
          replies: [{ label: hi ? "टिकट देखें" : "Show me the ticket", next: "bye_trip", action: "open_trip" }],
        },
        bye_trip: {
          id: "bye_trip",
          text: hi ? "बढ़िया यात्रा हो!" : "Have a great trip!",
        },
      },
    };
  }

  // Default — the "before Tatkal" proactive check-in.
  return {
    callerTitle,
    callerSubtitle,
    steps: {
      start: {
        id: "start",
        text: hi
          ? `${name}, आपकी ${trip.to} यात्रा तैयार है। तत्काल ${trip.tatkalOpensAtLabel} पर खुलता है। आपका प्राथमिक ट्रेन ${primary} तैयार है। ${backupLine}`
          : `${name}, your ${trip.to} journey is ready. Tatkal opens at ${trip.tatkalOpensAtLabel}. Your primary train, ${primary}, is prepared. ${backupLine}`,
        next: "confirm_proceed",
      },
      confirm_proceed: {
        id: "confirm_proceed",
        text: hi ? "क्या मैं इस योजना के साथ आगे बढ़ूँ?" : "Do you want me to proceed with this plan?",
        replies: [
          { label: hi ? "हाँ, आगे बढ़ें" : "Yes, proceed", next: "bye_trip", action: "open_trip" },
          { label: hi ? "अभी नहीं" : "Not now", next: "bye_no" },
        ],
      },
      bye_trip: {
        id: "bye_trip",
        text: hi ? "बढ़िया, मैं इसका ध्यान रखूँगा। मिलते हैं!" : "Great, I'll take care of it. Talk soon!",
      },
      bye_no: {
        id: "bye_no",
        text: hi ? "कोई बात नहीं, मैं घड़ी पर नज़र रखे हुए हूँ। अलविदा!" : "No problem, I'll keep watching the clock. Bye for now!",
      },
    },
  };
}
