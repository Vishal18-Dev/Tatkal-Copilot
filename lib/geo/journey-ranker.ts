import type {
  ResolvedLocation,
  CandidateStation,
  RankedJourneyOption,
  JourneyResolutionResult,
  JourneyScore,
  JourneyProvenance,
} from "./types";
import { trains } from "@/lib/data";
import { discoverBoardingStations } from "./station-discovery";
import { realStationProvider } from "./providers/real-station-provider";
import { haversineDistanceKm } from "./location-resolver";
import { railRadarTrainDiscoveryProvider } from "./providers/railradar-train-discovery-provider";
import type { Train, TravelClass } from "@/types";

export interface RankJourneyOptions {
  boardingStationPreference?: string;
  excludeStationCode?: string;
  preferredClass?: string;
  allowClassDowngrade?: boolean;
  maxStationDistanceKm?: number;
  timeConstraint?: {
    kind: "by" | "before" | "after" | "around" | "at";
    hour: number;
    minute: number;
    raw: string;
  };
  directOnly?: boolean;
  priority?: "safest" | "cheapest" | "fastest" | "arrival-time";
}

function parseTimeMins(timeStr?: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Resolves origin & destination places, discovers nearby stations,
 * and dynamically ranks all viable trains with explainable door-to-door rationale.
 */
export function resolveAndRankJourney(
  origin: ResolvedLocation,
  destination: ResolvedLocation,
  userPreferences?: RankJourneyOptions
): JourneyResolutionResult {
  const explicitPref = userPreferences?.boardingStationPreference;
  const excludePref = userPreferences?.excludeStationCode;

  // 1. Discover candidate boarding stations
  const originStations = discoverBoardingStations(origin, destination, {
    explicitStationCode: explicitPref,
    excludeStationCode: excludePref,
  });

  // Filter out any origin station matching excludePref
  const filteredOriginStations = originStations.filter((os) => {
    if (!excludePref) return true;
    const codeUpper = os.station.code.toUpperCase();
    const exUpper = excludePref.toUpperCase();
    const nameUpper = os.station.name.toUpperCase();
    return !codeUpper.includes(exUpper) && !exUpper.includes(codeUpper) && !nameUpper.includes(exUpper);
  });

  // 2. Discover candidate arrival stations at destination
  const destStationRecords = realStationProvider.findDestinationStations(destination);
  const destCoords = destination.coordinates ?? {
    latitude: destStationRecords[0]?.latitude ?? 22.5726,
    longitude: destStationRecords[0]?.longitude ?? 88.3639,
  };

  const destStations: CandidateStation[] = destStationRecords
    .filter((sg) => {
      if (!excludePref) return true;
      const codeUpper = sg.code.toUpperCase();
      const exUpper = excludePref.toUpperCase();
      return !codeUpper.includes(exUpper) && !exUpper.includes(codeUpper);
    })
    .map((sg) => {
      const distKm = haversineDistanceKm(destCoords, { latitude: sg.latitude, longitude: sg.longitude });
      const onwardMins = Math.round((distKm / 25) * 60 + 10);
      return {
        station: { code: sg.code, name: sg.name, city: sg.city },
        distanceKm: distKm,
        estimatedTransitMins: onwardMins,
        isDirectBoarding: distKm <= 10,
        convenienceScore: Math.max(10, Math.round(100 - distKm * 2.0)),
        isDestinationReachable: true,
        note: `${distKm} km from ${destination.name}`,
      };
    });

  // 3. Find candidate trains & construct door-to-door options
  const candidateOptions: RankedJourneyOption[] = [];

  for (const train of trains) {
    // Exclude station check for train itself
    if (excludePref) {
      const exUpper = excludePref.toUpperCase();
      if (train.fromCode.toUpperCase().includes(exUpper) || train.toCode.toUpperCase().includes(exUpper)) {
        continue;
      }
    }

    // Check direct fromCode match among origin candidate stations
    const directOriginMatch = filteredOriginStations.find((os) => os.station.code === train.fromCode);

    // Check alternate boarding matches
    const altBoardingMatches = (train.alternateBoarding ?? [])
      .map((ab) => ({
        alt: ab,
        cand: filteredOriginStations.find((os) => os.station.code === ab.stationCode),
      }))
      .filter((m) => Boolean(m.cand));

    const destMatch = destStations.find((ds) => ds.station.code === train.toCode);

    if (destMatch && (directOriginMatch || altBoardingMatches.length > 0)) {
      const preferredCls = userPreferences?.preferredClass || "3A";
      const allowDowngrade = Boolean(userPreferences?.allowClassDowngrade);

      // Determine available classes matching hard constraint
      let targetClasses = train.classes;
      if (!allowDowngrade && userPreferences?.preferredClass) {
        targetClasses = train.classes.filter((c) => c.travelClass.toUpperCase() === preferredCls.toUpperCase());
        if (targetClasses.length === 0) {
          // Hard class constraint not satisfied by this train -> EXCLUDE
          continue;
        }
      }

      for (const clsObj of targetClasses) {
        const baseConfirm = clsObj?.confirmProbability ?? 50;
        const fare = clsObj?.fare ?? 2000;
        const travelClass = (clsObj?.travelClass ?? "3A") as TravelClass;

        // Case A: Direct Boarding at train origin station
        if (directOriginMatch) {
          // Distance constraint check
          if (userPreferences?.maxStationDistanceKm && directOriginMatch.distanceKm > userPreferences.maxStationDistanceKm) {
            continue;
          }

          // Time constraint check
          if (userPreferences?.timeConstraint) {
            const tc = userPreferences.timeConstraint;
            const targetMins = tc.hour * 60 + tc.minute;
            if (tc.kind === "before" || tc.kind === "by") {
              const arrMins = parseTimeMins(train.arrival);
              if (arrMins > targetMins) continue; // Arrives after deadline -> EXCLUDE
            } else if (tc.kind === "after") {
              const depMins = parseTimeMins(train.departure);
              if (depMins < targetMins) continue; // Departs before requested time -> EXCLUDE
            }
          }

          const transitMins = directOriginMatch.estimatedTransitMins;
          const onwardMins = destMatch.estimatedTransitMins;
          const totalDoorToDoorMins = transitMins + train.durationMins + onwardMins;

          const isExplicitBoarding = Boolean(
            explicitPref && explicitPref.toUpperCase() === directOriginMatch.station.code
          );
          const boardingPreferenceBonus = isExplicitBoarding ? 20 : 0;

          const confirmationScore = baseConfirm;
          const accessScore = Math.max(0, 100 - transitMins * 1.2);
          const onwardScore = Math.max(0, 100 - onwardMins * 1.2);
          const trainDurationScore = Math.max(10, 100 - (train.durationMins - 800) / 20);

          let composite =
            confirmationScore * 0.4 +
            accessScore * 0.25 +
            onwardScore * 0.15 +
            trainDurationScore * 0.2 +
            boardingPreferenceBonus +
            15; // Primary train terminal bonus over alternate boarding

          if (userPreferences?.priority === "cheapest") {
            composite += (3000 - fare) * 0.02;
          }

          const reasons: string[] = [];
          reasons.push(
            `Board at ${directOriginMatch.station.name} (${directOriginMatch.distanceKm} km from ${origin.name}, ~${transitMins} mins access)`
          );
          reasons.push(`Tatkal suitability signal: ~${baseConfirm}/100`);
          reasons.push(`Arrives at ${destMatch.station.name} (~${onwardMins} mins onward to ${destination.name})`);
          if (isExplicitBoarding) {
            reasons.push(`User explicit boarding station preference (${directOriginMatch.station.name}) matched`);
          }

          const journeyScore: JourneyScore = {
            confirmationScore,
            accessScore,
            onwardScore,
            trainDurationScore,
            boardingPreferenceBonus,
            totalEstimatedHours: Math.round((totalDoorToDoorMins / 60) * 10) / 10,
            composite: Math.round(composite * 10) / 10,
            reasons,
          };

          const provenance: JourneyProvenance = {
            discoverySource: "catalogue",
            stationSource: origin.source ?? "catalogue",
            enrichmentSource: "catalogue",
            mode: "DEMO",
          };

          candidateOptions.push({
            optionId: `${train.number}-${train.fromCode}-${travelClass}`,
            train,
            boardingStation: directOriginMatch.station,
            arrivalStation: destMatch.station,
            totalDurationMins: totalDoorToDoorMins,
            trainDurationMins: train.durationMins,
            transitToStationMins: transitMins,
            onwardAccessMins: onwardMins,
            totalDoorToDoorMins,
            tatkalConfirmProbability: baseConfirm,
            fare,
            travelClass,
            score: journeyScore.composite,
            journeyScore,
            rank: 0,
            reason: reasons.join(" · "),
            isPrimary: false,
            isBackup: false,
            provenance,
          });
        }

        // Case B: Alternate Boarding
        for (const { alt, cand } of altBoardingMatches) {
          if (!cand) continue;

          // Distance constraint check
          if (userPreferences?.maxStationDistanceKm && cand.distanceKm > userPreferences.maxStationDistanceKm) {
            continue;
          }

          // Time constraint check
          if (userPreferences?.timeConstraint) {
            const tc = userPreferences.timeConstraint;
            const targetMins = tc.hour * 60 + tc.minute;
            if (tc.kind === "before" || tc.kind === "by") {
              const arrMins = parseTimeMins(train.arrival);
              if (arrMins > targetMins) continue;
            } else if (tc.kind === "after") {
              const depMins = parseTimeMins(train.departure);
              if (depMins < targetMins) continue;
            }
          }

          const altConfirm = Math.min(95, baseConfirm + alt.confirmUplift);
          const transitMins = cand.estimatedTransitMins;
          const onwardMins = destMatch.estimatedTransitMins;
          const actualTrainMins = train.durationMins - alt.reachesAfterMins;
          const totalDoorToDoorMins = transitMins + actualTrainMins + onwardMins;

          const isExplicitBoarding = Boolean(explicitPref && explicitPref.toUpperCase() === cand.station.code);
          const boardingPreferenceBonus = isExplicitBoarding ? 20 : 0;

          const confirmationScore = altConfirm;
          const accessScore = Math.max(0, 100 - transitMins * 1.2);
          const onwardScore = Math.max(0, 100 - onwardMins * 1.2);
          const trainDurationScore = Math.max(10, 100 - (actualTrainMins - 800) / 20);

          let composite =
            confirmationScore * 0.4 +
            accessScore * 0.25 +
            onwardScore * 0.15 +
            trainDurationScore * 0.2 +
            boardingPreferenceBonus;

          const reasons: string[] = [];
          reasons.push(
            `Alternate boarding at ${cand.station.name} (${cand.distanceKm} km from ${origin.name}) gives +${alt.confirmUplift}% Tatkal uplift`
          );
          reasons.push(`Tatkal suitability signal: ~${altConfirm}/100`);
          reasons.push(`Arrives at ${destMatch.station.name} (~${onwardMins} mins onward to ${destination.name})`);
          if (isExplicitBoarding) {
            reasons.push(`User explicit boarding station preference (${cand.station.name}) matched`);
          }

          const journeyScore: JourneyScore = {
            confirmationScore,
            accessScore,
            onwardScore,
            trainDurationScore,
            boardingPreferenceBonus,
            totalEstimatedHours: Math.round((totalDoorToDoorMins / 60) * 10) / 10,
            composite: Math.round(composite * 10) / 10,
            reasons,
          };

          const provenance: JourneyProvenance = {
            discoverySource: "catalogue",
            stationSource: origin.source ?? "catalogue",
            enrichmentSource: "catalogue",
            mode: "DEMO",
          };

          candidateOptions.push({
            optionId: `${train.number}-${alt.stationCode}-${travelClass}-alt`,
            train,
            boardingStation: cand.station,
            arrivalStation: destMatch.station,
            totalDurationMins: totalDoorToDoorMins,
            trainDurationMins: actualTrainMins,
            transitToStationMins: transitMins,
            onwardAccessMins: onwardMins,
            totalDoorToDoorMins,
            tatkalConfirmProbability: altConfirm,
            fare,
            travelClass,
            score: journeyScore.composite,
            journeyScore,
            rank: 0,
            reason: reasons.join(" · "),
            isPrimary: false,
            isBackup: false,
            provenance,
          });
        }
      }
    }
  }

  // Sort candidate options according to user preference priority
  if (userPreferences?.priority === "fastest") {
    candidateOptions.sort(
      (a, b) =>
        (a.totalDoorToDoorMins ?? a.totalDurationMins) -
        (b.totalDoorToDoorMins ?? b.totalDurationMins)
    );
  } else if (userPreferences?.priority === "cheapest") {
    candidateOptions.sort((a, b) => a.fare - b.fare);
  } else if (userPreferences?.priority === "safest") {
    candidateOptions.sort(
      (a, b) => b.tatkalConfirmProbability - a.tatkalConfirmProbability || b.score - a.score
    );
  } else {
    // Default: sort by composite score
    candidateOptions.sort((a, b) => b.score - a.score);
  }

  candidateOptions.forEach((opt, idx) => {
    opt.rank = idx + 1;
  });

  const primary = candidateOptions[0] ?? null;
  const backup = candidateOptions.length > 1 ? candidateOptions[1] : null;

  if (primary) primary.isPrimary = true;
  if (backup) backup.isBackup = true;

  // Handle NO VALID JOURNEY state if hard constraints eliminated all options
  if (!primary) {
    const conflictReasons: string[] = [];
    if (excludePref) conflictReasons.push(`Excluded ${excludePref} station.`);
    if (userPreferences?.preferredClass && !userPreferences?.allowClassDowngrade) {
      conflictReasons.push(`Class constrained to ${userPreferences.preferredClass}.`);
    }
    if (userPreferences?.timeConstraint) {
      conflictReasons.push(`Time constraint: ${userPreferences.timeConstraint.raw || `${userPreferences.timeConstraint.kind} ${userPreferences.timeConstraint.hour}:${userPreferences.timeConstraint.minute}`}.`);
    }
    if (userPreferences?.maxStationDistanceKm) {
      conflictReasons.push(`Max station distance: ${userPreferences.maxStationDistanceKm} km.`);
    }

    const conflictExplanation = conflictReasons.length > 0
      ? `There are trains to ${destination.name}, but none satisfy all active hard constraints (${conflictReasons.join(" ")}).`
      : `No direct trains found between candidate stations near ${origin.name} (${origin.city}) and ${destination.name} (${destination.city}).`;

    return {
      origin,
      destination,
      candidateOriginStations: filteredOriginStations,
      candidateDestinationStations: destStations,
      rankedOptions: [],
      primary: null,
      backup: null,
      explanation: `I couldn't find a verified journey that satisfies all your requirements. ${conflictExplanation}`,
      hasNoValidJourney: true,
      conflictExplanation,
    };
  }

  const totalHours = (primary.totalDoorToDoorMins ?? primary.totalDurationMins) / 60;
  const notes: string[] = [];
  if (excludePref) {
    notes.push(`Excluded ${excludePref} station.`);
  }
  if (userPreferences?.priority === "fastest") {
    notes.push("Reranked by speed (fastest door-to-door option selected).");
  } else if (userPreferences?.priority === "cheapest") {
    notes.push("Reranked by fare (cheapest option selected).");
  }

  const notePrefix = notes.length > 0 ? `${notes.join(" ")} ` : "";
  const explanation = `${notePrefix}${primary.train.name} from ${primary.boardingStation.name} to ${primary.arrivalStation.name} is recommended as your primary option (door-to-door ~${totalHours.toFixed(1)}h, fare ₹${primary.fare}, Tatkal suitability / confirmation signal ~${primary.tatkalConfirmProbability}%).${
    backup ? ` Held ready as backup: ${backup.train.name} from ${backup.boardingStation.name} (${backup.tatkalConfirmProbability}% Tatkal suitability).` : ""
  }`;

  return {
    origin,
    destination,
    candidateOriginStations: filteredOriginStations,
    candidateDestinationStations: destStations,
    rankedOptions: candidateOptions,
    primary,
    backup,
    explanation,
  };
}

/**
 * Async dynamic journey resolution using live TrainDiscoveryProvider.
 * Dynamically discovers candidate trains between candidate origin & destination stations via RailRadar API endpoints.
 */
export async function resolveAndRankJourneyAsync(
  origin: ResolvedLocation,
  destination: ResolvedLocation,
  userPreferences?: RankJourneyOptions
): Promise<JourneyResolutionResult> {
  const explicitPref = userPreferences?.boardingStationPreference;
  const excludePref = userPreferences?.excludeStationCode;

  // 1. Discover candidate boarding stations
  const originStations = discoverBoardingStations(origin, destination, {
    explicitStationCode: explicitPref,
    excludeStationCode: excludePref,
  });

  const filteredOriginStations = originStations.filter((os) => {
    if (!excludePref) return true;
    const codeUpper = os.station.code.toUpperCase();
    const exUpper = excludePref.toUpperCase();
    const nameUpper = os.station.name.toUpperCase();
    return !codeUpper.includes(exUpper) && !exUpper.includes(codeUpper) && !nameUpper.includes(exUpper);
  });

  // 2. Discover candidate arrival stations at destination
  const destStationRecords = realStationProvider.findDestinationStations(destination);
  const destCoords = destination.coordinates ?? {
    latitude: destStationRecords[0]?.latitude ?? 22.5726,
    longitude: destStationRecords[0]?.longitude ?? 88.3639,
  };

  const destStations: CandidateStation[] = destStationRecords
    .filter((sg) => {
      if (!excludePref) return true;
      const codeUpper = sg.code.toUpperCase();
      const exUpper = excludePref.toUpperCase();
      return !codeUpper.includes(exUpper) && !exUpper.includes(codeUpper);
    })
    .map((sg) => {
      const distKm = haversineDistanceKm(destCoords, { latitude: sg.latitude, longitude: sg.longitude });
      const onwardMins = Math.round((distKm / 25) * 60 + 10);
      return {
        station: { code: sg.code, name: sg.name, city: sg.city },
        distanceKm: distKm,
        estimatedTransitMins: onwardMins,
        isDirectBoarding: distKm <= 10,
        convenienceScore: Math.max(10, Math.round(100 - distKm * 2.0)),
        isDestinationReachable: true,
        note: `${distKm} km from ${destination.name}`,
      };
    });

  // 3. Dynamically discover candidate trains via TrainDiscoveryProvider
  const discovered = await railRadarTrainDiscoveryProvider.discoverTrains(filteredOriginStations, destStations);

  if (discovered.length === 0) {
    return resolveAndRankJourney(origin, destination, userPreferences);
  }

  // Convert discovered trains into RankedJourneyOptions with hard constraint enforcement
  const candidateOptions: RankedJourneyOption[] = [];

  for (const dt of discovered) {
    const originMatch = filteredOriginStations.find((os) => os.station.code.toUpperCase() === dt.fromCode.toUpperCase());
    const destMatch = destStations.find((ds) => ds.station.code.toUpperCase() === dt.toCode.toUpperCase());

    if (!originMatch || !destMatch) continue;

    // Hard station exclusion check
    if (excludePref) {
      const exUpper = excludePref.toUpperCase();
      if (originMatch.station.code.toUpperCase().includes(exUpper) || destMatch.station.code.toUpperCase().includes(exUpper)) {
        continue;
      }
    }

    // Distance constraint check
    if (userPreferences?.maxStationDistanceKm && originMatch.distanceKm > userPreferences.maxStationDistanceKm) {
      continue;
    }

    // Time constraint check
    if (userPreferences?.timeConstraint) {
      const tc = userPreferences.timeConstraint;
      const targetMins = tc.hour * 60 + tc.minute;
      const arrMins = parseTimeMins(dt.arrivalTime);
      const depMins = parseTimeMins(dt.departureTime);

      if ((tc.kind === "before" || tc.kind === "by") && arrMins > targetMins) {
        continue; // Arrives after deadline -> EXCLUDE
      }
      if (tc.kind === "after" && depMins < targetMins) {
        continue; // Departs before requested time -> EXCLUDE
      }
    }

    const preferredCls = userPreferences?.preferredClass || "3A";
    const allowDowngrade = Boolean(userPreferences?.allowClassDowngrade);
    const travelClass = (allowDowngrade ? "3A" : preferredCls) as TravelClass;

    const transitMins = originMatch.estimatedTransitMins;
    const onwardMins = destMatch.estimatedTransitMins;
    const trainMins = dt.durationMins ?? 1200;
    const totalDoorToDoorMins = transitMins + trainMins + onwardMins;

    const isExplicitBoarding = Boolean(
      explicitPref && explicitPref.toUpperCase() === originMatch.station.code.toUpperCase()
    );
    const boardingPreferenceBonus = isExplicitBoarding ? 20 : 0;

    const baseConfirm = 65; // Suitability index baseline
    const confirmationScore = baseConfirm;
    const accessScore = Math.max(0, 100 - transitMins * 1.2);
    const onwardScore = Math.max(0, 100 - onwardMins * 1.2);
    const trainDurationScore = Math.max(10, 100 - (trainMins - 800) / 20);

    const composite =
      confirmationScore * 0.4 +
      accessScore * 0.25 +
      onwardScore * 0.15 +
      trainDurationScore * 0.2 +
      boardingPreferenceBonus;

    const reasons: string[] = [];
    reasons.push(
      `Board at ${originMatch.station.name} (${originMatch.distanceKm} km from ${origin.name}, ~${transitMins} mins access)`
    );
    reasons.push(`Tatkal suitability signal: ~${baseConfirm}/100 [Source: ${dt.source}]`);
    reasons.push(`Arrives at ${destMatch.station.name} (~${onwardMins} mins onward to ${destination.name})`);

    const trainObj: Train = {
      number: dt.number,
      name: dt.name,
      fromCode: dt.fromCode,
      toCode: dt.toCode,
      departure: dt.departureTime || "10:00",
      arrival: dt.arrivalTime || "20:00",
      arrivalDayOffset: 1,
      durationMins: trainMins,
      runsOn: dt.runsOn || ["Daily"],
      tatkalOpensAt: "10:00",
      competition: 50,
      classes: [
        { travelClass, tatkalQuota: 50, confirmProbability: 65, fare: 2000 }
      ]
    };

    const provenance: JourneyProvenance = {
      discoverySource: dt.source ?? "railradar",
      stationSource: origin.source ?? "google",
      enrichmentSource: "railradar",
      mode: "LIVE",
    };

    candidateOptions.push({
      optionId: `${dt.number}-${dt.fromCode}-${travelClass}`,
      train: trainObj,
      boardingStation: originMatch.station,
      arrivalStation: destMatch.station,
      totalDurationMins: totalDoorToDoorMins,
      trainDurationMins: trainMins,
      transitToStationMins: transitMins,
      onwardAccessMins: onwardMins,
      totalDoorToDoorMins,
      tatkalConfirmProbability: baseConfirm,
      fare: 2000,
      travelClass,
      score: Math.round(composite * 10) / 10,
      journeyScore: {
        confirmationScore,
        accessScore,
        onwardScore,
        trainDurationScore,
        boardingPreferenceBonus,
        totalEstimatedHours: Math.round((totalDoorToDoorMins / 60) * 10) / 10,
        composite: Math.round(composite * 10) / 10,
        reasons,
      },
      rank: 0,
      reason: reasons.join(" · "),
      isPrimary: false,
      isBackup: false,
      provenance,
    });
  }

  if (userPreferences?.priority === "fastest") {
    candidateOptions.sort(
      (a, b) =>
        (a.totalDoorToDoorMins ?? a.totalDurationMins) -
        (b.totalDoorToDoorMins ?? b.totalDurationMins)
    );
  } else if (userPreferences?.priority === "cheapest") {
    candidateOptions.sort((a, b) => a.fare - b.fare);
  } else if (userPreferences?.priority === "safest") {
    candidateOptions.sort(
      (a, b) => b.tatkalConfirmProbability - a.tatkalConfirmProbability || b.score - a.score
    );
  } else {
    candidateOptions.sort((a, b) => b.score - a.score);
  }

  candidateOptions.forEach((opt, idx) => { opt.rank = idx + 1; });

  const primary = candidateOptions[0] ?? null;
  const backup = candidateOptions.length > 1 ? candidateOptions[1] : null;

  if (primary) primary.isPrimary = true;
  if (backup) backup.isBackup = true;

  if (!primary) {
    const conflictReasons: string[] = [];
    if (excludePref) conflictReasons.push(`Excluded ${excludePref} station.`);
    if (userPreferences?.preferredClass && !userPreferences?.allowClassDowngrade) {
      conflictReasons.push(`Class constrained to ${userPreferences.preferredClass}.`);
    }
    if (userPreferences?.timeConstraint) {
      conflictReasons.push(`Time constraint: ${userPreferences.timeConstraint.raw || `${userPreferences.timeConstraint.kind} ${userPreferences.timeConstraint.hour}:${userPreferences.timeConstraint.minute}`}.`);
    }
    if (userPreferences?.maxStationDistanceKm) {
      conflictReasons.push(`Max station distance: ${userPreferences.maxStationDistanceKm} km.`);
    }

    const conflictExplanation = conflictReasons.length > 0
      ? `There are trains to ${destination.name}, but none satisfy all active hard constraints (${conflictReasons.join(" ")}).`
      : `No direct trains found between candidate stations near ${origin.name} (${origin.city}) and ${destination.name} (${destination.city}).`;

    return {
      origin,
      destination,
      candidateOriginStations: filteredOriginStations,
      candidateDestinationStations: destStations,
      rankedOptions: [],
      primary: null,
      backup: null,
      explanation: `I couldn't find a verified journey that satisfies all your requirements. ${conflictExplanation}`,
      hasNoValidJourney: true,
      conflictExplanation,
    };
  }

  const totalHours = (primary.totalDoorToDoorMins ?? primary.totalDurationMins) / 60;
  const notes: string[] = [];
  if (excludePref) {
    notes.push(`Excluded ${excludePref} station.`);
  }
  if (userPreferences?.priority === "fastest") {
    notes.push("Reranked by speed (fastest door-to-door option selected).");
  } else if (userPreferences?.priority === "cheapest") {
    notes.push("Reranked by fare (cheapest option selected).");
  }

  const notePrefix = notes.length > 0 ? `${notes.join(" ")} ` : "";
  const explanation = `${notePrefix}${primary.train.name} (${primary.train.number}) from ${primary.boardingStation.name} to ${primary.arrivalStation.name} is recommended as your primary option (door-to-door ~${totalHours.toFixed(1)}h, fare ₹${primary.fare}, Tatkal suitability / confirmation signal ~${primary.tatkalConfirmProbability}%).${
    backup ? ` Held ready as backup: ${backup.train.name} (${backup.train.number}) from ${backup.boardingStation.name} (${backup.tatkalConfirmProbability}% Tatkal suitability).` : ""
  }`;

  return {
    origin,
    destination,
    candidateOriginStations: filteredOriginStations,
    candidateDestinationStations: destStations,
    rankedOptions: candidateOptions,
    primary,
    backup,
    explanation,
  };
}
