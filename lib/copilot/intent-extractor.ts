import { extractJourneyConstraints, type ExtractedJourneyConstraints } from "./journey-state";

export interface StructuredJourneyIntent extends ExtractedJourneyConstraints {
  optimizationPreference?: "fastest_total_journey" | "safest" | "cheapest" | "arrival_time";
  allowExpandedStationSearch?: boolean;
  source?: "openai" | "regex" | "gemini";
}

/**
 * Extracts structured journey intent using OpenAI GPT-4o-mini if available,
 * with automatic validation and fallback to deterministic regex extraction.
 */
export async function extractStructuredIntent(
  text: string,
  pendingClarification?: import("./journey-state").ConversationalJourneyState["pendingClarification"]
): Promise<StructuredJourneyIntent> {
  const fallback = extractJourneyConstraints(text, pendingClarification);


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
  "maxFare": number or null,
  "maxPremiumTatkalFare": number or null,
  "allowPremiumTatkal": boolean or null,
  "excludePremiumTatkal": boolean or null,
  "priceSensitivity": "low" | "medium" | "high" or null,
  "confirmationPriority": "low" | "medium" | "high" or null,
  "arrivalPriority": "low" | "medium" | "high" or null,
  "optimizationPreference": "fastest_total_journey" | "safest" | "cheapest" | "arrival_time" or null,
  "allowExpandedStationSearch": boolean or null
}

Rule: Do NOT invent train numbers, stations, schedules, fares, or Tatkal availability. Extract ONLY what the user stated.

User utterance: "${text.replace(/"/g, '\\"')}"`;

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) return { ...fallback, source: "regex" };

    const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;

    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      return { ...fallback, source: "regex" };
    }

    const data = await res.json();
    // Gemini response: candidates[0].content.parts[0].text
    const rawText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return { ...fallback, source: "regex" };

    // Strip any accidental markdown fences
    const stripped = rawText.trim().replace(/^```(?:json)?|```$/g, "").trim();
    const parsed = JSON.parse(stripped);


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

    // Strategy constraints
    const maxFare = typeof parsed.maxFare === "number" ? parsed.maxFare : fallback.maxFare;
    const maxPremiumTatkalFare = typeof parsed.maxPremiumTatkalFare === "number" ? parsed.maxPremiumTatkalFare : fallback.maxPremiumTatkalFare;
    let allowedQuotas = fallback.allowedQuotas;
    let excludedQuotas = fallback.excludedQuotas;

    if (parsed.excludePremiumTatkal === true) {
      excludedQuotas = ["PT"];
      allowedQuotas = ["TQ", "GN"];
    } else if (parsed.allowPremiumTatkal === true) {
      allowedQuotas = ["TQ", "PT"];
    }

    const priceSensitivity = (parsed.priceSensitivity as "low" | "medium" | "high") || fallback.priceSensitivity;
    const confirmationPriority = (parsed.confirmationPriority as "low" | "medium" | "high") || fallback.confirmationPriority;
    const arrivalPriority = (parsed.arrivalPriority as "low" | "medium" | "high") || fallback.arrivalPriority;

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
      maxFare,
      maxPremiumTatkalFare,
      allowedQuotas,
      excludedQuotas,
      priceSensitivity,
      confirmationPriority,
      arrivalPriority,
      allowAutomaticFallback: fallback.allowAutomaticFallback,
      optimizationPreference: parsed.optimizationPreference || "fastest_total_journey",
      allowExpandedStationSearch: parsed.allowExpandedStationSearch ?? true,
      isCorrection: fallback.isCorrection,
      correctedFields: fallback.correctedFields,
      source: "gemini",
    };
  } catch (err) {
    console.warn("[intent-extractor] Gemini extraction failed, falling back to regex:", err);
    return { ...fallback, source: "regex" };
  }
}
