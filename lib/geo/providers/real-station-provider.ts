import type { StationProvider, StationGeoRecord } from "./types";
import type { GeoCoordinates, ResolvedLocation } from "../types";
import { haversineDistanceKm } from "../location-resolver";

export const REAL_STATION_GEOS: StationGeoRecord[] = [
  // Mumbai Region
  { code: "BCT", name: "Mumbai Central", city: "Mumbai", latitude: 18.9696, longitude: 72.8193, aliases: ["mumbai central", "bct", "mmct"] },
  { code: "BDTS", name: "Bandra Terminus", city: "Mumbai", latitude: 19.062, longitude: 72.842, aliases: ["bandra terminus", "bdts"] },
  { code: "DR", name: "Dadar Central", city: "Mumbai", latitude: 19.0178, longitude: 72.8478, aliases: ["dadar", "dr"] },
  { code: "BVI", name: "Borivali", city: "Mumbai", latitude: 19.2307, longitude: 72.8567, aliases: ["borivali", "bvi"] },
  { code: "BSR", name: "Vasai Road", city: "Mumbai", latitude: 19.3813, longitude: 72.8311, aliases: ["vasai road", "bsr"] },
  { code: "CSMT", name: "Chhatrapati Shivaji Maharaj Terminus", city: "Mumbai", latitude: 18.9401, longitude: 72.8353, aliases: ["csmt", "cst", "victoria terminus"] },
  { code: "LTT", name: "Lokmanya Tilak Terminus", city: "Mumbai", latitude: 19.0689, longitude: 72.8906, aliases: ["ltt", "kurla terminus"] },

  // Pune Region
  { code: "PUNE", name: "Pune Junction", city: "Pune", latitude: 18.5284, longitude: 73.8743, aliases: ["pune junction", "pune", "poona"] },
  { code: "CCH", name: "Chinchwad", city: "Pune", latitude: 18.6346, longitude: 73.7997, aliases: ["chinchwad", "cch"] },
  { code: "KK", name: "Khadki", city: "Pune", latitude: 18.5638, longitude: 73.8372, aliases: ["khadki", "kk"] },

  // Delhi / NCR Region
  { code: "NDLS", name: "New Delhi", city: "Delhi", latitude: 28.643, longitude: 77.2195, aliases: ["new delhi", "ndls"] },
  { code: "NZM", name: "Hazrat Nizamuddin", city: "Delhi", latitude: 28.5889, longitude: 77.2534, aliases: ["hazrat nizamuddin", "nizamuddin", "nzm"] },
  { code: "DLI", name: "Old Delhi", city: "Delhi", latitude: 28.661, longitude: 77.228, aliases: ["old delhi", "dli"] },
  { code: "ANVT", name: "Anand Vihar Terminal", city: "Delhi", latitude: 28.6508, longitude: 77.3152, aliases: ["anand vihar", "anvt"] },

  // Kolkata Region
  { code: "HWH", name: "Howrah Junction", city: "Kolkata", latitude: 22.583, longitude: 88.3426, aliases: ["howrah junction", "howrah", "hwh"] },
  { code: "SDAH", name: "Sealdah", city: "Kolkata", latitude: 22.5697, longitude: 88.3697, aliases: ["sealdah", "sdah"] },
  { code: "KOAA", name: "Kolkata Chitpur Terminal", city: "Kolkata", latitude: 22.602, longitude: 88.3745, aliases: ["kolkata terminal", "koaa"] },
  { code: "SHM", name: "Shalimar", city: "Kolkata", latitude: 22.5539, longitude: 88.3128, aliases: ["shalimar", "shm"] },

  // Bengaluru Region
  { code: "SBC", name: "KSR Bengaluru City", city: "Bengaluru", latitude: 12.9784, longitude: 77.5694, aliases: ["ksr bengaluru", "bangalore city", "sbc"] },
  { code: "YPR", name: "Yesvantpur Junction", city: "Bengaluru", latitude: 13.0238, longitude: 77.551, aliases: ["yesvantpur", "ypr"] },
  { code: "SMVB", name: "Sir M. Visvesvaraya Terminal", city: "Bengaluru", latitude: 13.0035, longitude: 77.6534, aliases: ["smvb", "baiyyappanahalli"] },

  // Chennai Region
  { code: "MAS", name: "MGR Chennai Central", city: "Chennai", latitude: 13.0827, longitude: 80.275, aliases: ["chennai central", "mas"] },
  { code: "MS", name: "Chennai Egmore", city: "Chennai", latitude: 13.0802, longitude: 80.2612, aliases: ["chennai egmore", "ms"] },

  // Rajasthan & MP
  { code: "KOTA", name: "Kota Junction", city: "Kota", latitude: 25.2138, longitude: 75.8648, aliases: ["kota junction", "kota"] },
  { code: "RTM", name: "Ratlam Junction", city: "Ratlam", latitude: 23.3315, longitude: 75.0367, aliases: ["ratlam junction", "ratlam"] },
];

export class RealStationProvider implements StationProvider {
  getAllStations(): StationGeoRecord[] {
    return REAL_STATION_GEOS;
  }

  findStationsWithinRadiusKm(center: GeoCoordinates, radiusKm: number): StationGeoRecord[] {
    return REAL_STATION_GEOS.filter((s) => {
      const dist = haversineDistanceKm(center, { latitude: s.latitude, longitude: s.longitude });
      return dist <= radiusKm;
    });
  }

  findDestinationStations(destination: ResolvedLocation): StationGeoRecord[] {
    const targetCity = destination.city.toLowerCase();
    const cityMatches = REAL_STATION_GEOS.filter((s) => s.city.toLowerCase() === targetCity);

    if (destination.kind === "city" && cityMatches.length > 0) {
      return cityMatches;
    }

    if (destination.matchedStationCode) {
      const matched = REAL_STATION_GEOS.find((s) => s.code === destination.matchedStationCode);
      if (matched) return [matched];
    }

    if (cityMatches.length > 0) return cityMatches;

    const targetName = destination.name.toLowerCase();
    return REAL_STATION_GEOS.filter((s) => s.name.toLowerCase().includes(targetName) || targetName.includes(s.name.toLowerCase()));
  }
}

export const realStationProvider = new RealStationProvider();
