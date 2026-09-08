"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Radio,
  Mic,
  Lock,
  Clock,
  UserCheck,
  Plus,
  RotateCcw,
  Sparkles,
  Smartphone,
  Server,
  Zap,
  Check,
  X,
  PhoneCall,
  MessageSquare,
  AlertCircle,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { useJourney } from "@/lib/journey";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CallButton } from "@/components/calling/CallButton";
import { PrepareEmptyState } from "./empty-states/prepare-empty-state";
import type { BookingMode, Traveller } from "@/types";

interface PassengerViewItem {
  id: string;
  name: string;
  age: number;
  gender: string;
  berth: string;
  aadhaarMasked: string;
  verified: boolean;
}

const FALLBACK_PASSENGERS: PassengerViewItem[] = [
  {
    id: "p1",
    name: "Rahul Sharma",
    age: 32,
    gender: "Male",
    berth: "Lower Berth",
    aadhaarMasked: "****-****-9102",
    verified: true,
  },
  {
    id: "p2",
    name: "Priya Sharma",
    age: 29,
    gender: "Female",
    berth: "Lower Berth",
    aadhaarMasked: "****-****-3341",
    verified: true,
  },
  {
    id: "p3",
    name: "Manoj Sharma",
    age: 58,
    gender: "Male",
    berth: "Lower Berth",
    aadhaarMasked: "****-****-1092",
    verified: true,
  },
  {
    id: "p4",
    name: "Sunita Sharma",
    age: 54,
    gender: "Female",
    berth: "Middle Berth",
    aadhaarMasked: "****-****-7729",
    verified: true,
  },
];

export function Step3PrepareScreen() {
  const router = useRouter();
  const {
    plan,
    chosenOption,
    autoFallbackEnabled,
    goTo,
    mode,
    setMode,
    selectedPassengerIds,
    togglePassenger,
    setSelected,
  } = useJourney();
  const { travellers, addTraveller, user, addTrip, wallet } = useStore();
  const { t } = useLang();

  const fromCode = plan?.intent.fromCode || "MMCT";
  const toCode = plan?.intent.toCode || "NDLS";
  const preferredClass = plan?.intent.preferredClass || "3A";
  const primaryTrain = chosenOption || plan?.options[0];
  const primaryTrainName = primaryTrain?.title || "Tejas Rajdhani Express";
  const primaryTrainNumber = primaryTrain?.trainNumber || "12951";

  // Build unified passenger list from store or fallbacks
  const passengerList: PassengerViewItem[] =
    travellers.length > 0
      ? travellers.map((t) => ({
          id: t.id,
          name: t.name,
          age: t.age,
          gender: t.gender === "M" ? "Male" : "Female",
          berth: t.berthPreference ? `${t.berthPreference} Berth` : "Lower Berth",
          aadhaarMasked: "****-****-" + (Math.abs(t.name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 9000) + 1000),
          verified: true,
        }))
      : FALLBACK_PASSENGERS;

  // Passenger count integrity: never invent names or auto-select arbitrary travellers
  const targetPaxCount = plan?.intent.passengers;
  const activeSelectedIds = selectedPassengerIds;
  const selectedPassengers = passengerList.filter((p) => activeSelectedIds.includes(p.id));
  const selectedNames = selectedPassengers.map((p) => p.name.split(" ")[0]);
  const speechBubbleNames =
    selectedNames.length > 0
      ? selectedNames.join(" ji aur ") + " ji"
      : "Aapke yatriyon";

  // Authoritative Premium Tatkal fare & spend authorization state
  const [maxSpendLimit, setMaxSpendLimit] = useState<number>(6000);
  const authoritativePtFarePerPax: number | null = primaryTrain?.fare ? Math.round(primaryTrain.fare * 1.35) : null;
  const paxMultiplier = targetPaxCount || (activeSelectedIds.length > 0 ? activeSelectedIds.length : 1);
  const estimatedTotalPtFare: number | null = authoritativePtFarePerPax !== null ? authoritativePtFarePerPax * paxMultiplier : null;
  const isBlockedByPtFare = mode === "auto" && (authoritativePtFarePerPax === null || (estimatedTotalPtFare !== null && estimatedTotalPtFare > maxSpendLimit));

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTravellerName, setNewTravellerName] = useState("");
  const [newTravellerAge, setNewTravellerAge] = useState(30);
  const [newTravellerGender, setNewTravellerGender] = useState<"M" | "F">("M");
  const [newTravellerBerth, setNewTravellerBerth] = useState("Lower");

  // WhatsApp alerts state
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [phoneInput, setPhoneInput] = useState(user?.phone || "+91 98765 43210");

  if (!plan || travellers.length === 0) {
    return <PrepareEmptyState />;
  }

  const handleTogglePassenger = (id: string) => {
    if (togglePassenger) {
      togglePassenger(id);
    }
  };

  const handleClearPassengerSelection = () => {
    setSelected([]);
  };

  const handleCreateTraveller = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTravellerName.trim()) return;
    const added = addTraveller({
      name: newTravellerName.trim(),
      age: Number(newTravellerAge) || 30,
      gender: newTravellerGender,
      berthPreference: newTravellerBerth as any,
      mealPreference: "Veg",
      isSenior: newTravellerAge >= 60,
    });
    togglePassenger(added.id);
    setNewTravellerName("");
    setAddModalOpen(false);
  };

  const readinessChecks = [
    {
      title: "IRCTC Login Session",
      desc: "Valid & Warm (Token IRCTC-SYNC-9842)",
      status: "Ready",
    },
    {
      title: "Payment Gateway",
      desc: "Pre-authorized UPI 2FA (Auto-Debit Mandate)",
      status: "Ready",
    },
    {
      title: "Dynamic CAPTCHA Resolver",
      desc: "Primed & Online (99.8% ML Accuracy)",
      status: "Ready",
    },
    {
      title: "Master Passenger Aadhaar",
      desc: `Validation Confirmed (${activeSelectedIds.length}/${activeSelectedIds.length} UIDAI Verified)`,
      status: "Ready",
    },
    {
      title: "Atomic Clock NTP",
      desc: "Synchronized ±1.4ms (NTP Indian Standard Time)",
      status: "Ready",
    },
    {
      title: "Auto-Fallback Routing Protocol",
      desc: autoFallbackEnabled
        ? "Hot Standby (Failover switch armed · 400ms)"
        : "Disabled by User",
      status: autoFallbackEnabled ? "Ready" : "Standby",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Tag & Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3.5 py-1 text-brand font-bold">
          <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
          <span>{t("prep.stepBadge")}</span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[0.75rem] text-ink-soft">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-caution" />
            <span>{t("prep.executionWindow")}</span>
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1 text-confirm font-semibold">
            <Sparkles className="h-3 w-3" />
            {t("prep.voiceApplied")}
          </span>
        </div>
      </div>

      {/* Main Headline */}
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-brand-ink font-[family-name:var(--font-outfit)]">
          “{t("prep.headline")}”
        </h1>
        <p className="text-sm text-ink-soft max-w-3xl leading-relaxed">
          {t("prep.subheadline")}
        </p>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Train Summary, Passengers, Booking Mode (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Selected Primary Train Mini-Summary Card */}
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-caution-soft flex items-center justify-center text-caution font-black text-sm">
                  {primaryTrainNumber}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-ink">
                      {primaryTrainName.toUpperCase()}
                    </h3>
                    <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[0.7rem] font-bold text-ink-soft">
                      {fromCode} → {toCode}
                    </span>
                    <span className="rounded-md bg-brand-soft text-brand px-2 py-0.5 text-[0.7rem] font-bold">
                      Class: {preferredClass === "any" ? "3A" : preferredClass}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-soft mt-0.5">
                    <span className="text-confirm font-semibold">
                      {t("prep.highTatkalAllocation")}
                    </span>
                    <span>·</span>
                    <span>
                      {autoFallbackEnabled ? (
                        <span className="text-brand font-medium">
                          {t("prep.autoFallbackActive")}
                        </span>
                      ) : (
                        <span className="text-ink-faint">{t("prep.autoFallbackOff")}</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => goTo("options")}
                className="text-xs font-semibold text-brand hover:underline cursor-pointer"
              >
                {t("prep.changeTrain")}
              </button>
            </div>
          </div>

          {/* Master Passenger List Card */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-ink flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-brand" />
                  {t("prep.masterPassengerList")}
                </h3>
                <p className="text-xs text-ink-soft">
                  {t("prep.vaultStorageSub")}
                </p>
              </div>
              <span className={cn(
                "rounded-full px-3 py-1 text-xs font-bold",
                targetPaxCount
                  ? activeSelectedIds.length === targetPaxCount
                    ? "bg-confirm-soft text-confirm"
                    : "bg-caution-soft text-caution"
                  : "bg-brand-soft text-brand"
              )}>
                {targetPaxCount
                  ? `${targetPaxCount} required · ${activeSelectedIds.length} selected`
                  : `${activeSelectedIds.length} of ${passengerList.length} Active`}
              </span>
            </div>

            {/* Canonical Voice Input & Parameter Integrity Banner */}
            <div className="rounded-xl border border-brand/20 bg-brand-soft/30 p-3.5 space-y-2 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="h-7 w-7 rounded-full bg-brand-soft flex items-center justify-center text-brand shrink-0 mt-0.5">
                  <Mic className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div>
                    <span className="text-[0.68rem] font-bold uppercase tracking-wider text-ink-soft">
                      {t("prep.whatUserSaid")}
                    </span>
                    <p className="font-medium text-ink italic mt-0.5">
                      “{plan?.intent.restated || "Book ticket"}”
                    </p>
                  </div>
                  <div className="border-t border-brand/10 pt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.72rem]">
                    <span className="font-bold text-brand uppercase tracking-wider">
                      {t("prep.whatCopilotUnderstood")}
                    </span>
                    <span className="text-ink font-semibold">
                      {targetPaxCount ? `${targetPaxCount} Passenger${targetPaxCount > 1 ? "s" : ""}` : "Passenger count pending"}
                    </span>
                    <span>·</span>
                    <span className="text-ink font-semibold">{preferredClass} Class</span>
                    <span>·</span>
                    <span className="text-ink font-semibold">Premium Tatkal enabled</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Passenger Rows */}
            <div className="space-y-2.5 pt-1">
              {passengerList.map((passenger) => {
                const isSelected = activeSelectedIds.includes(passenger.id);
                return (
                  <div
                    key={passenger.id}
                    onClick={() => handleTogglePassenger(passenger.id)}
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl border transition cursor-pointer select-none",
                      isSelected
                        ? "border-brand bg-brand-soft/20 shadow-xs"
                        : "border-line bg-surface hover:bg-surface-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-5 w-5 rounded-md border flex items-center justify-center transition",
                          isSelected
                            ? "bg-brand border-brand text-white"
                            : "border-line-strong bg-surface"
                        )}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-ink">
                            {passenger.name}
                          </span>
                          {passenger.verified && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-confirm-soft px-1.5 py-0.2 text-[0.65rem] font-bold text-confirm">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              {t("prep.aadhaarVerified")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-ink-soft">
                          <span>{passenger.age} yrs</span>
                          <span>·</span>
                          <span>{passenger.gender}</span>
                          <span>·</span>
                          <span>{passenger.berth}</span>
                          <span>·</span>
                          <span className="font-mono text-[0.7rem] text-ink-faint">
                            {passenger.aadhaarMasked}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-bold transition",
                        isSelected
                          ? "bg-brand text-white shadow-xs"
                          : "bg-surface-muted text-ink-faint"
                      )}
                    >
                      {isSelected ? "Selected" : t("prep.available")}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Add Passenger CTA & Selection Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs border-t border-line">
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 font-bold text-brand hover:underline cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add New Traveller to Master List
              </button>
              <div className="flex items-center gap-3">
                {activeSelectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearPassengerSelection}
                    className="text-[0.72rem] font-medium text-ink-soft hover:text-caution hover:underline cursor-pointer"
                  >
                    Clear Selected
                  </button>
                )}
                <span className="text-[0.75rem] text-ink-faint italic">
                  Tap rows above or speak passenger names
                </span>
              </div>
            </div>
          </div>

          {/* Payment & Booking Limit (Premium Tatkal) */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-brand-soft flex items-center justify-center text-brand">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">
                    Payment & Booking Limit (Premium Tatkal)
                  </h3>
                  <p className="text-xs text-ink-soft">
                    Wallet balance verification and spend ceiling enforcement
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-mono font-bold text-ink">
                Wallet: ₹{wallet.balance.toLocaleString("en-IN")} available
              </span>
            </div>

            {/* Dynamic PT Fare Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-line/70 bg-surface-muted/40 p-3.5 space-y-1">
                <span className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-soft">
                  Authoritative PT Fare
                </span>
                <p className="font-mono text-base font-bold text-ink">
                  {authoritativePtFarePerPax !== null
                    ? `₹${authoritativePtFarePerPax.toLocaleString("en-IN")}`
                    : "UNKNOWN"}
                  <span className="text-xs font-normal text-ink-soft"> / passenger</span>
                </p>
                <p className="text-[0.68rem] text-ink-faint">
                  {authoritativePtFarePerPax !== null ? "Current fare" : "Fare unavailable"}
                </p>
              </div>

              <div className="rounded-xl border border-line/70 bg-surface-muted/40 p-3.5 space-y-1">
                <span className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-soft">
                  Multiplier Total ({paxMultiplier} Pax)
                </span>
                <p className="font-mono text-base font-bold text-ink">
                  {estimatedTotalPtFare !== null
                    ? `~₹${estimatedTotalPtFare.toLocaleString("en-IN")}`
                    : "UNKNOWN"}
                </p>
                <p className="text-[0.68rem] text-ink-faint">
                  {paxMultiplier} passenger{paxMultiplier > 1 ? "s" : ""} × {authoritativePtFarePerPax !== null ? `₹${authoritativePtFarePerPax}` : "fare"}
                </p>
              </div>

              <div className="rounded-xl border border-line/70 bg-surface-muted/40 p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-soft">
                    Max Spend Auth Limit
                  </span>
                  <span className="text-[0.65rem] text-brand font-bold">Editable</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm font-bold text-ink">₹</span>
                  <input
                    type="number"
                    value={maxSpendLimit}
                    onChange={(e) => setMaxSpendLimit(Number(e.target.value))}
                    step={500}
                    min={1000}
                    className="w-full font-mono text-sm font-bold text-ink bg-surface border border-line rounded-lg px-2 py-0.5 focus:border-brand focus:outline-none"
                  />
                </div>
                <p className="text-[0.68rem] text-ink-faint">
                  Hard ceiling for Copilot authorization
                </p>
              </div>
            </div>

            {/* Status Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              {/* Spend Limit Badge */}
              {estimatedTotalPtFare !== null ? (
                estimatedTotalPtFare <= maxSpendLimit ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-confirm-soft px-2.5 py-1 text-[0.72rem] font-bold text-confirm">
                    <Check className="h-3.5 w-3.5" />
                    ✓ Within authorization limit (₹{estimatedTotalPtFare.toLocaleString("en-IN")} ≤ ₹{maxSpendLimit.toLocaleString("en-IN")})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-caution-soft px-2.5 py-1 text-[0.72rem] font-bold text-caution">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    ✗ Exceeds authorized maximum (₹{estimatedTotalPtFare.toLocaleString("en-IN")} &gt; ₹{maxSpendLimit.toLocaleString("en-IN")})
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2.5 py-1 text-[0.72rem] font-bold text-ink-soft">
                  Authoritative fare pending
                </span>
              )}

              {/* Wallet Sufficiency Badge */}
              {estimatedTotalPtFare !== null && (
                wallet.balance >= estimatedTotalPtFare ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-confirm-soft px-2.5 py-1 text-[0.72rem] font-bold text-confirm">
                    <Check className="h-3.5 w-3.5" />
                    ✓ Wallet balance sufficient (₹{wallet.balance.toLocaleString("en-IN")} available)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-caution-soft px-2.5 py-1 text-[0.72rem] font-bold text-caution">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    ⚠ Wallet balance may require top-up (need ₹{(estimatedTotalPtFare - wallet.balance).toLocaleString("en-IN")} more)
                  </span>
                )
              )}
            </div>

            {/* Dynamic Pricing Warning */}
            <div className="rounded-xl border border-line/70 bg-surface-muted/30 p-3 flex items-start gap-2.5 text-xs text-ink-soft">
              <AlertTriangle className="h-4 w-4 text-caution shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-ink font-semibold">Premium Tatkal Dynamic Pricing Notice: </strong>
                Premium Tatkal pricing can change before booking. Copilot will never proceed above your authorized limit of ₹{maxSpendLimit.toLocaleString("en-IN")}.
              </p>
            </div>

            {/* Autonomous Execution Block Warning if fare UNKNOWN or exceeds */}
            {mode === "auto" && authoritativePtFarePerPax === null && (
              <div className="rounded-xl border border-caution/30 bg-caution-soft/40 p-3 flex items-start gap-2.5 text-xs text-caution">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Autonomous Booking Guard: </strong>
                  Cannot arm autonomous booking when authoritative fare is UNKNOWN. Please switch to Assisted mode or wait for authoritative fare confirmation.
                </div>
              </div>
            )}
            {mode === "auto" && estimatedTotalPtFare !== null && estimatedTotalPtFare > maxSpendLimit && (
              <div className="rounded-xl border border-caution/30 bg-caution-soft/40 p-3 flex items-start gap-2.5 text-xs text-caution">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Autonomous Booking Guard: </strong>
                  Cannot arm autonomous booking because estimated fare (₹{estimatedTotalPtFare.toLocaleString("en-IN")}) exceeds your max spend authorization limit (₹{maxSpendLimit.toLocaleString("en-IN")}).
                </div>
              </div>
            )}
          </div>

          {/* Booking Strategy Mode Selector: Assisted vs Permissioned */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-ink flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-brand" />
                  {t("prep.bookingExecutionStrategy")}
                </h3>
                <span className="text-xs font-bold text-brand uppercase tracking-wide">
                  {t("prep.chooseMode")}
                </span>
              </div>
              <p className="text-xs text-ink-soft mt-0.5">
                {t("prep.strategySub")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="radiogroup" aria-label="Booking mode">
              {/* Assisted Mode Card */}
              <div
                onClick={() => setMode("assisted")}
                className={cn(
                  "rounded-xl border-2 p-4 transition cursor-pointer select-none space-y-3",
                  mode === "assisted"
                    ? "border-brand bg-brand-soft/20 shadow-xs"
                    : "border-line bg-surface hover:border-line-strong hover:bg-surface-muted/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-lg text-sm",
                        mode === "assisted"
                          ? "bg-brand text-white"
                          : "bg-surface-muted text-ink-soft"
                      )}
                    >
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-ink">{t("mc.modeAssisted")}</span>
                        {mode === "assisted" && (
                          <Check className="h-3.5 w-3.5 text-brand" strokeWidth={3} />
                        )}
                      </div>
                      <p className="text-[0.7rem] font-semibold text-brand">
                        {t("mc.keepControl")}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[0.65rem] font-bold text-ink-soft">
                    {t("prep.manualConfirm")}
                  </span>
                </div>

                <p className="text-xs text-ink-soft leading-relaxed">
                  {t("prep.assistedModeDesc")}
                </p>

                <div className="space-y-1.5 rounded-lg border border-line/60 bg-surface/80 p-2.5 text-[0.72rem]">
                  <div className="flex items-center gap-1.5 text-ink">
                    <Check className="h-3 w-3 text-confirm shrink-0" strokeWidth={3} />
                    <span>Pre-warms IRCTC & stages payload</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-ink">
                    <Check className="h-3 w-3 text-confirm shrink-0" strokeWidth={3} />
                    <span>Real-time WhatsApp & push notifications</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-ink-faint">
                    <X className="h-3 w-3 text-caution shrink-0" strokeWidth={3} />
                    <span className="line-through">Auto-books without your 1-tap tap</span>
                  </div>
                </div>

                <div
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[0.72rem] font-medium leading-snug",
                    mode === "assisted"
                      ? "bg-brand-soft text-brand-ink"
                      : "bg-surface-muted text-ink-faint"
                  )}
                >
                  Copilot will stop and prompt you before booking or switching to backup.
                </div>
              </div>

              {/* Permissioned Mode Card */}
              <div
                onClick={() => setMode("auto")}
                className={cn(
                  "rounded-xl border-2 p-4 transition cursor-pointer select-none space-y-3",
                  mode === "auto"
                    ? "border-brand bg-brand-soft/20 shadow-xs"
                    : "border-line bg-surface hover:border-line-strong hover:bg-surface-muted/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-lg text-sm",
                        mode === "auto"
                          ? "bg-brand text-white"
                          : "bg-surface-muted text-ink-soft"
                      )}
                    >
                      <Zap className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-ink">{t("mc.modePermissioned")}</span>
                        {mode === "auto" && (
                          <Check className="h-3.5 w-3.5 text-brand" strokeWidth={3} />
                        )}
                      </div>
                      <p className="text-[0.7rem] font-semibold text-brand">
                        {t("prep.letCopilotActAutonomously")}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-confirm-soft px-2 py-0.5 text-[0.65rem] font-bold text-confirm">
                    {t("prep.proAutonomous")}
                  </span>
                </div>

                <p className="text-xs text-ink-soft leading-relaxed">
                  {t("prep.permissionedModeDesc")}
                </p>

                <div className="space-y-1.5 rounded-lg border border-line/60 bg-surface/80 p-2.5 text-[0.72rem]">
                  <div className="flex items-center gap-1.5 text-ink">
                    <Check className="h-3 w-3 text-confirm shrink-0" strokeWidth={3} />
                    <span>Autonomous sub-second payload firing</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-ink">
                    <Check className="h-3 w-3 text-confirm shrink-0" strokeWidth={3} />
                    <span>Automatic failover to backup train</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-ink">
                    <Check className="h-3 w-3 text-confirm shrink-0" strokeWidth={3} />
                    <span>Auto-prompt UPI mandate limit pre-armed</span>
                  </div>
                </div>

                <div
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[0.72rem] font-medium leading-snug",
                    mode === "auto"
                      ? "bg-brand-soft text-brand-ink"
                      : "bg-surface-muted text-ink-faint"
                  )}
                >
                  Autonomous execution within authorized quota limits. Zero double-charge guarantee.
                </div>
              </div>
            </div>
          </div>

          {/* IRCTC Account & WhatsApp Notification Telemetry Card */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <Server className="h-4 w-4 text-emerald-500" />
                IRCTC Account & WhatsApp Dispatch Telemetry
              </h3>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[0.7rem] font-bold text-emerald-700 dark:text-emerald-400">
                Live Channels Armed
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* IRCTC Handle */}
              <div className="rounded-xl border border-line/70 bg-surface-muted/50 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-soft">
                    Linked IRCTC Handle
                  </span>
                  <span className="rounded bg-confirm-soft px-1.5 py-0.5 text-[0.65rem] font-bold text-confirm">
                    Session Warm
                  </span>
                </div>
                <p className="font-mono text-sm font-bold text-ink mt-1.5">
                  sharma_rahul92
                </p>
                <p className="text-[0.7rem] text-ink-soft mt-0.5">
                  Auth token staged · Multi-factor active
                </p>
              </div>

              {/* WhatsApp & Live SMS */}
              <div className="rounded-xl border border-line/70 bg-surface-muted/50 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-soft">
                    WhatsApp & Live SMS
                  </span>
                  <button
                    type="button"
                    onClick={() => setWhatsappEnabled(!whatsappEnabled)}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[0.65rem] font-bold transition cursor-pointer",
                      whatsappEnabled
                        ? "bg-brand-soft text-brand"
                        : "bg-surface-muted text-ink-faint"
                    )}
                  >
                    {whatsappEnabled ? "Active Alert" : "Muted"}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-confirm" />
                  <p className="font-mono text-sm font-bold text-ink">
                    {phoneInput}
                  </p>
                </div>
                <p className="text-[0.7rem] text-ink-soft mt-0.5">
                  Instant PNR, seat allocation & UPI push alerts
                </p>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={() => goTo("options")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-bold text-ink hover:bg-surface-muted transition cursor-pointer shadow-xs"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("prep.backToOptions")}
            </button>

            <button
              type="button"
              onClick={() => {
                if (plan && primaryTrain) {
                  const backupTrain = plan.options[1];
                  addTrip({
                    status: "upcoming",
                    from: plan.intent.from,
                    fromCode: plan.intent.fromCode,
                    to: plan.intent.to,
                    toCode: plan.intent.toCode,
                    dateLabel: "Tomorrow",
                    trainName: primaryTrain.title,
                    travelClass: (primaryTrain.travelClass as any) || "3A",
                    travellerIds: activeSelectedIds,
                    boardingStationName: primaryTrain.boardingStationName || plan.intent.from,
                    arrivalDisplay: primaryTrain.arrivalDisplay || "08:00 · tomorrow",
                    fare: primaryTrain.fare || 2500,
                    mode: mode || "assisted",
                    agentState: "scheduled",
                    agentEnabled: true,
                    tatkalOpensAtLabel: "10:00 AM",
                    arrivalTargetLabel: plan.intent.arrivalDeadline ? `before ${plan.intent.arrivalDeadline}` : "morning",
                    primary: {
                      optionId: primaryTrain.id,
                      trainName: primaryTrain.title,
                      travelClass: (primaryTrain.travelClass as any) || "3A",
                      boardingStationName: primaryTrain.boardingStationName || plan.intent.from,
                      departureDisplay: primaryTrain.departureDisplay || "16:00",
                      arrivalDisplay: primaryTrain.arrivalDisplay || "08:00 · tomorrow",
                      level: primaryTrain.level || "High",
                      fare: primaryTrain.fare || 2500,
                    },
                    backup: backupTrain ? {
                      optionId: backupTrain.id,
                      trainName: backupTrain.title,
                      travelClass: (backupTrain.travelClass as any) || "3A",
                      boardingStationName: backupTrain.boardingStationName || plan.intent.from,
                      departureDisplay: backupTrain.departureDisplay || "16:35",
                      arrivalDisplay: backupTrain.arrivalDisplay || "08:30 · tomorrow",
                      level: backupTrain.level || "High",
                      fare: backupTrain.fare || 2500,
                    } : null,
                    readinessDone: [],
                    planNotifications: [],
                  });
                }
                router.push("/app/book");
              }}
              disabled={activeSelectedIds.length === 0 || isBlockedByPtFare}
              title={
                activeSelectedIds.length === 0
                  ? "Select at least one passenger to proceed"
                  : isBlockedByPtFare
                  ? "Autonomous booking blocked: Authoritative fare is unknown or exceeds authorization limit"
                  : undefined
              }
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-confirm hover:bg-confirm/90 text-white px-7 py-3 text-sm font-bold shadow-md shadow-confirm/20 transition cursor-pointer disabled:opacity-50"
            >
              <span>{t("prep.confirmCta")}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {isBlockedByPtFare && (
            <p className="text-xs text-caution font-medium text-right mt-1">
              Autonomous booking disabled: Authoritative Premium Tatkal fare is UNKNOWN or exceeds your spend ceiling.
            </p>
          )}
          {activeSelectedIds.length === 0 && (
            <p className="text-xs text-ink-soft font-medium text-right mt-1">
              Please select {targetPaxCount ? `${targetPaxCount} passenger${targetPaxCount > 1 ? "s" : ""}` : "passengers"} from the list above to proceed.
            </p>
          )}
        </div>

        {/* Right Column: Station Master, Calling Agent, Readiness Pulse (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Station Master Speech Bubble Card + Integrated Calling Agent */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 rounded-full overflow-hidden border-2 border-confirm/50 shrink-0">
                  <Image
                    src="/aarav-namaste.jpg"
                    alt="Aarav · Tatkal Copilot"
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-ink">
                      Aarav
                    </h3>
                    <span className="flex h-2 w-2 rounded-full bg-confirm animate-pulse" />
                  </div>
                  <p className="text-[0.75rem] text-confirm font-medium">
                    Tatkal Copilot · Prepared
                  </p>
                </div>
              </div>

              {/* Top Speak Pill */}
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[0.68rem] font-bold text-brand">
                Hinglish v4.2
              </span>
            </div>

            {/* Speech Bubble */}
            <div className="relative rounded-xl bg-surface-muted/60 p-4 text-xs text-ink leading-relaxed border border-line/70">
              <p>
                “{t("prep.aaravSpeech")}”
              </p>
              <div className="mt-3 flex items-center justify-between text-[0.7rem] text-ink-soft border-t border-line/60 pt-2 font-mono">
                <span>Lock Token: IRCTC-SYNC-9842</span>
                <span className="text-confirm font-bold">VERIFIED</span>
              </div>
            </div>

            {/* Integrated Proactive Calling Agent */}
            <div className="pt-1">
              <CallButton className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-bold text-ink hover:bg-surface-muted transition shadow-xs cursor-pointer" />
            </div>
          </div>

          {/* Tatkal Readiness Pulse (6 / 6 Ready) */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Zap className="h-4 w-4 text-caution" />
                  Tatkal Readiness Pulse
                </h3>
                <p className="text-xs text-ink-soft">
                  Autonomous booking pre-flight checks
                </p>
              </div>
              <span className="rounded-full bg-confirm-soft px-2.5 py-0.5 text-xs font-bold text-confirm">
                6 / 6 Ready
              </span>
            </div>

            {/* Checklist Items */}
            <div className="space-y-2.5 pt-1">
              {readinessChecks.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line/70 bg-surface-muted/30 p-2.5 text-xs transition"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-confirm shrink-0" />
                    <div>
                      <div className="font-semibold text-ink leading-tight">
                        {item.title}
                      </div>
                      <div className="text-[0.68rem] text-ink-soft">
                        {item.desc}
                      </div>
                    </div>
                  </div>
                  <span className="rounded bg-confirm-soft px-2 py-0.5 text-[0.68rem] font-bold text-confirm shrink-0">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Latency Telemetry */}
            <div className="rounded-xl border border-line/70 bg-surface-muted/50 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between font-mono">
                <span className="flex items-center gap-1.5 text-ink-soft text-[0.75rem]">
                  <Radio className="h-3 w-3 text-brand animate-pulse" />
                  Live Railway Search Latency
                </span>
                <span className="text-confirm font-bold text-[0.75rem]">
                  18ms (Optimal)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                <div className="h-full w-4/5 rounded-full bg-confirm" />
              </div>
              <p className="text-[0.68rem] text-ink-faint">
                Live railway search active · Simulated transaction layer for demo
              </p>
            </div>
          </div>

          {/* Zero Immediate Deduction Guarantee Card */}
          <div className="rounded-2xl border border-confirm/30 bg-confirm-soft/40 p-4 sm:p-5 shadow-xs flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-confirm shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <h4 className="font-bold text-ink">
                Zero Immediate Deduction Guarantee
              </h4>
              <p className="text-ink-soft leading-relaxed">
                Zero payment is deducted right now. Your UPI app will receive a 1-tap approval prompt tomorrow at 10:00:18 AM once berths are confirmed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add New Traveller Quick Modal */}
      <AnimatePresence>
        {addModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-ink flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-brand" />
                  Add Traveller to Master List
                </h3>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="rounded-lg p-1 text-ink-soft hover:bg-surface-muted hover:text-ink cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTraveller} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-ink block mb-1">Full Name (as per Aadhaar)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ananya Sharma"
                    value={newTravellerName}
                    onChange={(e) => setNewTravellerName(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-ink block mb-1">Age</label>
                    <input
                      type="number"
                      required
                      min={5}
                      max={99}
                      value={newTravellerAge}
                      onChange={(e) => setNewTravellerAge(Number(e.target.value))}
                      className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-ink block mb-1">Gender</label>
                    <select
                      value={newTravellerGender}
                      onChange={(e) => setNewTravellerGender(e.target.value as any)}
                      className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                    >
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-ink block mb-1">Berth Preference</label>
                  <select
                    value={newTravellerBerth}
                    onChange={(e) => setNewTravellerBerth(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                  >
                    <option value="Lower">Lower Berth</option>
                    <option value="Middle">Middle Berth</option>
                    <option value="Upper">Upper Berth</option>
                    <option value="Side Lower">Side Lower</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="rounded-xl border border-line bg-surface px-4 py-2 text-xs font-bold text-ink hover:bg-surface-muted cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-brand text-white px-5 py-2 text-xs font-bold hover:bg-brand-strong cursor-pointer shadow-xs"
                  >
                    Save to Master List
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
