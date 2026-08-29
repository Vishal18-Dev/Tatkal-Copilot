"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { savedPassengers } from "@/lib/data";
import type {
  User,
  Session,
  UserPreferences,
  Traveller,
  SavedJourney,
  Trip,
  TripStatus,
  ActivityEvent,
  AppNotification,
  StrategySnapshot,
} from "@/types";

/* ============================================================
   Persistent client store + mock phone/OTP auth.
   Everything is scoped to the current identity (a signed-in
   user, or the "guest" bucket before sign-in). Designed so a
   real backend can replace the persistence + auth internals
   without touching the UI.
   ============================================================ */

const AUTH_KEY = "tatkal.auth.v1";
const dataKey = (id: string) => `tatkal.data.${id}.v1`;

interface UserData {
  preferences: UserPreferences;
  travellers: Traveller[];
  savedJourneys: SavedJourney[];
  trips: Trip[];
  activity: ActivityEvent[];
  notifications: AppNotification[];
}

const defaultPreferences: UserPreferences = {
  confirmationPriority: "confirmation",
  boardingStationCodes: [],
  defaultMode: "assisted",
  notifications: {
    tatkalReminders: true,
    bookingUpdates: true,
    tripReminders: true,
  },
  onboarded: false,
};

function seedData(): UserData {
  return {
    preferences: { ...defaultPreferences },
    // Guest starts with the canonical sample travellers — editable/removable.
    travellers: savedPassengers.map((p) => ({ ...p })),
    savedJourneys: [],
    trips: [],
    activity: [],
    notifications: [],
  };
}

function loadData(id: string): UserData {
  if (typeof window === "undefined") return seedData();
  try {
    const raw = localStorage.getItem(dataKey(id));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserData>;
      return {
        preferences: { ...defaultPreferences, ...parsed.preferences },
        travellers: parsed.travellers ?? [],
        savedJourneys: parsed.savedJourneys ?? [],
        trips: (parsed.trips ?? []).map(normalizeTrip),
        activity: parsed.activity ?? [],
        notifications: parsed.notifications ?? [],
      };
    }
  } catch {
    /* corrupt — fall through to seed */
  }
  // Fresh guest gets seed travellers; a fresh authed user starts empty.
  return id === "guest" ? seedData() : { ...seedData(), travellers: [] };
}

/** Backfill agent/plan fields on trips saved by older versions. */
function normalizeTrip(t: Trip): Trip {
  return {
    ...t,
    agentState: t.agentState ?? (t.booking?.status === "success" ? "confirmed" : "scheduled"),
    agentEnabled: t.agentEnabled ?? true,
    tatkalOpensAtLabel: t.tatkalOpensAtLabel ?? "10:00 AM",
    primary:
      t.primary ?? {
        optionId: "",
        trainName: t.trainName,
        travelClass: t.travelClass,
        boardingStationName: t.boardingStationName,
        departureDisplay: "",
        arrivalDisplay: t.arrivalDisplay,
        level: "High",
        fare: t.fare,
      },
    backup: t.backup ?? null,
    readinessDone: t.readinessDone ?? [],
    planNotifications: t.planNotifications ?? [],
  };
}

function saveData(id: string, data: UserData) {
  try {
    localStorage.setItem(dataKey(id), JSON.stringify(data));
  } catch {
    /* storage unavailable */
  }
}

const genId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ---------------- OTP (mock, but with real guards) ---------------- */

interface OtpState {
  phone: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_WINDOW_MS = 60 * 1000;
const OTP_MAX_SENDS_PER_WINDOW = 3;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/* ---------------- Context ---------------- */

export interface OtpRequestResult {
  ok: boolean;
  error?: string;
  /** DEMO ONLY: the generated code, surfaced because there is no real SMS. */
  demoCode?: string;
}

interface StoreCtx {
  hydrated: boolean;
  user: User | null;
  isAuthed: boolean;

  // auth
  requestOtp: (phone: string) => OtpRequestResult;
  verifyOtp: (code: string) => { ok: boolean; error?: string; isNew?: boolean };
  logout: () => void;

  // data
  preferences: UserPreferences;
  travellers: Traveller[];
  savedJourneys: SavedJourney[];
  trips: Trip[];
  activity: ActivityEvent[];
  notifications: AppNotification[];
  unreadCount: number;

  updateProfile: (patch: Partial<Pick<User, "name" | "email">>) => void;
  updatePreferences: (patch: Partial<UserPreferences>) => void;

  addTraveller: (t: Omit<Traveller, "id">) => Traveller;
  updateTraveller: (id: string, patch: Omit<Traveller, "id">) => void;
  deleteTraveller: (id: string) => void;

  saveJourney: (j: Omit<SavedJourney, "id" | "createdAt">) => void;
  deleteJourney: (id: string) => void;

  addTrip: (t: Omit<Trip, "id" | "createdAt">) => Trip;
  updateTrip: (id: string, patch: Partial<Trip>) => void;
  getTrip: (id: string) => Trip | undefined;
  tripsByStatus: (status: TripStatus) => Trip[];
  seedDemoPlan: () => Trip;

  logActivity: (
    events: Omit<ActivityEvent, "id" | "at">[],
    tripId?: string
  ) => void;

  pushNotification: (n: Omit<AppNotification, "id" | "at" | "read">) => void;
  markAllNotificationsRead: () => void;

  resetGuestSession: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<UserData>(() => seedData());

  const identity = user?.id ?? "guest";
  const otpRef = useRef<OtpState | null>(null);
  const sendsRef = useRef<number[]>([]);

  // Hydrate auth + data on mount.
  useEffect(() => {
    let uid = "guest";
    try {
      const rawAuth = localStorage.getItem(AUTH_KEY);
      if (rawAuth) {
        const { user: u, session: s } = JSON.parse(rawAuth) as {
          user: User;
          session: Session;
        };
        if (u && s && new Date(s.expiresAt).getTime() > Date.now()) {
          setUser(u);
          setSession(s);
          uid = u.id;
        } else {
          localStorage.removeItem(AUTH_KEY);
        }
      }
    } catch {
      /* ignore */
    }
    setData(loadData(uid));
    setHydrated(true);
  }, []);

  // Persist data whenever it changes (post-hydration).
  useEffect(() => {
    if (!hydrated) return;
    saveData(identity, data);
  }, [data, identity, hydrated]);

  /* -------- auth -------- */

  const requestOtp = useCallback((phoneRaw: string): OtpRequestResult => {
    const phone = phoneRaw.replace(/\D/g, "");
    if (phone.length !== 10) {
      return { ok: false, error: "Enter a valid 10-digit mobile number." };
    }
    const now = Date.now();
    sendsRef.current = sendsRef.current.filter(
      (t) => now - t < OTP_RESEND_WINDOW_MS
    );
    if (sendsRef.current.length >= OTP_MAX_SENDS_PER_WINDOW) {
      return { ok: false, error: "Too many requests. Try again in a minute." };
    }
    sendsRef.current.push(now);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpRef.current = { phone, code, expiresAt: now + OTP_TTL_MS, attempts: 0 };
    return { ok: true, demoCode: code };
  }, []);

  const verifyOtp = useCallback(
    (codeRaw: string): { ok: boolean; error?: string; isNew?: boolean } => {
      const otp = otpRef.current;
      const code = codeRaw.replace(/\D/g, "");
      if (!otp) return { ok: false, error: "Request a code first." };
      if (Date.now() > otp.expiresAt)
        return { ok: false, error: "Code expired. Request a new one." };
      if (otp.attempts >= OTP_MAX_ATTEMPTS)
        return { ok: false, error: "Too many attempts. Request a new code." };
      otp.attempts += 1;
      if (code !== otp.code)
        return {
          ok: false,
          error: `Incorrect code. ${OTP_MAX_ATTEMPTS - otp.attempts} attempts left.`,
        };

      // Success — find or create the user for this phone.
      let existing: { user: User } | null = null;
      try {
        // Scan for a prior account with this phone (single-device prototype).
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k === AUTH_KEY) {
            const parsed = JSON.parse(localStorage.getItem(k)!) as {
              user: User;
            };
            if (parsed.user?.phone === otp.phone) existing = parsed;
          }
        }
      } catch {
        /* ignore */
      }

      const isNew = !existing;
      const u: User =
        existing?.user ??
        {
          id: genId("u"),
          phone: otp.phone,
          createdAt: new Date().toISOString(),
        };
      const s: Session = {
        token: genId("s"),
        userId: u.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      };
      try {
        localStorage.setItem(AUTH_KEY, JSON.stringify({ user: u, session: s }));
      } catch {
        /* ignore */
      }

      // Migrate guest data into the user's bucket (append-merge).
      const guest = loadData("guest");
      const target = loadData(u.id);
      const merged: UserData = {
        preferences: target.preferences.onboarded
          ? target.preferences
          : guest.preferences,
        travellers: mergeById(target.travellers, guest.travellers),
        savedJourneys: mergeById(target.savedJourneys, guest.savedJourneys),
        trips: mergeById(target.trips, guest.trips),
        activity: [...guest.activity, ...target.activity],
        notifications: [...guest.notifications, ...target.notifications],
      };
      saveData(u.id, merged);
      try {
        localStorage.removeItem(dataKey("guest"));
      } catch {
        /* ignore */
      }

      otpRef.current = null;
      setUser(u);
      setSession(s);
      setData(merged);
      return { ok: true, isNew };
    },
    []
  );

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
    setSession(null);
    setData(loadData("guest"));
  }, []);

  const resetGuestSession = useCallback(() => {
    try {
      localStorage.removeItem(dataKey("guest"));
    } catch {
      /* ignore */
    }
    if (!user) setData(seedData());
  }, [user]);

  /* -------- data mutators -------- */

  const patch = useCallback((fn: (d: UserData) => UserData) => {
    setData((d) => fn(d));
  }, []);

  const updateProfile = useCallback(
    (p: Partial<Pick<User, "name" | "email">>) => {
      setUser((u) => {
        if (!u) return u;
        const next = { ...u, ...p };
        try {
          const raw = localStorage.getItem(AUTH_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            localStorage.setItem(
              AUTH_KEY,
              JSON.stringify({ ...parsed, user: next })
            );
          }
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    []
  );

  const updatePreferences = useCallback(
    (p: Partial<UserPreferences>) =>
      patch((d) => ({ ...d, preferences: { ...d.preferences, ...p } })),
    [patch]
  );

  const addTraveller = useCallback(
    (t: Omit<Traveller, "id">) => {
      const traveller: Traveller = { ...t, id: genId("t") };
      patch((d) => ({ ...d, travellers: [...d.travellers, traveller] }));
      return traveller;
    },
    [patch]
  );

  const updateTraveller = useCallback(
    (id: string, p: Omit<Traveller, "id">) =>
      patch((d) => ({
        ...d,
        travellers: d.travellers.map((t) => (t.id === id ? { ...p, id } : t)),
      })),
    [patch]
  );

  const deleteTraveller = useCallback(
    (id: string) =>
      patch((d) => ({
        ...d,
        travellers: d.travellers.filter((t) => t.id !== id),
      })),
    [patch]
  );

  const saveJourney = useCallback(
    (j: Omit<SavedJourney, "id" | "createdAt">) =>
      patch((d) => {
        const dupe = d.savedJourneys.some(
          (x) => x.fromCode === j.fromCode && x.toCode === j.toCode
        );
        if (dupe) return d;
        return {
          ...d,
          savedJourneys: [
            { ...j, id: genId("j"), createdAt: new Date().toISOString() },
            ...d.savedJourneys,
          ],
        };
      }),
    [patch]
  );

  const deleteJourney = useCallback(
    (id: string) =>
      patch((d) => ({
        ...d,
        savedJourneys: d.savedJourneys.filter((x) => x.id !== id),
      })),
    [patch]
  );

  const addTrip = useCallback(
    (t: Omit<Trip, "id" | "createdAt">) => {
      const trip: Trip = {
        ...t,
        id: genId("trip"),
        createdAt: new Date().toISOString(),
      };
      patch((d) => ({ ...d, trips: [trip, ...d.trips] }));
      return trip;
    },
    [patch]
  );

  const updateTrip = useCallback(
    (id: string, p: Partial<Trip>) =>
      patch((d) => ({
        ...d,
        trips: d.trips.map((t) => (t.id === id ? { ...t, ...p } : t)),
      })),
    [patch]
  );

  const logActivity = useCallback(
    (events: Omit<ActivityEvent, "id" | "at">[], tripId?: string) =>
      patch((d) => ({
        ...d,
        activity: [
          ...events.map((e) => ({
            ...e,
            tripId: e.tripId ?? tripId,
            id: genId("a"),
            at: new Date().toISOString(),
          })),
          ...d.activity,
        ],
      })),
    [patch]
  );

  const pushNotification = useCallback(
    (n: Omit<AppNotification, "id" | "at" | "read">) =>
      patch((d) => ({
        ...d,
        notifications: [
          { ...n, id: genId("n"), at: new Date().toISOString(), read: false },
          ...d.notifications,
        ],
      })),
    [patch]
  );

  const markAllNotificationsRead = useCallback(
    () =>
      patch((d) => ({
        ...d,
        notifications: d.notifications.map((n) => ({ ...n, read: true })),
      })),
    [patch]
  );

  const getTrip = useCallback(
    (id: string) => data.trips.find((t) => t.id === id),
    [data.trips]
  );

  const tripsByStatus = useCallback(
    (status: TripStatus) => data.trips.filter((t) => t.status === status),
    [data.trips]
  );

  const seedDemoPlan = useCallback((): Trip => {
    const ids = data.travellers.slice(0, 2).map((t) => t.id);
    const primary: StrategySnapshot = {
      optionId: "12953-3A",
      trainName: "August Kranti Rajdhani",
      travelClass: "3A",
      boardingStationName: "Borivali",
      departureDisplay: "16:35",
      arrivalDisplay: "06:40 · tomorrow",
      level: "High",
      fare: 2360,
    };
    const backup: StrategySnapshot = {
      optionId: "split-KOTA",
      trainName: "Split via Kota Junction",
      travelClass: "3A",
      boardingStationName: "Mumbai Central",
      departureDisplay: "16:35",
      arrivalDisplay: "12:20 · tomorrow",
      level: "Very High",
      fare: 2540,
      via: "Kota Junction",
    };
    const trip: Trip = {
      id: genId("trip"),
      status: "upcoming",
      from: "Mumbai",
      fromCode: "BCT",
      to: "Delhi",
      toCode: "NDLS",
      dateLabel: "Tomorrow",
      trainName: primary.trainName,
      travelClass: "3A",
      travellerIds: ids,
      boardingStationName: primary.boardingStationName,
      arrivalDisplay: primary.arrivalDisplay,
      fare: primary.fare,
      mode: "assisted",
      agentState: "scheduled",
      agentEnabled: true,
      tatkalOpensAtLabel: "10:00 AM",
      arrivalTargetLabel: "before 08:00",
      primary,
      backup,
      readinessDone: [],
      planNotifications: [],
      createdAt: new Date().toISOString(),
    };
    patch((d) => ({
      ...d,
      trips: [trip, ...d.trips],
      activity: [
        { id: genId("a"), at: new Date().toISOString(), tripId: trip.id, kind: "strategy_change", text: "Strategy created · demo scenario loaded" },
        ...d.activity,
      ],
    }));
    return trip;
  }, [data.travellers, patch]);

  const unreadCount = useMemo(
    () => data.notifications.filter((n) => !n.read).length,
    [data.notifications]
  );

  const value = useMemo<StoreCtx>(
    () => ({
      hydrated,
      user,
      isAuthed: !!user,
      requestOtp,
      verifyOtp,
      logout,
      preferences: data.preferences,
      travellers: data.travellers,
      savedJourneys: data.savedJourneys,
      trips: data.trips,
      activity: data.activity,
      notifications: data.notifications,
      unreadCount,
      updateProfile,
      updatePreferences,
      addTraveller,
      updateTraveller,
      deleteTraveller,
      saveJourney,
      deleteJourney,
      addTrip,
      updateTrip,
      getTrip,
      tripsByStatus,
      seedDemoPlan,
      logActivity,
      pushNotification,
      markAllNotificationsRead,
      resetGuestSession,
    }),
    [
      hydrated,
      user,
      requestOtp,
      verifyOtp,
      logout,
      data,
      unreadCount,
      updateProfile,
      updatePreferences,
      addTraveller,
      updateTraveller,
      deleteTraveller,
      saveJourney,
      deleteJourney,
      addTrip,
      updateTrip,
      getTrip,
      tripsByStatus,
      seedDemoPlan,
      logActivity,
      pushNotification,
      markAllNotificationsRead,
      resetGuestSession,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function mergeById<T extends { id: string }>(base: T[], incoming: T[]): T[] {
  const ids = new Set(base.map((x) => x.id));
  return [...base, ...incoming.filter((x) => !ids.has(x.id))];
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
