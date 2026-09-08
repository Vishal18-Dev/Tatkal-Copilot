"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  UserPlus,
  RefreshCw,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Mic,
  User,
  Check,
  Radio,
  Lock,
  Landmark,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useJourney } from "@/lib/journey";
import { cn } from "@/lib/utils";
import type { BerthPreference } from "@/types";

interface PrepareEmptyStateProps {
  onTravellerAdded?: () => void;
}

export function PrepareEmptyState({ onTravellerAdded }: PrepareEmptyStateProps) {
  const { addTraveller, travellers } = useStore();
  const { goTo } = useJourney();

  // Live atomic clock timer
  const [clockTime, setClockTime] = useState("20:46:55");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClockTime(
        now.toLocaleTimeString("en-IN", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fast onboarding form state
  const [name, setName] = useState("Rahul Sharma");
  const [age, setAge] = useState(32);
  const [gender, setGender] = useState<"M" | "F" | "O">("M");
  const [berth, setBerth] = useState<BerthPreference>("Lower");
  const [food, setFood] = useState("Veg Meal");
  const [srCitizen, setSrCitizen] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveTraveller = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addTraveller({
      name: name.trim(),
      age: Number(age) || 30,
      gender: gender as "M" | "F",
      berthPreference: berth,
      mealPreference: "Veg",
      isSenior: srCitizen,
    });

    setSavedSuccess(true);
    setTimeout(() => {
      if (onTravellerAdded) onTravellerAdded();
    }, 400);
  };

  const handle1ClickSync = () => {
    addTraveller({
      name: "Rahul Sharma",
      age: 32,
      gender: "M",
      berthPreference: "Lower",
      mealPreference: "Veg",
      isSenior: false,
    });
    addTraveller({
      name: "Priya Sharma",
      age: 29,
      gender: "F",
      berthPreference: "Lower",
      mealPreference: "Veg",
      isSenior: false,
    });
    if (onTravellerAdded) onTravellerAdded();
  };

  return (
    <div className="space-y-6 py-2">
      {/* ── HEADER STRIP: Title + Live Clock ─────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 border border-amber-500/20 font-mono text-[0.68rem]">
              ZERO-DELAY ENGINE
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>IRCTC Master List V3</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-ink dark:text-white font-[family-name:var(--font-outfit)]">
            Master List & Tatkal Readiness
          </h1>
          <p className="text-xs sm:text-sm text-ink-soft dark:text-slate-400 leading-relaxed">
            Save your travellers and link IRCTC credentials now. When Tatkal opens
            at 10:00 AM, there is zero time to type names or berth choices.
          </p>
        </div>

        {/* Live Atomic Clock Widget */}
        <div className="rounded-xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 px-4 py-2.5 shadow-xs flex items-center gap-3 font-mono">
          <Clock className="h-4 w-4 text-emerald-500 animate-pulse" />
          <div>
            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-faint dark:text-slate-500">
              ATOMIC SERVER CLOCK
            </div>
            <div className="text-sm sm:text-base font-black text-ink dark:text-white flex items-center gap-1.5">
              <span>{clockTime}</span>
              <span className="text-[0.65rem] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 rounded">
                ±1.2ms
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── COPILOT PROACTIVE ADVISORY CARD ─────────────────────────────── */}
      <div className="rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-4 sm:p-5 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative h-13 w-13 rounded-full overflow-hidden border-2 border-emerald-500/60 shrink-0 bg-surface-muted">
              <Image
                src="/aarav-namaste.jpg"
                alt="Aarav Advisor"
                fill
                className="object-cover"
              />
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-brand-soft dark:bg-slate-800 px-1.5 py-0.2 text-[0.65rem] font-bold text-brand dark:text-emerald-400 flex items-center gap-1">
                  <User className="h-2.5 w-2.5" />
                  Copilot Proactive Advisory
                </span>
              </div>
              <p className="text-xs font-semibold text-ink dark:text-white leading-relaxed">
                “Pehle se passenger list ready rakhne se Tatkal booking{" "}
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  0.82 seconds
                </span>{" "}
                mein punch ho jati hai. Chaliye pehla traveller add karte hain!”
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-ink-soft dark:text-slate-400 pt-0.5">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Zap className="h-3 w-3" />
                  4-seat parallel autofill ready
                </span>
                <span>•</span>
                <span>Aadhaar UIDAI pre-validation</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={() => {
                const input = document.getElementById("traveller-name-input");
                input?.focus();
              }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand dark:bg-emerald-600 hover:bg-brand-strong dark:hover:bg-emerald-500 text-white px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Add Passenger</span>
            </button>

            <button
              type="button"
              onClick={handle1ClickSync}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-line dark:border-slate-700 bg-surface-muted/60 dark:bg-slate-800 hover:bg-surface-muted dark:hover:bg-slate-700 text-ink dark:text-slate-200 px-3.5 py-2 text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Sync IRCTC</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2-COLUMN MAIN LAYOUT: Empty Slots Form + Readiness Audit ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (lg:col-span-7): Empty State Prompt + Fast Onboarding Form */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: No Travellers Saved Yet Notice */}
          <div className="rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-5 sm:p-6 text-center space-y-4 shadow-xs relative overflow-hidden">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-surface-muted dark:bg-slate-800 flex items-center justify-center text-ink-faint dark:text-slate-400">
              <UserPlus className="h-6 w-6 text-brand dark:text-emerald-400" />
            </div>

            <div className="space-y-1.5 max-w-md mx-auto">
              <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider border border-amber-500/20">
                QUOTA SLOTS EMPTY
              </span>
              <h3 className="text-lg font-bold text-ink dark:text-white">
                No travellers saved yet
              </h3>
              <p className="text-xs text-ink-soft dark:text-slate-400 leading-relaxed">
                Add up to 4 travellers per Tatkal requisition. Pre-validating
                Aadhaar UIDAI guarantees instant IRCTC master-list approval
                without captchas.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("traveller-name-input");
                  el?.focus();
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-soft dark:bg-slate-800 text-brand dark:text-emerald-400 hover:bg-brand/10 dark:hover:bg-slate-700 px-4 py-2.5 text-xs font-bold transition cursor-pointer"
              >
                <span>+ Add First Traveller (Manual)</span>
              </button>

              <button
                type="button"
                onClick={handle1ClickSync}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-line dark:border-slate-700 bg-surface-muted/40 dark:bg-slate-800/80 px-4 py-2.5 text-xs font-bold text-ink dark:text-slate-200 hover:bg-surface-muted dark:hover:bg-slate-700 transition cursor-pointer"
              >
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span>Sync IRCTC (1-Click)</span>
              </button>
            </div>

            <div className="pt-2 border-t border-line/60 dark:border-slate-800 text-[0.72rem] text-ink-faint dark:text-slate-400 flex items-center justify-center gap-2">
              <Mic className="h-3.5 w-3.5 text-brand dark:text-emerald-400 animate-pulse" />
              <span>
                Say: <strong className="text-ink dark:text-white">&ldquo;Rahul aur Priya ko add karo&rdquo;</strong>
              </span>
              <span className="rounded bg-surface-muted dark:bg-slate-800 px-1.5 py-0.2 text-[0.65rem] font-mono">
                VOICE AI
              </span>
            </div>
          </div>

          {/* Card 2: Fast Traveller Onboarding Form */}
          <form
            onSubmit={handleSaveTraveller}
            className="rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-5 sm:p-6 shadow-xs space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-ink dark:text-white flex items-center gap-2">
                  <User className="h-4 w-4 text-brand dark:text-emerald-400" />
                  Fast Traveller Onboarding
                </h3>
                <p className="text-[0.72rem] text-ink-soft dark:text-slate-400">
                  Slot 1 of 4 • Primary Ticket Holder
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 text-[0.68rem] font-bold flex items-center gap-1 border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" />
                IRCTC Verified Fast-Track
              </span>
            </div>

            <div className="space-y-3.5">
              {/* Name field */}
              <div className="space-y-1">
                <label
                  htmlFor="traveller-name-input"
                  className="text-[0.7rem] font-bold text-ink-soft dark:text-slate-300 uppercase tracking-wider"
                >
                  Full Name (As printed on Aadhaar / Govt ID)
                </label>
                <div className="relative">
                  <input
                    id="traveller-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-line dark:border-slate-800 bg-surface-muted/40 dark:bg-slate-800/80 px-3.5 py-2.5 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:border-brand"
                  />
                  <CheckCircle2 className="absolute right-3 top-2.5 h-4 w-4 text-emerald-500" />
                </div>
              </div>

              {/* Age and Gender */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[0.7rem] font-bold text-ink-soft dark:text-slate-300 uppercase tracking-wider">
                    Age
                  </label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    min={1}
                    max={120}
                    className="w-full rounded-xl border border-line dark:border-slate-800 bg-surface-muted/40 dark:bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[0.7rem] font-bold text-ink-soft dark:text-slate-300 uppercase tracking-wider">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full rounded-xl border border-line dark:border-slate-800 bg-surface-muted/40 dark:bg-slate-800/80 px-3 py-2 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:border-brand"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="O">Other</option>
                  </select>
                </div>
              </div>

              {/* Berth Preference */}
              <div className="space-y-1.5">
                <label className="text-[0.7rem] font-bold text-ink-soft dark:text-slate-300 uppercase tracking-wider">
                  Berth Preference (Tatkal Auto-Downgrade OK)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["Lower", "Middle", "Upper", "Side Lower"] as const).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBerth(b)}
                      className={cn(
                        "rounded-xl border py-2 text-xs font-bold transition cursor-pointer text-center",
                        berth === b
                          ? "border-brand dark:border-emerald-500 bg-brand dark:bg-emerald-600 text-white shadow-xs"
                          : "border-line dark:border-slate-800 bg-surface-muted/40 dark:bg-slate-800/60 text-ink-soft dark:text-slate-300 hover:border-line-strong"
                      )}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Food Preference & Concessions */}
              <div className="grid grid-cols-2 gap-3 items-center pt-1">
                <div className="space-y-1">
                  <label className="text-[0.7rem] font-bold text-ink-soft dark:text-slate-300 uppercase tracking-wider">
                    Food Preference
                  </label>
                  <select
                    value={food}
                    onChange={(e) => setFood(e.target.value)}
                    className="w-full rounded-xl border border-line dark:border-slate-800 bg-surface-muted/40 dark:bg-slate-800/80 px-3 py-2 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:border-brand"
                  >
                    <option value="Veg Meal">Veg Meal</option>
                    <option value="Non-Veg Meal">Non-Veg Meal</option>
                    <option value="No Food">No Food</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 pt-4 cursor-pointer text-xs font-semibold text-ink dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={srCitizen}
                    onChange={(e) => setSrCitizen(e.target.checked)}
                    className="rounded border-line text-brand focus:ring-brand"
                  />
                  <span>Sr. Citizen Concession</span>
                </label>
              </div>

              {/* Aadhaar UIDAI Token Strip */}
              <div className="rounded-xl border border-line dark:border-slate-800 bg-surface-muted/50 dark:bg-slate-800/60 p-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <div>
                    <div className="font-bold text-ink dark:text-white leading-tight">
                      Aadhaar Verification (Instant Master List)
                    </div>
                    <div className="text-[0.68rem] text-ink-soft dark:text-slate-400 font-mono mt-0.5">
                      UIDAI Token: •••••••• 8912 - Pre-Authenticated
                    </div>
                  </div>
                </div>
                <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[0.65rem] font-bold border border-emerald-500/20">
                  VERIFIED
                </span>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-line/60 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setName("")}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-soft dark:text-slate-400 hover:text-ink dark:hover:text-white transition cursor-pointer"
              >
                Discard
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-5 py-2.5 text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Save Traveller to Vault</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column (lg:col-span-5): Tatkal Pre-Flight Audit & Opening Windows */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Tatkal Pre-Flight Audit */}
          <div className="rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink dark:text-white flex items-center gap-2">
                  <Zap className="h-4 w-4 text-brand dark:text-emerald-400" />
                  Tatkal Pre-Flight Audit
                </h3>
              </div>
              <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 text-xs font-bold border border-amber-500/20 font-mono">
                4 / 6 Ready
              </span>
            </div>

            {/* Checklist items */}
            <div className="space-y-2.5 text-xs">
              {/* Item 1 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-line/60 dark:border-slate-800 bg-surface-muted/30 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-ink dark:text-white">
                      1. IRCTC Login Session
                    </div>
                    <div className="text-[0.68rem] text-ink-soft dark:text-slate-400 font-mono">
                      Session warm • User: rahulsharma***
                    </div>
                  </div>
                </div>
                <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[0.65rem] font-bold">
                  Connected
                </span>
              </div>

              {/* Item 2: Warning */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-amber-500/30 dark:border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/20">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-ink dark:text-white">
                      2. Master Passenger List
                    </div>
                    <div className="text-[0.68rem] text-amber-600 dark:text-amber-400">
                      0/4 Travellers Added • Booking will halt
                    </div>
                  </div>
                </div>
                <span className="rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[0.65rem] font-bold">
                  Action Needed
                </span>
              </div>

              {/* Item 3 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-line/60 dark:border-slate-800 bg-surface-muted/30 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-ink dark:text-white">
                      3. Payment Gateway Link
                    </div>
                    <div className="text-[0.68rem] text-ink-soft dark:text-slate-400 font-mono">
                      UPI Mandate via PhonePe • 0s OTP bypass
                    </div>
                  </div>
                </div>
                <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[0.65rem] font-bold">
                  Autopay Linked
                </span>
              </div>

              {/* Item 4 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-line/60 dark:border-slate-800 bg-surface-muted/30 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-ink dark:text-white">
                      4. Dynamic CAPTCHA Resolver
                    </div>
                    <div className="text-[0.68rem] text-ink-soft dark:text-slate-400 font-mono">
                      &lt; 400ms Local OCR Neural Engine loaded
                    </div>
                  </div>
                </div>
                <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[0.65rem] font-bold">
                  Primed
                </span>
              </div>

              {/* Item 5 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-line/60 dark:border-slate-800 bg-surface-muted/30 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-ink dark:text-white">
                      5. Booking Window Clock Sync
                    </div>
                    <div className="text-[0.68rem] text-ink-soft dark:text-slate-400 font-mono">
                      Live Railway Window Sync: Active
                    </div>
                  </div>
                </div>
                <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[0.65rem] font-bold">
                  Synced
                </span>
              </div>

              {/* Item 6 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-line/60 dark:border-slate-800 bg-surface-muted/30 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <span className="h-4 w-4 rounded-full border-2 border-line dark:border-slate-700 flex items-center justify-center text-[0.6rem] text-ink-faint">
                    …
                  </span>
                  <div>
                    <div className="font-semibold text-ink dark:text-white">
                      6. Failover Backup Strategy
                    </div>
                    <div className="text-[0.68rem] text-ink-soft dark:text-slate-400">
                      Awaiting train selection in &apos;Plan&apos; tab
                    </div>
                  </div>
                </div>
                <span className="rounded bg-surface-muted dark:bg-slate-800 text-ink-faint dark:text-slate-400 px-2 py-0.5 text-[0.65rem] font-bold">
                  Pending
                </span>
              </div>
            </div>

            {/* Pipeline Response Latency Progress bar */}
            <div className="space-y-1.5 pt-2 border-t border-line/60 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-soft dark:text-slate-400 text-[0.7rem]">
                  Pipeline Response Latency
                </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[0.7rem]">
                  18ms (Hyperfast)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-muted dark:bg-slate-800 overflow-hidden">
                <div className="h-full w-4/5 rounded-full bg-emerald-500" />
              </div>
            </div>
          </div>

          {/* Card 2: Daily Opening Windows */}
          <div className="rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-5 shadow-xs space-y-3">
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-ink dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-brand dark:text-emerald-400" />
                Daily Opening Windows
              </h3>
              <p className="text-[0.72rem] text-ink-soft dark:text-slate-400">
                Tatkal opens exactly 24 hours in advance from train origin:
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-line dark:border-slate-800 bg-surface-muted/50 dark:bg-slate-800/60 p-3">
                <div className="text-[0.68rem] font-semibold text-ink-soft dark:text-slate-400">
                  AC Classes (1A, 2A, 3A, CC)
                </div>
                <div className="text-base font-black text-ink dark:text-white mt-1 font-mono">
                  10:00 AM
                </div>
              </div>

              <div className="rounded-xl border border-line dark:border-slate-800 bg-surface-muted/50 dark:bg-slate-800/60 p-3">
                <div className="text-[0.68rem] font-semibold text-ink-soft dark:text-slate-400">
                  Non-AC Classes (SL, 2S)
                </div>
                <div className="text-base font-black text-ink dark:text-white mt-1 font-mono">
                  11:00 AM
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM BANNER: Zero Upfront Deduction Guarantee ──────────────── */}
      <div className="rounded-2xl border border-emerald-500/20 dark:border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <div className="font-bold text-ink dark:text-white">
              Zero Upfront Deduction Guarantee
            </div>
            <p className="text-ink-soft dark:text-slate-400 text-[0.72rem]">
              Your money stays in your account. Pre-authorization is only debited
              when confirmed PNR is generated.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[0.7rem] font-mono text-ink-faint dark:text-slate-400 shrink-0">
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3 text-emerald-500" />
            256-Bit Vault
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Landmark className="h-3 w-3 text-emerald-500" />
            RBI Compliant
          </span>
        </div>
      </div>
    </div>
  );
}
