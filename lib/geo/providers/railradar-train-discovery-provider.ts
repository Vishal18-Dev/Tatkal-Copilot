import type { TrainDiscoveryProvider, DiscoveredTrain } from "./types";
import type { CandidateStation } from "../types";
import { trains as catalogueTrains } from "@/lib/data";

export interface RailRadarStationTrainItem {
  train: {
    number: string;
    name: string;
    type?: string;
    source?: {
      code: string;
      name: string;
    };
    destination?: {
      code: string;
      name: string;
    };
    runDays?: string[];
  };
  stop?: {
    sequence: number;
    arrival?: string | null;
    departure?: string | null;
    arrivalDay?: number | null;
    departureDay?: number | null;
    distance?: number;
    stopType?: string;
  };
}

export class RailRadarTrainDiscoveryProvider implements TrainDiscoveryProvider {
  private apiKey: string;
  private baseUrl = "https://railradar.in/api/v1";
  private cache: Map<string, { timestamp: number; data: RailRadarStationTrainItem[] }> = new Map();
  private cacheTtlMs = 30 * 60 * 1000; // 30 mins TTL

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.INDIAN_RAILWAYS_API_KEY || "rg_3d8ba894483a4f43ac376ed37128cab1";
  }

  private get headers(): Record<string, string> {
    return {
      "x-api-key": this.apiKey,
      "Authorization": `Bearer ${this.apiKey}`,
      "Accept": "application/json",
    };
  }

  /**
   * Fetches all trains serving a given station from RailRadar API.
   * Cached in memory for 30 minutes to prevent API rate-limit explosions.
   */
  async fetchStationTrains(stationCode: string): Promise<RailRadarStationTrainItem[]> {
    const code = stationCode.toUpperCase();
    const now = Date.now();
    const cached = this.cache.get(code);

    if (cached && now - cached.timestamp < this.cacheTtlMs) {
      return cached.data;
    }

    try {
      const res = await fetch(`${this.baseUrl}/stations/${code}/trains`, {
        headers: this.headers,
      });

      if (!res.ok) {
        console.warn(`[railradar-discovery] HTTP ${res.status} for station ${code}`);
        return [];
      }

      const json = await res.json();
      if (!json.success || !json.data || !Array.isArray(json.data.trains)) {
        return [];
      }

      const items: RailRadarStationTrainItem[] = json.data.trains;
      this.cache.set(code, { timestamp: now, data: items });
      return items;
    } catch (err) {
      console.warn(`[railradar-discovery] Fetch error for station ${code}:`, err);
      return [];
    }
  }

  /**
   * Dynamically discovers candidate trains between arbitrary candidate origin stations
   * and candidate destination stations via RailRadar API.
   */
  async discoverTrains(
    originStations: CandidateStation[],
    destinationStations: CandidateStation[],
    travelDate?: string
  ): Promise<DiscoveredTrain[]> {
    if (process.env.DEMO_MODE === "true") {
      return this.discoverFallbackCatalogue(originStations, destinationStations);
    }

    const destCodes = new Set(destinationStations.map((ds) => ds.station.code.toUpperCase()));
    const discoveredMap = new Map<string, DiscoveredTrain>();

    for (const os of originStations) {
      const originCode = os.station.code.toUpperCase();
      const stationTrains = await this.fetchStationTrains(originCode);

      for (const item of stationTrains) {
        const train = item.train;
        if (!train || !train.number) continue;

        const destCode = train.destination?.code?.toUpperCase();

        // Match direct destination
        if (destCode && destCodes.has(destCode)) {
          const key = `${train.number}-${originCode}-${destCode}`;
          if (!discoveredMap.has(key)) {
            discoveredMap.set(key, {
              number: train.number,
              name: train.name || `Train ${train.number}`,
              type: train.type || "EXPRESS",
              fromCode: originCode,
              fromName: train.source?.name || os.station.name,
              toCode: destCode,
              toName: train.destination?.name,
              departureTime: item.stop?.departure || "10:00",
              runsOn: train.runDays || ["Daily"],
              source: "railradar",
            });
          }
        }
      }
    }

    const liveCandidates = Array.from(discoveredMap.values());

    // If live provider discovered trains, return them.
    if (liveCandidates.length > 0) {
      return liveCandidates;
    }

    // Fallback to static catalogue when live API has no matching trains or for test scenarios
    return this.discoverFallbackCatalogue(originStations, destinationStations);
  }

  private discoverFallbackCatalogue(
    originStations: CandidateStation[],
    destinationStations: CandidateStation[]
  ): DiscoveredTrain[] {
    const destCodes = new Set(destinationStations.map((ds) => ds.station.code.toUpperCase()));
    const originCodes = new Set(originStations.map((os) => os.station.code.toUpperCase()));
    const result: DiscoveredTrain[] = [];

    for (const t of catalogueTrains) {
      const reachesDest = destCodes.has(t.toCode.toUpperCase());
      const startsOrigin = originCodes.has(t.fromCode.toUpperCase());

      if (reachesDest && startsOrigin) {
        result.push({
          number: t.number,
          name: t.name,
          fromCode: t.fromCode,
          toCode: t.toCode,
          departureTime: t.departure,
          arrivalTime: t.arrival,
          durationMins: t.durationMins,
          runsOn: t.runsOn,
          source: "catalogue",
        });
      }

      // Alternate boarding match
      if (reachesDest && t.alternateBoarding) {
        for (const ab of t.alternateBoarding) {
          if (originCodes.has(ab.stationCode.toUpperCase())) {
            result.push({
              number: t.number,
              name: t.name,
              fromCode: ab.stationCode,
              toCode: t.toCode,
              departureTime: t.departure,
              arrivalTime: t.arrival,
              durationMins: t.durationMins - ab.reachesAfterMins,
              runsOn: t.runsOn,
              source: "catalogue",
            });
          }
        }
      }
    }

    return result;
  }
}

export const railRadarTrainDiscoveryProvider = new RailRadarTrainDiscoveryProvider();
