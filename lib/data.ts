import trainsRaw from "@/data/trains.json";
import stationsRaw from "@/data/stations.json";
import splitRaw from "@/data/splitRoutes.json";
import passengersRaw from "@/data/passengers.json";
import missionRaw from "@/data/mission.json";
import type {
  Train,
  Station,
  Passenger,
  ReadinessItem,
  CoachMessage,
} from "@/types";

export const trains = trainsRaw as unknown as Train[];
export const stations = stationsRaw as unknown as Station[];
export const savedPassengers = passengersRaw as unknown as Passenger[];

export interface SplitRouteRecord {
  corridor: string;
  viaCode: string;
  viaName: string;
  legs: {
    trainNumber: string;
    trainName: string;
    fromCode: string;
    toCode: string;
    departure: string;
    arrival: string;
    confirmProbability: number;
  }[];
  combinedConfirmProbability: number;
  fare?: number;
  reason: string;
}
export const splitRoutes = splitRaw as unknown as SplitRouteRecord[];

export const mission = missionRaw as unknown as {
  countdownSeconds: number;
  checklist: ReadinessItem[];
  coach: CoachMessage[];
};

export function stationByCode(code: string): Station | undefined {
  return stations.find((s) => s.code === code);
}

/** Resolve a free-text city / station mention to a station code. */
export function resolveStation(text: string): Station | undefined {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  return (
    stations.find((s) => s.code.toLowerCase() === t) ??
    stations.find(
      (s) =>
        s.city.toLowerCase() === t ||
        s.name.toLowerCase() === t ||
        t.includes(s.city.toLowerCase()) ||
        t.includes(s.name.toLowerCase())
    )
  );
}
