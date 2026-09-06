import type { GeoCoordinates, ResolvedLocation, ExtractedTravelQuery } from "./types";
import { googleLocationProvider } from "./providers/google-location-provider";
import { demoLocationProvider } from "./providers/demo-location-provider";

/** Haversine formula to compute great-circle distance in kilometers */
export function haversineDistanceKm(coord1: GeoCoordinates, coord2: GeoCoordinates): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const dLng = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.latitude * Math.PI) / 180) *
      Math.cos((coord2.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Async location resolution utilizing GoogleLocationProvider with fallback.
 */
export async function resolveLocationAsync(text: string): Promise<ResolvedLocation | null> {
  return googleLocationProvider.resolvePlaceAsync(text);
}

/**
 * Resolve a text mention into a structured ResolvedLocation.
 */
export function resolveLocation(text: string): ResolvedLocation | null {
  return googleLocationProvider.resolvePlace(text);
}

/**
 * Resolves browser GPS coordinates to the closest place / city.
 */
export function resolveLocationFromCoordinates(coords: GeoCoordinates): ResolvedLocation {
  return googleLocationProvider.resolveCoordinates(coords.latitude, coords.longitude);
}

/**
 * Extracts origin and destination places from natural speech or text across English, Hindi, and Hinglish.
 */
export function extractTravelPlaces(text: string): ExtractedTravelQuery {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  let originText: string | undefined = undefined;
  let destinationText: string | undefined = undefined;

  const currentLocationMatch = /\b(where i am|my location|current location|here|idhar se|yahan se)\b/i.test(lower);

  const fromToMatch = clean.match(/(?:from|starting from|start from)\s+([a-zA-Z\s,]+?)\s+(?:to|reach|for)\s+([a-zA-Z\s,]+?)(?:tomorrow|today|kal|by|before|in|\.|$)/i);
  if (fromToMatch) {
    originText = fromToMatch[1].trim();
    destinationText = fromToMatch[2].trim();
  }

  if (!originText || !destinationText) {
    const toFromMatch = clean.match(/(?:to|reach|go to)\s+([a-zA-Z\s,]+?)\s+(?:from|starting from)\s+([a-zA-Z\s,]+?)(?:tomorrow|today|kal|by|before|in|\.|$)/i);
    if (toFromMatch) {
      destinationText = toFromMatch[1].trim();
      originText = toFromMatch[2].trim();
    }
  }

  if (!originText || !destinationText) {
    const inReachMatch = clean.match(/(?:i am in|i'm in|in|at|live in)\s+([a-zA-Z\s,]+?)\s+(?:and need to reach|and want to go to|and going to|need to reach|going to|and i want to go to|i want to go to)\s+([a-zA-Z\s,]+?)(?:tomorrow|today|kal|by|before|in|\.|$)/i);
    if (inReachMatch) {
      originText = inReachMatch[1].trim();
      destinationText = inReachMatch[2].trim();
    }
  }

  if (!originText || !destinationText) {
    const hindiMatch = clean.match(/([a-zA-Z\u0900-\u097F\s,]+?)\s+(?:se)\s+([a-zA-Z\u0900-\u097F\s,]+?)\s+(?:jaana|jana|pahuchna|reach)/i);
    if (hindiMatch) {
      originText = hindiMatch[1].trim();
      destinationText = hindiMatch[2].trim();
    }
  }

  if (!destinationText) {
    const toOnlyMatch = clean.match(/(?:take me to|travel to|tickets? to|going to|go to|reach)\s+([a-zA-Z\s,]+?)(?:tomorrow|today|kal|by|before|in|\.|$)/i) ||
      clean.match(/([a-zA-Z\u0900-\u097F\s,]+?)\s+(?:jaana hai|jana hai|ki ticket)/i);
    if (toOnlyMatch) {
      destinationText = toOnlyMatch[1].trim();
    }
  }

  if (originText && /\b(where i am|my location|current location|here|idhar se|yahan se)\b/i.test(originText)) {
    originText = "current_location";
  }

  if (currentLocationMatch && !originText) {
    originText = "current_location";
  }

  return {
    originText,
    destinationText,
    isOriginMissing: !originText,
    isDestinationMissing: !destinationText,
    rawText: text,
  };
}
