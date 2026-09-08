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
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { BerthPreference } from "@/types";

interface PrepareEmptyStateProps {
  onTravellerAdded?: () => void;
}

export function PrepareEmptyState({ onTravellerAdded }: PrepareEmptyStateProps) {
  const { addTraveller, travellers } = useStore();
  const { goTo } = useJourney();
  const { t } = useLang();

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
              {t("prepareEmpty.zeroDelay")}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t("prepareEmpty.irctcList")}</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-ink dark:text-white font-[family-name:var(--font-outfit)]">
            {t("prepareEmpty.title")}
          </h1>
          <p className="text-xs sm:text-sm text-ink-soft dark:text-slate-400 leading-relaxed">
            {t("prepareEmpty.sub")}
          </p>
        </div>

        {/* Live Atomic Clock Widget */}
        <div className="rounded-xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 px-4 py-2.5 shadow-xs flex items-center gap-3 font-mono">
          <Clock className="h-4 w-4 text-emerald-500 animate-pulse" />
          <div>
            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-faint dark:text-slate-500">
              {t("prepareEmpty.atomicClock")}
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
                  {t("prepareEmpty.proactiveAdvisory")}
                </span>
              </div>
              <p className="text-xs font-semibold text-ink dark:text-white leading-relaxed">
                {t("prepareEmpty.aaravAdvice")}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-ink-soft dark:text-slate-400 pt-0.5">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Zap className="h-3 w-3" />
                  {t("prepareEmpty.parallelAutofill")}
                </span>
                <span>•</span>
                <span>{t("prepareEmpty.uidai")}</span>
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
              <span>{t("prepareEmpty.addPassenger")}</span>
            </button>

            <button
              type="button"
              onClick={handle1ClickSync}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-line dark:border-slate-700 bg-surface-muted/60 dark:bg-slate-800 hover:bg-surface-muted dark:hover:bg-slate-700 text-ink dark:text-slate-200 px-3.5 py-2 text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t("prepareEmpty.syncIrctc")}</span>
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
                {t("prepareEmpty.quotaSlotsEmpty")}
              </span>
              <h3 className="text-lg font-bold text-ink dark:text-white">
                {t("prepareEmpty.noTravellersSaved")}
              </h3>
              <p className="text-xs text-ink-soft dark:text-slate-400 leading-relaxed">
                {t("prepareEmpty.noTravellersDesc")}
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
                <span>{t("prepareEmpty.addFirstManual")}</span>
              </button>

              <button
                type="button"
                onClick={handle1ClickSync}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-line dark:border-slate-700 bg-surface-muted/40 dark:bg-slate-800/80 px-4 py-2.5 text-xs font-bold text-ink dark:text-slate-200 hover:bg-surface-muted dark:hover:bg-slate-700 transition cursor-pointer"
              >
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span>{t("prepareEmpty.sync1Click")}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-line/60 dark:border-slate-800 text-[0.72rem] text-ink-faint dark:text-slate-400 flex items-center justify-center gap-2">
              <Mic className="h-3.5 w-3.5 text-brand dark:text-emerald-400 animate-pulse" />
              <span>
                {t("prepareEmpty.sayAdd")}
              </span>
              <span className="rounded bg-surface-muted dark:bg-slate-800 px-1.5 py-0.2 text-[0.65rem] font-mono">
                {t("prepareEmpty.voiceAi")}
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
                  {t("prepareEmpty.fastOnboarding")}
                </h3>
                <p className="text-[0.72rem] text-ink-soft dark:text-slate-400">
                  {t("prepareEmpty.slot1of4")}
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 text-[0.68rem] font-bold flex items-center gap-1 border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" />
                {t("prepareEmpty.irctcFastTrack")}
              </span>
            </div>

            <div className="space-y-3.5">
              {/* Name field */}
              <div className="space-y-1">
                <label
                  htmlFor="traveller-name-input"
                  className="text-[0.7rem] font-bold text-ink-soft dark:text-slate-300 uppercase tracking-wider"
                >
                  {t("prepareEmpty.fullName")}
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
                    {t("prepareEmpty.age")}
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
                    {t("prepareEmpty.gender")}
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full rounded-xl border border-line dark:border-slate-800 bg-surface-muted/40 dark:bg-slate-800/80 px-3 py-2 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:border-brand"
                  >
                    <option value="M">{t("prepareEmpty.male")}</option>
                    <option value="F">{t("prepareEmpty.female")}</option>
                    <option value="O">{t("prepareEmpty.other")}</option>
                  </select>
                </div>
              </div>

              {/* Berth Preference */}
              <div className="space-y-1.5">
                <label className="text-[0.7rem] font-bold text-ink-soft dark:text-slate-300 uppercase tracking-wider">
                  {t("prepareEmpty.berthPref")}
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
                    {t("prepareEmpty.foodPref")}
                  </label>
                  <select
                    value={food}
                    onChange={(e) => setFood(e.target.value)}
                    className="w-full rounded-xl border border-line dark:border-slate-800 bg-surface-muted/40 dark:bg-slate-800/80 px-3 py-2 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:border-brand"
                  >
                    <option value="Veg Meal">{t("prepareEmpty.vegMeal")}</option>
                    <option value="Non-Veg Meal">{t("prepareEmpty.nonVegMeal")}</option>
                    <option value="No Food">{t("prepareEmpty.noFood")}</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 pt-4 cursor-pointer text-xs font-semibold text-ink dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={srCitizen}
                    onChange={(e) => setSrCitizen(e.target.checked)}
                    className="rounded border-line text-brand focus:ring-brand"
                  />
                  <span>{t("prepareEmpty.srCitizen")}</span>
                </label>
              </div>

              {/* Aadhaar UIDAI Token Strip */}
              <div className="rounded-xl border border-line dark:border-slate-800 bg-surface-muted/50 dark:bg-slate-800/60 p-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <div>
                    <div className="font-bold text-ink dark:text-white leading-tight">
                      {t("prepareEmpty.aadhaarVerif")}
                    </div>
                    <div className="text-[0.68rem] text-ink-soft dark:text-slate-400 font-mono mt-0.5">
                      {t("prepareEmpty.uidaiPreAuth")}
                    </div>
                  </div>
                </div>
                <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[0.65rem] font-bold border border-emerald-500/20">
                  {t("prepareEmpty.verified")}
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
                {t("prepareEmpty.discard")}
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-5 py-2.5 text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{t("prepareEmpty.saveToVault")}</span>
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
                  {t("prepareEmpty.preFlightAudit")}
                </h3>
              </div>
              <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 text-xs font-bold border border-amber-500/20 font-mono">
                {t("prepareEmpty.readyCount")}
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
                      {t("prepareEmpty.irctcSession")}
                    </div>
                    <div className="text-[0.68rem] text-ink-soft dark:text-slate-400 font-mono">
                      Session warm • User: rahulsharma***
                    </div>
                  </div>
                </div>
                <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[0.65rem] font-bold">
                  {t("prepareEmpty.connected")}
                </span>
              </div>

              {/* Item 2: Warning */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-amber-500/30 dark:border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/20">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-ink dark:text-white">
                      {t("prepareEmpty.masterList")}
                    </div>
                    <div className="text-[0.68rem] text-amber-600 dark:text-amber-400">
                      0/4 Travellers Added • Booking will halt
                    </div>
                  </div>
                </div>
                <span className="rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[0.65rem] font-bold">
                  {t("prepareEmpty.actionNeeded")}
                </span>
              </div>

              {/* Item 3 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-line/60 dark:border-slate-800 bg-surface-muted/30 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-ink dark:text-white">
                      {t("prepareEmpty.paymentGateway")}
                    </div>
                    <div className="text-[0.68rem] text-ink-soft dark:text-slate-400 font-mono">
                      UPI Mandate via PhonePe • 0s OTP bypass
                    </div>
                  </div>
                </div>
                <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[0.65rem] font-bold">
                  {t("prepareEmpty.autopayLinked")}
                </span>
              </div>

              {/* Item 4 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-line/60 dark:border-slate-800 bg-surface-muted/30 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-ink dark:text-white">
                      {t("prepareEmpty.captchaResolver")}
                    </div>
                    <div className="text-[0.68rem] text-ink-soft dark:text-slate-400 font-mono">
                      &lt; 400ms Local OCR Neural Engine loaded
                    </div>
                  </div>
                </div>
                <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[0.65rem] font-bold">
                  {t("prepareEmpty.primed")}
                </span>
              </div>

              {/* Item 5 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-line/60 dark:border-slate-800 bg-surface-muted/30 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-ink dark:text-white">
                      {t("prepareEmpty.clockSync")}
                    </div>
                    <div className="text-[0.68rem] text-ink-soft dark:text-slate-400 font-mono">
                      Live Railway Window Sync: Active
                    </div>
                  </div>
                </div>
                <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[0.65rem] font-bold">
                  {t("prepareEmpty.synced")}
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
                      {t("prepareEmpty.failoverBackup")}
                    </div>
                    <div className="text-[0.68rem] text-ink-soft dark:text-slate-400">
                      Awaiting train selection in &apos;Plan&apos; tab
                    </div>
                  </div>
                </div>
                <span className="rounded bg-surface-muted dark:bg-slate-800 text-ink-faint dark:text-slate-400 px-2 py-0.5 text-[0.65rem] font-bold">
                  {t("prepareEmpty.pending")}
                </span>
              </div>
            </div>

            {/* Pipeline Response Latency Progress bar */}
            <div className="space-y-1.5 pt-2 border-t border-line/60 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-soft dark:text-slate-400 text-[0.7rem]">
                  {t("prepareEmpty.pipelineLatency")}
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
                {t("prepareEmpty.dailyWindows")}
              </h3>
              <p className="text-[0.72rem] text-ink-soft dark:text-slate-400">
                {t("prepareEmpty.dailyWindowsSub")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-line dark:border-slate-800 bg-surface-muted/50 dark:bg-slate-800/60 p-3">
                <div className="text-[0.68rem] font-semibold text-ink-soft dark:text-slate-400">
                  {t("prepareEmpty.acClasses")}
                </div>
                <div className="text-base font-black text-ink dark:text-white mt-1 font-mono">
                  10:00 AM
                </div>
              </div>

              <div className="rounded-xl border border-line dark:border-slate-800 bg-surface-muted/50 dark:bg-slate-800/60 p-3">
                <div className="text-[0.68rem] font-semibold text-ink-soft dark:text-slate-400">
                  {t("prepareEmpty.nonAcClasses")}
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
              {t("prepareEmpty.zeroDeduction")}
            </div>
            <p className="text-ink-soft dark:text-slate-400 text-[0.72rem]">
              {t("prepareEmpty.zeroDeductionSub")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[0.7rem] font-mono text-ink-faint dark:text-slate-400 shrink-0">
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3 text-emerald-500" />
            {t("prepareEmpty.vault256")}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Landmark className="h-3 w-3 text-emerald-500" />
            {t("prepareEmpty.rbiCompliant")}
          </span>
        </div>
      </div>
    </div>
  );
}
