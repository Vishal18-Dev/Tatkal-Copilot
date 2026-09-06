import type { CopilotContext, ToolResult } from "./types";
import {
  getBackupOption,
  getBookingStatus,
  getIdentityStatus,
  getJourneyContext,
  getReadiness,
  getRecommendations,
  getTatkalStatus,
  getWalletBalance,
  explainBookingAuthority,
} from "./tools";

/* ============================================================
   Question router — maps a (Sarvam-translated, English) spoken
   question to one informational tool. Deliberately keyword-based
   and dependency-free so it's deterministic and testable. Because
   STT runs in translate mode, this works for all 10 spoken
   languages without a router per language.

   Order matters: earlier, more specific matches win.
   ============================================================ */

type Reader = (ctx: CopilotContext) => ToolResult;

const RULES: { test: RegExp; tool: string; run: Reader }[] = [
  { test: /\b(backup|plan b|alternative|other train|if.*(fail|doesn'?t|not).*(confirm|available))\b/i, tool: "get_backup_option", run: getBackupOption },
  // Wallet before readiness so "payment ready" routes to the wallet, not readiness.
  { test: /\b(wallet|balance|money|enough|afford|payment|pay|how much.*(cost|pay))\b/i, tool: "get_wallet_balance", run: getWalletBalance },
  { test: /\b(ready|prepared|missing|what.*(need|left)|am i set|everything set)\b/i, tool: "get_readiness", run: getReadiness },
  { test: /\b(identity|aadhaar|aadhar|verified|verification|kyc)\b/i, tool: "get_identity_status", run: getIdentityStatus },
  { test: /\b(tatkal|window|when.*open|what time|opens?|how long)\b/i, tool: "get_tatkal_status", run: getTatkalStatus },
  { test: /\b(book it|book now|start booking|can you book|will you book)\b/i, tool: "explain_booking_authority", run: explainBookingAuthority },
  { test: /\b(booked|confirmed|pnr|booking status|is it done|status)\b/i, tool: "get_booking_status", run: getBookingStatus },
  { test: /\b(why this|which train|recommend|best option|best train|primary|fare|price|cost)\b/i, tool: "get_recommendations", run: getRecommendations },
  { test: /\b(journey|trip|where.*going|my plan|route)\b/i, tool: "get_journey_context", run: getJourneyContext },
];

export interface RoutedAnswer {
  tool: string;
  result: ToolResult;
}

/**
 * Route a spoken question to a tool and run it against the context.
 * Returns null when nothing matches — the caller should then stay on the
 * current recommendation rather than guessing (spec §11/§14).
 */
export function answerWithTools(question: string, ctx: CopilotContext): RoutedAnswer | null {
  for (const rule of RULES) {
    if (rule.test.test(question)) {
      return { tool: rule.tool, result: rule.run(ctx) };
    }
  }
  return null;
}
