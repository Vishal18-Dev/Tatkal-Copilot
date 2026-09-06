import type { ResolvedLocation, GeoCoordinates, CandidateStation } from "../types";
import type { Train } from "@/types";

export interface StationGeoRecord {
  code: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  aliases?: string[];
}

export interface LocationProvider {
  resolvePlace(query: string): ResolvedLocation | null;
  resolveCoordinates(lat: number, lng: number): ResolvedLocation;
}

export interface StationProvider {
  getAllStations(): StationGeoRecord[];
  findStationsWithinRadiusKm(center: GeoCoordinates, radiusKm: number): StationGeoRecord[];
  findDestinationStations(destination: ResolvedLocation): StationGeoRecord[];
}

export interface JourneyScore {
  confirmationScore: number;       // Tatkal confirm probability (0-100)
  accessScore: number;             // Origin access time penalty
  onwardScore: number;             // Destination onward access
  trainDurationScore: number;      // Raw train journey time
  boardingPreferenceBonus: number; // +20 if user's explicit station
  totalEstimatedHours: number;
  composite: number;
  reasons: string[];
}

export interface JourneyCandidate {
  boardingStation: StationGeoRecord;
  train: Train;
  arrivalStation: StationGeoRecord;
  accessTimeMins: number;
  onwardTimeMins: number;
  totalEstimatedDurationMins: number;
  score: JourneyScore;
  rankingReasons: string[];
}

export interface DiscoveredTrain {
  number: string;
  name: string;
  type?: string;
  fromCode: string;
  fromName?: string;
  toCode: string;
  toName?: string;
  departureTime?: string;
  arrivalTime?: string;
  runsOn?: string[];
  durationMins?: number;
  source: "railradar" | "catalogue" | "demo";
}

export interface TrainDiscoveryProvider {
  discoverTrains(
    originStations: CandidateStation[],
    destinationStations: CandidateStation[],
    travelDate?: string
  ): Promise<DiscoveredTrain[]>;
}

