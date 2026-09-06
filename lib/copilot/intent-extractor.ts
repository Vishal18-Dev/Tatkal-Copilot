import { extractJourneyConstraints, type ExtractedJourneyConstraints } from "./journey-state";

export interface StructuredJourneyIntent extends ExtractedJourneyConstraints {
  optimizationPreference?: "fastest_total_journey" | "safest" | "cheapest" | "arrival_time";
  allowExpandedStationSearch?: boolean;
  source?: "openai" | "regex";
}

/**
 * Extracts structured journey intent using OpenAI GPT-4o-mini if available,
 * with automatic validation and fallback to deterministic regex extraction.
 */
export async function extractStructuredIntent(
  text: string,
  pendingClarification?: "origin" | "destination"
): Promise<StructuredJourneyIntent> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const fallback = extractJourneyConstraints(text, pendingClarification);

  if (!apiKey) {
    return { ...fallback, source: "regex" };
  }

  try {
    const prompt = `You are a strict journey intent parser for Indian Railways travel planning.
Extract structured travel constraints from the user utterance.
${pendingClarification ? `NOTE: Copilot previously asked the user for their ${pendingClarification}. The user utterance is directly answering that question.` : ""}
Return ONLY valid JSON matching this schema:
{
  "originText": string or null,
  "destinationText": string or null,
  "residentOf": string or null,
  "boardingStationPreference": string or null,
  "travelDate": string or null (e.g. "tomorrow", "today", "day_after_tomorrow"),
  "travelClass": string or null (e.g. "3A", "2A", "1A", "SL"),
  "passengerCount": number or null,
  "optimizationPreference": "fastest_total_journey" | "safest" | "cheapest" | "arrival_time" or null,
  "allowExpandedStationSearch": boolean or null
}

Rule: Do NOT invent train numbers, stations, schedules, fares, or Tatkal availability. Extract ONLY what the user stated.

User utterance: "${text.replace(/"/g, '\\"')}"`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });

    if (!res.ok) {
      return { ...fallback, source: "regex" };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { ...fallback, source: "regex" };

    const parsed = JSON.parse(content);

    // When answering a pending clarification question, prioritize deterministic fallback extraction if provided
    let validatedOrigin = typeof parsed.originText === "string" && parsed.originText.trim() ? parsed.originText.trim() : fallback.originText;
    let validatedDest = typeof parsed.destinationText === "string" && parsed.destinationText.trim() ? parsed.destinationText.trim() : fallback.destinationText;

    if (pendingClarification === "origin") {
      validatedOrigin = fallback.originText ?? validatedOrigin;
      if (fallback.originText && validatedDest === fallback.originText) {
        validatedDest = undefined;
      }
    } else if (pendingClarification === "destination") {
      validatedDest = fallback.destinationText ?? validatedDest;
      if (fallback.destinationText && validatedOrigin === fallback.destinationText) {
        validatedOrigin = undefined;
      }
    }

    const validatedBoarding = typeof parsed.boardingStationPreference === "string" && parsed.boardingStationPreference.trim() ? parsed.boardingStationPreference.trim() : fallback.boardingStationPreference;
    const validatedClass = typeof parsed.travelClass === "string" && parsed.travelClass.trim() ? parsed.travelClass.toUpperCase().trim() : fallback.travelClass;
    const validatedPax = typeof parsed.passengerCount === "number" && parsed.passengerCount > 0 ? parsed.passengerCount : fallback.passengerCount;
    const validatedDate = typeof parsed.travelDate === "string" && parsed.travelDate.trim() ? parsed.travelDate.trim() : fallback.travelDate;

    return {
      originText: validatedOrigin,
      destinationText: validatedDest,
      residentOf: typeof parsed.residentOf === "string" && parsed.residentOf.trim() ? parsed.residentOf.trim() : fallback.residentOf,
      boardingStationPreference: validatedBoarding,
      excludeStationCode: fallback.excludeStationCode,
      excludeStationText: fallback.excludeStationText,
      priority: fallback.priority,
      travelDate: validatedDate,
      timeConstraint: fallback.timeConstraint,
      passengerCount: validatedPax,
      travelClass: validatedClass,
      optimizationPreference: parsed.optimizationPreference || "fastest_total_journey",
      allowExpandedStationSearch: parsed.allowExpandedStationSearch ?? true,
      isCorrection: fallback.isCorrection,
      correctedFields: fallback.correctedFields,
      source: "openai",
    };
  } catch (err) {
    console.warn("[intent-extractor] OpenAI extraction failed, falling back to regex:", err);
    return { ...fallback, source: "regex" };
  }
}
