import type { LocationProvider } from "./types";
import type { GeoCoordinates, ResolvedLocation } from "../types";
import { demoLocationProvider } from "./demo-location-provider";

export interface GooglePlaceResult {
  formattedAddress?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  displayName?: {
    text: string;
    languageCode?: string;
  };
}

export class GoogleLocationProvider implements LocationProvider {
  private apiKey: string;
  private cache: Map<string, ResolvedLocation> = new Map();

  constructor(apiKey?: string) {
    this.apiKey =
      apiKey ||
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      "";
  }

  /**
   * Async place resolution using Google Places API v1 searchText endpoint.
   */
  async resolvePlaceAsync(query: string): Promise<ResolvedLocation | null> {
    const clean = query
      .trim()
      .replace(/^(near|at|in|from|to)\s+/i, "");
    if (!clean) return null;

    const cacheKey = clean.toLowerCase();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (!this.apiKey) {
      return demoLocationProvider.resolvePlace(query);
    }

    try {
      const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
        },
        body: JSON.stringify({ textQuery: clean }),
      });

      if (!response.ok) {
        console.warn(`[google-location] API returned HTTP ${response.status}`);
        return demoLocationProvider.resolvePlace(query);
      }

      const data = (await response.json()) as { places?: GooglePlaceResult[] };
      const place = data.places?.[0];

      if (!place || !place.location) {
        return demoLocationProvider.resolvePlace(query);
      }

      // Infer city from formattedAddress
      const addressParts = (place.formattedAddress || "").split(",").map((p) => p.trim());
      const city = addressParts.length >= 2 ? addressParts[addressParts.length - 3] || addressParts[addressParts.length - 2] : "Unknown";
      const name = place.displayName?.text || clean;

      const resolved: ResolvedLocation = {
        rawQuery: query,
        name,
        city: city || name,
        kind: "locality",
        coordinates: {
          latitude: place.location.latitude,
          longitude: place.location.longitude,
        },
        locality: name,
        source: "google",
        confidence: 0.98,
      };

      this.cache.set(cacheKey, resolved);
      return resolved;
    } catch (err) {
      console.warn("[google-location] Error resolving place via Google Places API:", err);
      return demoLocationProvider.resolvePlace(query);
    }
  }

  /** Sync contract method — checks cache or delegates to demo location provider */
  resolvePlace(query: string): ResolvedLocation | null {
    const clean = query.trim().toLowerCase().replace(/^(near|at|in|from|to)\s+/i, "");
    if (this.cache.has(clean)) {
      return this.cache.get(clean)!;
    }
    return demoLocationProvider.resolvePlace(query);
  }

  resolveCoordinates(lat: number, lng: number): ResolvedLocation {
    return demoLocationProvider.resolveCoordinates(lat, lng);
  }
}

export const googleLocationProvider = new GoogleLocationProvider();
