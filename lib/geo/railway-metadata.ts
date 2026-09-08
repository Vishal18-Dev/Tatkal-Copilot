/**
 * Authoritative Indian Railway Station to Zone and Division metadata.
 */

export interface RailwayMetadata {
  zoneCode: string;
  zoneName: string;
  division?: string;
}

const STATION_RAILWAY_MAP: Record<string, RailwayMetadata> = {
  // Central Railway (CR)
  PUNE: { zoneCode: "CR", zoneName: "Central Railway", division: "Pune Division" },
  CCH: { zoneCode: "CR", zoneName: "Central Railway", division: "Pune Division" },
  KK: { zoneCode: "CR", zoneName: "Central Railway", division: "Pune Division" },
  CSMT: { zoneCode: "CR", zoneName: "Central Railway", division: "Mumbai Division" },
  DR: { zoneCode: "CR", zoneName: "Central Railway", division: "Mumbai Division" },
  LTT: { zoneCode: "CR", zoneName: "Central Railway", division: "Mumbai Division" },
  KYN: { zoneCode: "CR", zoneName: "Central Railway", division: "Mumbai Division" },
  TNA: { zoneCode: "CR", zoneName: "Central Railway", division: "Mumbai Division" },
  NGP: { zoneCode: "CR", zoneName: "Central Railway", division: "Nagpur Division" },

  // Western Railway (WR)
  BCT: { zoneCode: "WR", zoneName: "Western Railway", division: "Mumbai Division" },
  MMCT: { zoneCode: "WR", zoneName: "Western Railway", division: "Mumbai Division" },
  BDTS: { zoneCode: "WR", zoneName: "Western Railway", division: "Mumbai Division" },
  BVI: { zoneCode: "WR", zoneName: "Western Railway", division: "Mumbai Division" },
  BSR: { zoneCode: "WR", zoneName: "Western Railway", division: "Mumbai Division" },
  ST: { zoneCode: "WR", zoneName: "Western Railway", division: "Vadodara Division" },
  BRC: { zoneCode: "WR", zoneName: "Western Railway", division: "Vadodara Division" },
  ADI: { zoneCode: "WR", zoneName: "Western Railway", division: "Ahmedabad Division" },
  RTM: { zoneCode: "WR", zoneName: "Western Railway", division: "Ratlam Division" },

  // Northern Railway (NR)
  NDLS: { zoneCode: "NR", zoneName: "Northern Railway", division: "Delhi Division" },
  NZM: { zoneCode: "NR", zoneName: "Northern Railway", division: "Delhi Division" },
  DLI: { zoneCode: "NR", zoneName: "Northern Railway", division: "Delhi Division" },
  ANVT: { zoneCode: "NR", zoneName: "Northern Railway", division: "Delhi Division" },
  UMB: { zoneCode: "NR", zoneName: "Northern Railway", division: "Ambala Division" },
  LKO: { zoneCode: "NR", zoneName: "Northern Railway", division: "Lucknow Division" },

  // Eastern Railway (ER)
  HWH: { zoneCode: "ER", zoneName: "Eastern Railway", division: "Howrah Division" },
  SDAH: { zoneCode: "ER", zoneName: "Eastern Railway", division: "Sealdah Division" },
  KOAA: { zoneCode: "ER", zoneName: "Eastern Railway", division: "Sealdah Division" },
  SHM: { zoneCode: "SER", zoneName: "South Eastern Railway", division: "Kharagpur Division" },

  // South Western Railway (SWR)
  SBC: { zoneCode: "SWR", zoneName: "South Western Railway", division: "Bengaluru Division" },
  YPR: { zoneCode: "SWR", zoneName: "South Western Railway", division: "Bengaluru Division" },
  SMVB: { zoneCode: "SWR", zoneName: "South Western Railway", division: "Bengaluru Division" },
  MYS: { zoneCode: "SWR", zoneName: "South Western Railway", division: "Mysuru Division" },

  // Southern Railway (SR)
  MAS: { zoneCode: "SR", zoneName: "Southern Railway", division: "Chennai Division" },
  MS: { zoneCode: "SR", zoneName: "Southern Railway", division: "Chennai Division" },
  CBE: { zoneCode: "SR", zoneName: "Southern Railway", division: "Salem Division" },

  // West Central Railway (WCR)
  KOTA: { zoneCode: "WCR", zoneName: "West Central Railway", division: "Kota Division" },
  BPL: { zoneCode: "WCR", zoneName: "West Central Railway", division: "Bhopal Division" },
  JBP: { zoneCode: "WCR", zoneName: "West Central Railway", division: "Jabalpur Division" },
};

export function getRailwayMetadata(stationCode: string | undefined | null): RailwayMetadata {
  if (!stationCode) {
    return { zoneCode: "IR", zoneName: "Indian Railways" };
  }
  const clean = stationCode.trim().toUpperCase();
  return (
    STATION_RAILWAY_MAP[clean] || {
      zoneCode: "IR",
      zoneName: "Indian Railways",
    }
  );
}
