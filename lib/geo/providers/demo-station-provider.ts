import type { StationProvider, StationGeoRecord } from "./types";
import type { GeoCoordinates, ResolvedLocation } from "../types";
import { haversineDistanceKm } from "../location-resolver";

export const DEMO_STATION_GEOS: StationGeoRecord[] = [
  { code: "BCT", name: "Mumbai Central", city: "Mumbai", latitude: 18.9696, longitude: 72.8193, aliases: ["mumbai central", "bct"] },
  { code: "BDTS", name: "Bandra Terminus", city: "Mumbai", latitude: 19.062, longitude: 72.842, aliases: ["bandra terminus", "bdts"] },
  { code: "DR", name: "Dadar", city: "Mumbai", latitude: 19.0178, longitude: 72.8478, aliases: ["dadar", "dr"] },
  { code: "BVI", name: "Borivali", city: "Mumbai", latitude: 19.2307, longitude: 72.8567, aliases: ["borivali", "bvi"] },
  { code: "BSR", name: "Vasai Road", city: "Mumbai", latitude: 19.3813, longitude: 72.8311, aliases: ["vasai road", "bsr"] },
  { code: "PUNE", name: "Pune Junction", city: "Pune", latitude: 18.5284, longitude: 73.8743, aliases: ["pune junction", "pune", "poona"] },
  { code: "NDLS", name: "New Delhi", city: "Delhi", latitude: 28.643, longitude: 77.2195, aliases: ["new delhi", "ndls"] },
  { code: "NZM", name: "Hazrat Nizamuddin", city: "Delhi", latitude: 28.5889, longitude: 77.2534, aliases: ["hazrat nizamuddin", "nizamuddin", "nzm"] },
  { code: "DLI", name: "Old Delhi", city: "Delhi", latitude: 28.661, longitude: 77.228, aliases: ["old delhi", "dli"] },
  { code: "HWH", name: "Howrah Junction", city: "Kolkata", latitude: 22.583, longitude: 88.3426, aliases: ["howrah junction", "howrah", "hwh"] },
  { code: "SDAH", name: "Sealdah", city: "Kolkata", latitude: 22.5697, longitude: 88.3697, aliases: ["sealdah", "sdah"] },
  { code: "SBC", name: "KSR Bengaluru", city: "Bengaluru", latitude: 12.9784, longitude: 77.5694, aliases: ["ksr bengaluru", "bangalore city", "sbc"] },
  { code: "MAS", name: "MGR Chennai Central", city: "Chennai", latitude: 13.0827, longitude: 80.275, aliases: ["chennai central", "mas"] },
  { code: "KOTA", name: "Kota Junction", city: "Kota", latitude: 25.2138, longitude: 75.8648, aliases: ["kota junction", "kota"] },
  { code: "RTM", name: "Ratlam Junction", city: "Ratlam", latitude: 23.3315, longitude: 75.0367, aliases: ["ratlam junction", "ratlam"] },
];

export class DemoStationProvider implements StationProvider {
  getAllStations(): StationGeoRecord[] {
    return DEMO_STATION_GEOS;
  }

  findStationsWithinRadiusKm(center: GeoCoordinates, radiusKm: number): StationGeoRecord[] {
    return DEMO_STATION_GEOS.filter((s) => {
      const dist = haversineDistanceKm(center, { latitude: s.latitude, longitude: s.longitude });
      return dist <= radiusKm;
    });
  }

  findDestinationStations(destination: ResolvedLocation): StationGeoRecord[] {
    const targetCity = destination.city.toLowerCase();
    const cityMatches = DEMO_STATION_GEOS.filter((s) => s.city.toLowerCase() === targetCity);

    if (destination.kind === "city" && cityMatches.length > 0) {
      return cityMatches;
    }

    if (destination.matchedStationCode) {
      const matched = DEMO_STATION_GEOS.find((s) => s.code === destination.matchedStationCode);
      if (matched) return [matched];
    }

    if (cityMatches.length > 0) return cityMatches;

    // Fallback: match by station name or query
    const targetName = destination.name.toLowerCase();
    return DEMO_STATION_GEOS.filter((s) => s.name.toLowerCase().includes(targetName) || targetName.includes(s.name.toLowerCase()));
  }
}

export const demoStationProvider = new DemoStationProvider();
