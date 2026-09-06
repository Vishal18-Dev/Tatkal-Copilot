import type { Station, Train, StrategyOption, TravelClass } from "@/types";
import type { JourneyScore } from "./providers/types";

export type LocationKind = "city" | "locality" | "landmark" | "station" | "coordinates";

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface ResolvedLocation {
  rawQuery: string;
  name: string;
  city: string;
  kind: LocationKind;
  coordinates?: GeoCoordinates;
  matchedStationCode?: string;
  locality?: string;
  state?: string;
  source?: "google" | "railradar" | "catalogue" | "demo" | "gps" | "user";
  confidence: number;
}

export interface CandidateStation {
  station: Station;
  distanceKm: number;
  estimatedTransitMins: number;
  isDirectBoarding: boolean;
  convenienceScore: number; // 0 - 100
  isDestinationReachable?: boolean;
  isExplicitPreference?: boolean;
  note?: string;
}

export interface JourneyProvenance {
  discoverySource: "railradar" | "catalogue" | "demo";
  stationSource: "google" | "railradar" | "catalogue" | "demo" | "gps" | "user";
  enrichmentSource: "railradar" | "catalogue" | "demo";
  mode: "LIVE" | "DEMO";
}

export interface RankedJourneyOption {
  optionId: string;
  train: Train;
  boardingStation: Station;
  arrivalStation: Station;
  totalDurationMins: number;
  trainDurationMins: number;
  transitToStationMins: number;
  onwardAccessMins?: number;
  totalDoorToDoorMins?: number;
  tatkalConfirmProbability: number;
  fare: number;
  travelClass: TravelClass;
  score: number;
  journeyScore?: JourneyScore;
  rank: number;
  reason: string;
  isPrimary: boolean;
  isBackup: boolean;
  provenance?: JourneyProvenance;
}

export interface JourneyResolutionResult {
  origin: ResolvedLocation;
  destination: ResolvedLocation;
  candidateOriginStations: CandidateStation[];
  candidateDestinationStations: CandidateStation[];
  rankedOptions: RankedJourneyOption[];
  primary: RankedJourneyOption | null;
  backup: RankedJourneyOption | null;
  explanation: string;
  clarificationNeeded?: string;
  hasNoValidJourney?: boolean;
  conflictExplanation?: string;
}

export interface ExtractedTravelQuery {
  originText?: string;
  destinationText?: string;
  isOriginMissing: boolean;
  isDestinationMissing: boolean;
  rawText: string;
}

export type { JourneyScore, JourneyCandidate } from "./providers/types";
