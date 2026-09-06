import { NextResponse } from "next/server";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import { voiceProvider } from "@/lib/voice/provider";
import { bcp47For, isVoiceLang, type VoiceLang } from "@/lib/voice/languages";
import { VOICE_REQUEST_TIMEOUT_MS } from "@/lib/voice/types";
import type { Lang } from "@/lib/i18n";
import type { VoiceErrorKind, VoiceRespondResult } from "@/lib/voice/types";
import type { Plan, StrategyOption, Trip } from "@/types";
import type { ConversationalJourneyState } from "@/lib/copilot/journey-state";
import type { RankedJourneyOption, JourneyResolutionResult } from "@/lib/geo/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const startedAt = Date.now();

  const body = (await req.json().catch(() => ({}))) as {
    transcript?: string;
    lang?: Lang;
    voiceLang?: string;
    speak?: boolean;
    journeyState?: ConversationalJourneyState;
    trip?: Trip;
  };
  const { transcript, speak = true, journeyState, trip } = body;
  const voiceLang: VoiceLang = resolveVoiceLang(body.voiceLang, body.lang);
  const bcp47 = bcp47For(voiceLang);

  if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
    return fail("planner_error", 400, "transcript required");
  }

  let turnResult;
  try {
    turnResult = await executeCopilotTurn({
      channel: "browser_voice",
      text: transcript,
      language: voiceLang,
      journeyState,
      trip,
    });
  } catch (err) {
    return fail("planner_error", 500, err instanceof Error ? err.message : "copilot brain threw");
  }

  const { plan, recommended, voiceState } = buildPlanFromTurnResult(turnResult, transcript);
  const responseText = turnResult.speakText;

  const result: VoiceRespondResult = {
    plan,
    recommended,
    responseText,
    voiceLang: turnResult.language,
    journeyState: turnResult.journeyState,
    trip: turnResult.trip,
    voiceState,
  };

  const hasKey = !!process.env.SARVAM_API_KEY;
  if (speak && hasKey && responseText) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VOICE_REQUEST_TIMEOUT_MS);
    try {
      const tts = await voiceProvider.synthesize(responseText, bcp47, controller.signal);
      result.audioBase64 = tts.audioBase64;
      result.audioCodec = tts.audioCodec;
    } catch (err) {
      console.warn(
        `[api/voice/respond] tts_error, continuing text-only: ${err instanceof Error ? err.message : err}`
      );
    } finally {
      clearTimeout(timer);
    }
  }

  console.info(
    `[api/voice/respond] ok lang=${voiceLang} ms=${Date.now() - startedAt} recommended=${recommended?.id ?? "none"} audio=${!!result.audioBase64}`
  );

  return NextResponse.json(result);
}

function buildPlanFromTurnResult(
  turnResult: Awaited<ReturnType<typeof executeCopilotTurn>>,
  transcript: string
): {
  plan: Plan;
  recommended: StrategyOption | null;
  voiceState: "awaiting_clarification" | "showing_results" | "no_results" | "showing_info";
} {
  const journeyState = turnResult.journeyState;
  const trip = turnResult.trip;
  const rawData = turnResult.toolResult?.data as any;

  let options: StrategyOption[] = [];
  let voiceState: "awaiting_clarification" | "showing_results" | "no_results" | "showing_info" = "showing_info";

  if (rawData?.needsOrigin || rawData?.needsDestination) {
    voiceState = "awaiting_clarification";
  } else if (rawData?.rankedOptions && rawData.rankedOptions.length > 0) {
    options = rawData.rankedOptions.map(rankedOptionToStrategyOption);
    voiceState = "showing_results";
  } else if (trip?.primary) {
    const primaryOpt = tripToStrategyOption(trip, true);
    const backupOpt = trip.backup ? tripToStrategyOption(trip, false) : undefined;
    options = [primaryOpt, ...(backupOpt ? [backupOpt] : [])];
    voiceState = "showing_results";
  } else if (journeyState?.originText && journeyState?.destinationText) {
    voiceState = "no_results";
  } else {
    voiceState = "showing_info";
  }

  const recommended = options.length > 0 ? options[0] : null;

  const plan: Plan = {
    intent: {
      from: journeyState?.originText || trip?.from || "Origin",
      fromCode: trip?.fromCode || "ORIG",
      to: journeyState?.destinationText || trip?.to || "Destination",
      toCode: trip?.toCode || "DEST",
      date: journeyState?.travelDate || "Tomorrow",
      arrivalDeadline: journeyState?.timeConstraint ? journeyState.timeConstraint.raw : null,
      passengers: journeyState?.passengerCount || 1,
      preferredClass: (journeyState?.travelClass as any) || "3A",
      priority: journeyState?.priority === "fastest" ? "arrival-time" : (journeyState?.priority || "safest"),
      flexibility: 0.6,
      restated: transcript,
    },
    options,
    recommendedId: recommended ? recommended.id : "",
    narrative: {
      whyRecommended: recommended
        ? `Top-ranked strategy for ${journeyState?.originText || trip?.from || "your route"} to ${journeyState?.destinationText || trip?.to || "destination"}`
        : turnResult.speakEnglish,
    },
    source: "gpt",
  };

  return { plan, recommended, voiceState };
}

function rankedOptionToStrategyOption(ro: RankedJourneyOption, index: number): StrategyOption {
  const confLevel =
    ro.tatkalConfirmProbability > 80 ? "Very High" : ro.tatkalConfirmProbability > 60 ? "High" : "Medium";
  return {
    id: ro.optionId,
    kind: "direct",
    title: ro.train.name,
    subtitle: `#${ro.train.number} · ${Math.floor(ro.totalDurationMins / 60)}h ${ro.totalDurationMins % 60}m`,
    travelClass: ro.travelClass,
    stars: ro.tatkalConfirmProbability > 80 ? 5 : ro.tatkalConfirmProbability > 60 ? 4 : 3,
    confirmProbability: ro.tatkalConfirmProbability,
    level: confLevel,
    departureDisplay: ro.train.departure,
    arrivalDisplay: ro.train.arrival + " · tomorrow",
    durationDisplay: `${Math.floor(ro.totalDurationMins / 60)}h ${ro.totalDurationMins % 60}m`,
    fare: ro.fare,
    boardingStationCode: ro.boardingStation.code,
    boardingStationName: ro.boardingStation.name,
    betterBoarding: ro.boardingStation.code !== ro.train.fromCode,
    tag: index === 0 ? "recommended" : "popular",
    tagLabel: index === 0 ? "Recommended" : "Option",
    meetsDeadline: true,
    why: ro.reason,
    risks: [],
    tradeoffs: [],
    recommended: index === 0,
    tatkalOpensAt: ro.train.tatkalOpensAt || "10:00 AM",
    trainNumber: ro.train.number,
  };
}

function tripToStrategyOption(trip: Trip, isPrimary: boolean): StrategyOption {
  const target = isPrimary ? trip.primary : trip.backup;
  if (!target) {
    throw new Error("Missing trip option target");
  }
  return {
    id: target.optionId || (isPrimary ? `primary_${trip.id}` : `backup_${trip.id}`),
    kind: "direct",
    title: target.trainName,
    subtitle: `${trip.fromCode} → ${trip.toCode}`,
    travelClass: target.travelClass,
    stars: target.level === "High" ? 4 : 3,
    confirmProbability: target.level === "High" ? 75 : 50,
    level: target.level === "High" ? "High" : "Medium",
    departureDisplay: target.departureDisplay,
    arrivalDisplay: target.arrivalDisplay,
    durationDisplay: "12h",
    fare: target.fare,
    boardingStationCode: trip.fromCode,
    boardingStationName: target.boardingStationName,
    betterBoarding: false,
    tag: isPrimary ? "recommended" : "popular",
    tagLabel: isPrimary ? "Recommended" : "Backup",
    meetsDeadline: true,
    why: isPrimary ? "Primary Tatkal strategy option" : "Prepared backup option",
    risks: [],
    tradeoffs: [],
    recommended: isPrimary,
    tatkalOpensAt: trip.tatkalOpensAtLabel || "10:00 AM",
  };
}

function resolveVoiceLang(voiceLang: string | undefined, lang: Lang | undefined): VoiceLang {
  if (voiceLang && isVoiceLang(voiceLang)) return voiceLang;
  if (lang && isVoiceLang(lang)) return lang;
  return "en";
}

function fail(errorKind: VoiceErrorKind, status: number, detail?: string) {
  console.warn(`[api/voice/respond] ${errorKind}${detail ? `: ${detail}` : ""}`);
  return NextResponse.json({ errorKind }, { status });
}

