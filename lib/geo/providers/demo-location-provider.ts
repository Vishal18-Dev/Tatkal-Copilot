import type { LocationProvider } from "./types";
import type { GeoCoordinates, LocationKind, ResolvedLocation } from "../types";
import { haversineDistanceKm } from "../location-resolver";
import { stations } from "@/lib/data";

interface GeoEntity {
  name: string;
  city: string;
  kind: LocationKind;
  lat: number;
  lng: number;
  aliases: string[];
  matchedStationCode?: string;
  locality?: string;
  state?: string;
}

export const DEMO_GEO_ENTITIES: GeoEntity[] = [
  // Localities & Landmarks in Mumbai
  {
    name: "Powai",
    city: "Mumbai",
    kind: "locality",
    locality: "Powai",
    state: "Maharashtra",
    lat: 19.1176,
    lng: 72.906,
    aliases: ["powai", "powai lake", "hiranandani powai"],
  },
  {
    name: "IIT Bombay",
    city: "Mumbai",
    kind: "landmark",
    locality: "Powai",
    state: "Maharashtra",
    lat: 19.1334,
    lng: 72.9133,
    aliases: ["iit bombay", "iitb", "iit mumbai", "near iit bombay", "iit powai"],
  },
  {
    name: "Andheri",
    city: "Mumbai",
    kind: "locality",
    locality: "Andheri",
    state: "Maharashtra",
    lat: 19.1197,
    lng: 72.8464,
    aliases: ["andheri", "andheri east", "andheri west", "midc andheri"],
  },
  {
    name: "Bandra",
    city: "Mumbai",
    kind: "locality",
    locality: "Bandra",
    state: "Maharashtra",
    lat: 19.0596,
    lng: 72.8295,
    aliases: ["bandra", "bandra west", "bandra east", "bkc", "bandra kurla complex"],
    matchedStationCode: "BDTS",
  },
  {
    name: "Borivali",
    city: "Mumbai",
    kind: "locality",
    locality: "Borivali",
    state: "Maharashtra",
    lat: 19.2307,
    lng: 72.8567,
    aliases: ["borivali", "borivali west", "borivali east", "national park"],
    matchedStationCode: "BVI",
  },
  {
    name: "Dadar",
    city: "Mumbai",
    kind: "locality",
    locality: "Dadar",
    state: "Maharashtra",
    lat: 19.0178,
    lng: 72.8478,
    aliases: ["dadar", "dadar west", "dadar east", "shivaji park"],
    matchedStationCode: "DR",
  },
  {
    name: "Ghatkopar",
    city: "Mumbai",
    kind: "locality",
    locality: "Ghatkopar",
    state: "Maharashtra",
    lat: 19.086,
    lng: 72.909,
    aliases: ["ghatkopar", "ghatkopar east", "ghatkopar west", "r city mall"],
  },
  {
    name: "Kurla",
    city: "Mumbai",
    kind: "locality",
    locality: "Kurla",
    state: "Maharashtra",
    lat: 19.0726,
    lng: 72.8845,
    aliases: ["kurla", "ltt", "lokmanya tilak terminus"],
  },
  {
    name: "Vasai",
    city: "Mumbai",
    kind: "locality",
    locality: "Vasai",
    state: "Maharashtra",
    lat: 19.3919,
    lng: 72.8397,
    aliases: ["vasai", "vasai road"],
    matchedStationCode: "BSR",
  },
  {
    name: "CSMT",
    city: "Mumbai",
    kind: "station",
    locality: "Fort",
    state: "Maharashtra",
    lat: 18.9401,
    lng: 72.8353,
    aliases: ["csmt", "cst", "victoria terminus", "vt", "mumbai cst"],
    matchedStationCode: "CSMT",
  },
  {
    name: "Mumbai Central",
    city: "Mumbai",
    kind: "station",
    locality: "Mumbai Central",
    state: "Maharashtra",
    lat: 18.9696,
    lng: 72.8193,
    aliases: ["mumbai central", "bct", "bombay central"],
    matchedStationCode: "BCT",
  },
  {
    name: "Mumbai",
    city: "Mumbai",
    kind: "city",
    state: "Maharashtra",
    lat: 18.969,
    lng: 72.8205,
    aliases: ["mumbai", "bombay"],
    matchedStationCode: "BCT",
  },

  // Pune Localities & City
  {
    name: "Life Republic",
    city: "Pune",
    kind: "locality",
    locality: "Life Republic",
    state: "Maharashtra",
    lat: 18.6148,
    lng: 73.7431,
    aliases: [
      "life republic",
      "life republic pune",
      "kolte patil life republic",
      "marunji",
      "marunji pune",
      "life republic in pune",
    ],
  },
  {
    name: "Hinjewadi",
    city: "Pune",
    kind: "locality",
    locality: "Hinjewadi",
    state: "Maharashtra",
    lat: 18.5913,
    lng: 73.7389,
    aliases: ["hinjewadi", "hinjawadi", "hinjewadi phase 1", "hinjewadi it park"],
  },
  {
    name: "Wakad",
    city: "Pune",
    kind: "locality",
    locality: "Wakad",
    state: "Maharashtra",
    lat: 18.5987,
    lng: 73.7687,
    aliases: ["wakad", "wakad pune"],
  },
  {
    name: "Shivajinagar",
    city: "Pune",
    kind: "locality",
    locality: "Shivajinagar",
    state: "Maharashtra",
    lat: 18.5314,
    lng: 73.8446,
    aliases: ["shivajinagar", "shivaji nagar"],
  },
  {
    name: "Pune",
    city: "Pune",
    kind: "city",
    state: "Maharashtra",
    lat: 18.5204,
    lng: 73.8567,
    aliases: ["pune", "poona"],
    matchedStationCode: "PUNE",
  },

  // Kolkata Localities & City
  {
    name: "Salt Lake",
    city: "Kolkata",
    kind: "locality",
    locality: "Salt Lake",
    state: "West Bengal",
    lat: 22.5867,
    lng: 88.4171,
    aliases: ["salt lake", "saltlake", "bidhan nagar", "salt lake city", "salt lake kolkata"],
  },
  {
    name: "Park Street",
    city: "Kolkata",
    kind: "locality",
    locality: "Park Street",
    state: "West Bengal",
    lat: 22.5551,
    lng: 88.3518,
    aliases: ["park street", "park street kolkata"],
  },
  {
    name: "Howrah",
    city: "Kolkata",
    kind: "station",
    locality: "Howrah",
    state: "West Bengal",
    lat: 22.583,
    lng: 88.3426,
    aliases: ["howrah", "howrah junction", "hwh"],
    matchedStationCode: "HWH",
  },
  {
    name: "Sealdah",
    city: "Kolkata",
    kind: "station",
    locality: "Sealdah",
    state: "West Bengal",
    lat: 22.5697,
    lng: 88.3697,
    aliases: ["sealdah", "sdah"],
    matchedStationCode: "SDAH",
  },
  {
    name: "Kolkata",
    city: "Kolkata",
    kind: "city",
    state: "West Bengal",
    lat: 22.5726,
    lng: 88.3639,
    aliases: ["kolkata", "calcutta"],
    matchedStationCode: "HWH",
  },

  // Bengaluru Localities & City
  {
    name: "Bengaluru",
    city: "Bengaluru",
    kind: "city",
    state: "Karnataka",
    lat: 12.9716,
    lng: 77.5946,
    aliases: ["bengaluru", "bangalore", "blr"],
    matchedStationCode: "SBC",
  },
  {
    name: "Whitefield",
    city: "Bengaluru",
    kind: "locality",
    locality: "Whitefield",
    state: "Karnataka",
    lat: 12.9698,
    lng: 77.75,
    aliases: ["whitefield", "itpl"],
  },
  {
    name: "Electronic City",
    city: "Bengaluru",
    kind: "locality",
    locality: "Electronic City",
    state: "Karnataka",
    lat: 12.8399,
    lng: 77.677,
    aliases: ["electronic city", "electronic city bengaluru", "ecity"],
  },

  // Delhi & NCR
  {
    name: "Delhi",
    city: "Delhi",
    kind: "city",
    state: "Delhi",
    lat: 28.6139,
    lng: 77.209,
    aliases: ["delhi", "new delhi", "ncr", "dilli"],
    matchedStationCode: "NDLS",
  },

  // Chennai
  {
    name: "Chennai",
    city: "Chennai",
    kind: "city",
    state: "Tamil Nadu",
    lat: 13.0827,
    lng: 80.2707,
    aliases: ["chennai", "madras"],
    matchedStationCode: "MAS",
  },

  // Kota
  {
    name: "Kota",
    city: "Kota",
    kind: "city",
    state: "Rajasthan",
    lat: 25.2138,
    lng: 75.8648,
    aliases: ["kota", "kota junction"],
    matchedStationCode: "KOTA",
  },
];

export class DemoLocationProvider implements LocationProvider {
  resolvePlace(query: string): ResolvedLocation | null {
    const clean = query
      .trim()
      .toLowerCase()
      .replace(/^(near|at|in|from|to)\s+/i, "");
    if (!clean) return null;

    // 1. Direct entity alias match (takes precedence over station code if query is city/locality name)
    for (const entity of DEMO_GEO_ENTITIES) {
      if (entity.name.toLowerCase() === clean || entity.aliases.includes(clean)) {
        return {
          rawQuery: query,
          name: entity.name,
          city: entity.city,
          kind: entity.kind,
          matchedStationCode: entity.matchedStationCode,
          coordinates: { latitude: entity.lat, longitude: entity.lng },
          locality: entity.locality,
          state: entity.state,
          source: "demo",
          confidence: 0.95,
        };
      }
    }

    // 2. Direct station code match
    const stationMatch = stations.find((s) => s.code.toLowerCase() === clean);
    if (stationMatch) {
      const geo = DEMO_GEO_ENTITIES.find(
        (g) => g.matchedStationCode === stationMatch.code || g.name.toLowerCase() === stationMatch.name.toLowerCase()
      );
      return {
        rawQuery: query,
        name: stationMatch.name,
        city: stationMatch.city,
        kind: "station",
        matchedStationCode: stationMatch.code,
        coordinates: geo ? { latitude: geo.lat, longitude: geo.lng } : undefined,
        locality: geo?.locality,
        state: geo?.state,
        source: "demo",
        confidence: 1.0,
      };
    }

    // 3. Substring match in DEMO_GEO_ENTITIES
    for (const entity of DEMO_GEO_ENTITIES) {
      for (const alias of entity.aliases) {
        if (clean.includes(alias) || alias.includes(clean)) {
          return {
            rawQuery: query,
            name: entity.name,
            city: entity.city,
            kind: entity.kind,
            matchedStationCode: entity.matchedStationCode,
            coordinates: { latitude: entity.lat, longitude: entity.lng },
            locality: entity.locality,
            state: entity.state,
            source: "demo",
            confidence: 0.85,
          };
        }
      }
    }

    // 4. Station name match in stations dataset
    const sNameMatch = stations.find(
      (s) => s.name.toLowerCase().includes(clean) || clean.includes(s.name.toLowerCase())
    );
    if (sNameMatch) {
      return {
        rawQuery: query,
        name: sNameMatch.name,
        city: sNameMatch.city,
        kind: "station",
        matchedStationCode: sNameMatch.code,
        source: "demo",
        confidence: 0.8,
      };
    }

    return null;
  }

  resolveCoordinates(lat: number, lng: number): ResolvedLocation {
    const coords: GeoCoordinates = { latitude: lat, longitude: lng };
    let closest: GeoEntity | null = null;
    let minDistance = Infinity;

    for (const entity of DEMO_GEO_ENTITIES) {
      const dist = haversineDistanceKm(coords, { latitude: entity.lat, longitude: entity.lng });
      if (dist < minDistance) {
        minDistance = dist;
        closest = entity;
      }
    }

    if (closest && minDistance <= 35) {
      return {
        rawQuery: `GPS Location (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
        name: closest.name,
        city: closest.city,
        kind: "coordinates",
        coordinates: coords,
        matchedStationCode: closest.matchedStationCode,
        locality: closest.locality,
        state: closest.state,
        source: "gps",
        confidence: Math.max(0.6, 1.0 - minDistance / 50),
      };
    }

    return {
      rawQuery: "GPS Location",
      name: "Unknown Location",
      city: "Unknown",
      kind: "coordinates",
      coordinates: coords,
      source: "gps",
      confidence: 0.3,
    };
  }
}

export const demoLocationProvider = new DemoLocationProvider();
