import type { Train, TravelClass } from "@/types";

export interface RailRadarFareBreakdown {
  baseFare: number;
  reservationCharge: number;
  superfastCharge: number;
  tatkalFare: number;
  goodsServiceTax: number;
  cateringCharge: number;
  dynamicFare: number;
  totalFare: number;
}

export interface RailRadarFareResponse {
  success: boolean;
  data?: {
    trainNumber: string;
    trainName: string;
    distance: number;
    breakdown: RailRadarFareBreakdown;
    generatedAt: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface RailRadarLiveStatusResponse {
  success: boolean;
  data?: {
    trainNumber: string;
    trainName: string;
    startDate: string;
    lastUpdatedAt: string;
    status: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface RailRadarPNRResponse {
  success: boolean;
  data?: {
    pnr: string;
    status: string;
    trainNumber?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export class RailRadarTrainProvider {
  private apiKey: string;
  private baseUrl = "https://railradar.in";

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
   * Fetch train details & full station route schedule from RailRadar API.
   * Endpoint: GET /api/v1/trains/{trainNumber}
   */
  async getTrain(trainNumber: string): Promise<{ success: boolean; train?: any; rawData?: any; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/trains/${trainNumber}`, {
        headers: this.headers,
      });

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}` };
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        return { success: false, error: json.error?.message || "Train not found" };
      }

      return { success: true, train: json.data.train ?? json.data, rawData: json.data };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Fetch route GeoJSON for a train.
   * Endpoint: GET /api/v1/trains/{trainNumber}/route
   */
  async getTrainRoute(trainNumber: string): Promise<{ success: boolean; geojson?: any; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/trains/${trainNumber}/route`, {
        headers: this.headers,
      });

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}` };
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        return { success: false, error: json.error?.message || "Route GeoJSON not found" };
      }

      return { success: true, geojson: json.data.geojson };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Fetch real-time PRS fare breakdown for a train.
   * Endpoint: GET /api/v1/trains/{trainNumber}/fare?from={from}&to={to}&date={date}&class={class}&quota={quota}
   */
  async getFare(params: {
    trainNumber: string;
    from: string;
    to: string;
    date: string;
    travelClass: string;
    quota?: string;
  }): Promise<{ success: boolean; fareBreakdown?: RailRadarFareBreakdown; totalFare?: number; error?: string }> {
    try {
      const quotaParam = params.quota ? `&quota=${params.quota}` : "";
      const url = `${this.baseUrl}/api/v1/trains/${params.trainNumber}/fare?from=${params.from}&to=${params.to}&date=${params.date}&class=${params.travelClass}${quotaParam}`;

      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}` };
      }

      const json: RailRadarFareResponse = await res.json();
      if (!json.success || !json.data) {
        return { success: false, error: json.error?.message || "Fare unavailable" };
      }

      return {
        success: true,
        fareBreakdown: json.data.breakdown,
        totalFare: json.data.breakdown.totalFare,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Fetch live running status for a train.
   * Endpoint: GET /api/v1/trains/{trainNumber}/live
   */
  async getLiveStatus(trainNumber: string): Promise<RailRadarLiveStatusResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/trains/${trainNumber}/live`, {
        headers: this.headers,
      });

      if (!res.ok) {
        return { success: false, error: { code: "HTTP_ERROR", message: `HTTP ${res.status}` } };
      }

      return await res.json();
    } catch (err) {
      return { success: false, error: { code: "FETCH_ERROR", message: (err as Error).message } };
    }
  }

  /**
   * Fetch PNR status for a booking.
   * Endpoint: GET /api/v1/pnr/{pnrNumber}
   */
  async getPNR(pnrNumber: string): Promise<RailRadarPNRResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/pnr/${pnrNumber}`, {
        headers: this.headers,
      });

      if (!res.ok) {
        return { success: false, error: { code: "HTTP_ERROR", message: `HTTP ${res.status}` } };
      }

      return await res.json();
    } catch (err) {
      return { success: false, error: { code: "FETCH_ERROR", message: (err as Error).message } };
    }
  }
}

export const railRadarTrainProvider = new RailRadarTrainProvider();
