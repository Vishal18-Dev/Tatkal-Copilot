import type { CandidateStation, ResolvedLocation, GeoCoordinates } from "./types";
import { stations, trains } from "@/lib/data";
import { haversineDistanceKm } from "./location-resolver";
import { realStationProvider } from "./providers/real-station-provider";
import { demoStationProvider } from "./providers/demo-station-provider";
import type { Station } from "@/types";

export interface DiscoverBoardingOptions {
  explicitStationCode?: string;
  excludeStationCode?: string;
  radiusKm?: number;
  maxCandidates?: number;
}

/**
 * Discovers candidate boarding stations for an origin location relative to a destination.
 * Destination-aware: filters out stations that do not have any train reaching the destination,
 * unless explicitly requested via explicitStationCode.
 */
export function discoverBoardingStations(
  originLocation: ResolvedLocation,
  destination: ResolvedLocation,
  options?: DiscoverBoardingOptions
): CandidateStation[] {
  const radiusKm = options?.radiusKm ?? 60;
  const maxCandidates = options?.maxCandidates ?? 5;
  const explicitCode = options?.explicitStationCode?.toUpperCase();
  const excludeCode = options?.excludeStationCode?.toUpperCase().trim();

  // 1. Determine destination station codes
  const destStations = realStationProvider.findDestinationStations(destination);
  const destCodes = new Set(destStations.map((s) => s.code));

  // Find all train routes reaching the destination codes
  const validFromCodes = new Set<string>();
  for (const t of trains) {
    if (destCodes.has(t.toCode)) {
      validFromCodes.add(t.fromCode);
      if (t.alternateBoarding) {
        for (const ab of t.alternateBoarding) {
          validFromCodes.add(ab.stationCode);
        }
      }
    }
  }

  // 2. Discover nearby stations based on coordinates or city
  let nearbyGeoRecords = originLocation.coordinates
    ? realStationProvider.findStationsWithinRadiusKm(originLocation.coordinates, radiusKm)
    : [];

  if (nearbyGeoRecords.length === 0) {
    const all = realStationProvider.getAllStations();
    nearbyGeoRecords = all.filter((s) => s.city.toLowerCase() === originLocation.city.toLowerCase());
  }

  if (nearbyGeoRecords.length === 0) {
    nearbyGeoRecords = demoStationProvider.getAllStations();
  }

  // 3. Build candidate list
  const originCoords: GeoCoordinates = originLocation.coordinates ?? {
    latitude: nearbyGeoRecords[0]?.latitude ?? 18.969,
    longitude: nearbyGeoRecords[0]?.longitude ?? 72.82,
  };

  const candidates: CandidateStation[] = [];

  for (const sg of nearbyGeoRecords) {
    // Negative station filter: skip if explicitly excluded by user constraint
    if (
      excludeCode &&
      (sg.code.toUpperCase() === excludeCode ||
        sg.name.toUpperCase().includes(excludeCode) ||
        (excludeCode.includes("PUNE") && (sg.code === "PUNE" || sg.name.toUpperCase() === "PUNE JUNCTION")))
    ) {
      continue;
    }
    const isExplicit = explicitCode === sg.code;
    const isReachable = validFromCodes.has(sg.code);
    const distanceKm = haversineDistanceKm(originCoords, { latitude: sg.latitude, longitude: sg.longitude });

    // Include nearby stations within radius so dynamic discovery can query them
    if (!isReachable && !isExplicit && validFromCodes.size > 0 && distanceKm > 60) {
      continue;
    }

    const estimatedTransitMins = Math.round((distanceKm / 25) * 60 + 10);

    let convenience = Math.max(10, Math.round(100 - distanceKm * 2.0));
    if (isExplicit) convenience += 25;

    const stationObj: Station = stations.find((s) => s.code === sg.code) || {
      code: sg.code,
      name: sg.name,
      city: sg.city,
    };

    let note = `${distanceKm} km from ${originLocation.name} (~${estimatedTransitMins} mins access)`;
    if (isExplicit) note += " · Explicit User Boarding Preference";
    else if (!isReachable) note += " · No direct trains to destination from this station";

    candidates.push({
      station: stationObj,
      distanceKm,
      estimatedTransitMins,
      isDirectBoarding: distanceKm <= 10,
      convenienceScore: Math.min(100, Math.max(0, convenience)),
      isDestinationReachable: isReachable,
      isExplicitPreference: isExplicit,
      note,
    });
  }

  if (explicitCode && !candidates.some((c) => c.station.code === explicitCode)) {
    const explicitStationRecord = realStationProvider.getAllStations().find((s) => s.code === explicitCode);
    const stationObj: Station = stations.find((s) => s.code === explicitCode) || {
      code: explicitCode,
      name: explicitStationRecord?.name ?? explicitCode,
      city: explicitStationRecord?.city ?? originLocation.city,
    };
    const distanceKm = explicitStationRecord
      ? haversineDistanceKm(originCoords, { latitude: explicitStationRecord.latitude, longitude: explicitStationRecord.longitude })
      : 15;
    const estimatedTransitMins = Math.round((distanceKm / 25) * 60 + 10);
    const isReachable = validFromCodes.has(explicitCode);

    candidates.unshift({
      station: stationObj,
      distanceKm,
      estimatedTransitMins,
      isDirectBoarding: distanceKm <= 10,
      convenienceScore: 95,
      isDestinationReachable: isReachable,
      isExplicitPreference: true,
      note: `Explicit Boarding Preference (${distanceKm} km away)${!isReachable ? " · No direct train to destination" : ""}`,
    });
  }

  candidates.sort((a, b) => {
    if (a.isExplicitPreference && !b.isExplicitPreference) return -1;
    if (!a.isExplicitPreference && b.isExplicitPreference) return 1;
    if (a.isDestinationReachable && !b.isDestinationReachable) return -1;
    if (!a.isDestinationReachable && b.isDestinationReachable) return 1;
    const aIsTerminal = ["PUNE", "BCT", "NDLS", "HWH", "SBC", "MAS"].includes(a.station.code);
    const bIsTerminal = ["PUNE", "BCT", "NDLS", "HWH", "SBC", "MAS"].includes(b.station.code);
    if (aIsTerminal && !bIsTerminal) return -1;
    if (!aIsTerminal && bIsTerminal) return 1;
    return b.convenienceScore - a.convenienceScore;
  });

  return candidates.slice(0, maxCandidates);
}

/**
 * Discovers candidate railway stations for a resolved place.
 */
export function discoverNearbyStations(
  location: ResolvedLocation,
  role: "origin" | "destination" = "origin"
): CandidateStation[] {
  if (location.kind === "station" && location.matchedStationCode) {
    const directStation = stations.find((s) => s.code === location.matchedStationCode) || {
      code: location.matchedStationCode,
      name: location.name,
      city: location.city,
    };
    return [
      {
        station: directStation,
        distanceKm: 0,
        estimatedTransitMins: 0,
        isDirectBoarding: true,
        convenienceScore: 100,
        isDestinationReachable: true,
        note: "Directly specified station",
      },
    ];
  }

  const dummyDest: ResolvedLocation = {
    rawQuery: "any",
    name: "Any",
    city: role === "origin" ? "Delhi" : location.city,
    kind: "city",
    confidence: 1.0,
  };

  return discoverBoardingStations(location, dummyDest);
}
