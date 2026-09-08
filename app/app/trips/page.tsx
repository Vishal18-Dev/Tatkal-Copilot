"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Train, Ticket, Bookmark, Trash2, ArrowRight, Sparkles, RefreshCw, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState, Chip } from "@/components/app/ui";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { tripStatusWord, statusMeta } from "@/lib/agent";
import { formatFare, cn } from "@/lib/utils";
import { CANONICAL_DEMO_TRIP_ID, createCanonicalDemoTrip } from "@/lib/demo/scenarios";
import type { Trip } from "@/types";

export default function TripsPage() {
  const { trips, savedJourneys, deleteJourney, addTrip } = useStore();
  const { t } = useLang();
  const [tab, setTab] = useState<"upcoming" | "completed">("upcoming");

  // Guarantee the canonical demo trip is always present in My Trips
  useEffect(() => {
    if (!trips.some((t) => t.id === CANONICAL_DEMO_TRIP_ID)) {
      addTrip(createCanonicalDemoTrip());
    }
  }, [trips, addTrip]);

  const upcoming = trips.filter((t) => t.agentState !== "confirmed");
  const completed = trips.filter((t) => t.agentState === "confirmed");
  const list = tab === "upcoming" ? upcoming : completed;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("trips.title")} subtitle={t("trips.subtitle")} />

      <div className="mb-5 inline-flex rounded-full border border-line bg-surface p-1">
        {(["upcoming", "completed"] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-colors", tab === tabKey ? "bg-brand text-white" : "text-ink-soft hover:text-ink")}
          >
            {t(`trips.${tabKey}`)} ({tabKey === "upcoming" ? upcoming.length : completed.length})
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<Ticket className="h-6 w-6" />}
          title={tab === "upcoming" ? t("trips.emptyUpTitle") : t("trips.emptyCompTitle")}
          body={tab === "upcoming" ? t("trips.emptyUpBody") : t("trips.emptyCompBody")}
          actionLabel={t("trips.planTrip")}
          actionHref="/app/plan"
        />
      ) : (
        <div className="space-y-3">
          {list.map((tr) => (
            <TripCard key={tr.id} trip={tr} />
          ))}
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">{t("trips.savedJourneys")}</h2>
        {savedJourneys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong bg-surface/50 px-5 py-8 text-center text-sm text-ink-faint">
            {t("trips.savedEmpty")}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {savedJourneys.map((j) => (
              <div key={j.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
                <Bookmark className="h-4 w-4 shrink-0 text-brand" />
                <Link href={`/app/plan?goal=${encodeURIComponent(`${j.from} to ${j.to}`)}`} className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink">{j.from} → {j.to}</div>
                  <div className="text-xs text-ink-faint">{j.travelClass} · {j.travellerIds.length} {j.travellerIds.length > 1 ? t("common.travellers") : t("common.traveller")}</div>
                </Link>
                <button onClick={() => deleteJourney(j.id)} aria-label="Remove saved journey" className="grid h-8 w-8 place-items-center rounded-full text-ink-faint hover:bg-danger-soft hover:text-danger">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const { deleteTrip } = useStore();
  const { t } = useLang();
  const word = tripStatusWord(trip.agentState);
  const meta = statusMeta(trip.agentState);
  const confirmed = trip.agentState === "confirmed";
  const travWord = trip.travellerIds.length > 1 ? t("common.travellers") : t("common.traveller");
  const isDemo = trip.id === CANONICAL_DEMO_TRIP_ID || trip.id.startsWith("demo_trip");

  // Rich Demo Travel Card with 3 Scenarios
  if (isDemo && !confirmed) {
    return (
      <div className="relative group">
        <Card lift className="p-5 sm:p-6 border-brand/40 bg-surface shadow-md relative overflow-hidden">
          {/* Subtle ambient lighting */}
          <div className="absolute top-0 right-0 h-40 w-40 bg-brand/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-4">
            <Link href={`/app/book?tripId=${trip.id}`} className="flex items-center gap-3.5 min-w-0 flex-1 group-hover:opacity-95 transition-opacity">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand border border-brand/20 shadow-xs">
                <Train className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xl font-bold text-ink tracking-tight">{trip.from} → {trip.to}</span>
                  <Chip tone="brand">{trip.travelClass}</Chip>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/25">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    DEMO TRAVEL · 3 SCENARIOS
                  </span>
                </div>
                <div className="mt-1 text-xs text-ink-faint flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink-soft">{trip.dateLabel === "Tomorrow" ? t("common.tomorrow") : trip.dateLabel} · 10:00 AM Window</span>
                  <span>•</span>
                  <span>{trip.trainName}</span>
                  <span>•</span>
                  <span>{trip.travellerIds.length} {travWord}</span>
                </div>
              </div>
            </Link>

            <Link
              href={`/app/book?tripId=${trip.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand text-white px-4 py-2 text-xs font-bold shadow-xs hover:bg-brand/90 transition cursor-pointer self-start sm:self-auto shrink-0"
            >
              <span>{t("home.missionControl")}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Interactive 3-Scenario Launcher Strip */}
          <div className="mt-4 space-y-2.5">
            <div className="text-[0.68rem] font-bold uppercase tracking-wider text-ink-faint flex items-center justify-between">
              <span>Always Available Demo Scenarios</span>
              <span className="text-brand font-medium">Click any scenario to launch</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* Scenario 1 */}
              <Link
                href={`/app/book?tripId=${trip.id}&scenario=assisted_briefing`}
                className="group/sc rounded-xl border border-line bg-surface hover:bg-surface-muted p-3 transition flex flex-col justify-between gap-2.5 hover:border-sky-500/40 shadow-2xs cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[0.65rem] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                      Scenario 1
                    </span>
                    <Sparkles className="h-3.5 w-3.5 text-sky-500" />
                  </div>
                  <h4 className="text-xs font-bold text-ink mt-2 group-hover/sc:text-brand transition">
                    Assisted Briefing
                  </h4>
                  <p className="text-[0.72rem] text-ink-faint mt-1 leading-snug">
                    User available · Proactive voice briefing · 1-tap approval
                  </p>
                </div>
                <span className="text-[0.72rem] font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1 group-hover/sc:translate-x-0.5 transition-transform">
                  Launch Scenario 1 <ArrowRight className="h-3 w-3" />
                </span>
              </Link>

              {/* Scenario 2 */}
              <Link
                href={`/app/book?tripId=${trip.id}&scenario=assisted_to_permissioned_backup_success`}
                className="group/sc rounded-xl border border-line bg-surface hover:bg-surface-muted p-3 transition flex flex-col justify-between gap-2.5 hover:border-amber-500/40 shadow-2xs cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[0.65rem] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      Scenario 2
                    </span>
                    <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <h4 className="text-xs font-bold text-ink mt-2 group-hover/sc:text-brand transition">
                    Assisted → Backup
                  </h4>
                  <p className="text-[0.72rem] text-ink-faint mt-1 leading-snug">
                    User outside · Autonomous takeover · Backup succeeds
                  </p>
                </div>
                <span className="text-[0.72rem] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 group-hover/sc:translate-x-0.5 transition-transform">
                  Launch Scenario 2 <ArrowRight className="h-3 w-3" />
                </span>
              </Link>

              {/* Scenario 3 */}
              <Link
                href={`/app/book?tripId=${trip.id}&scenario=assisted_to_permissioned_premium_tatkal_success`}
                className="group/sc rounded-xl border border-line bg-surface hover:bg-surface-muted p-3 transition flex flex-col justify-between gap-2.5 hover:border-emerald-500/40 shadow-2xs cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Scenario 3
                    </span>
                    <Zap className="h-3.5 w-3.5 text-emerald-500" />
                  </div>
                  <h4 className="text-xs font-bold text-ink mt-2 group-hover/sc:text-brand transition">
                    Premium Tatkal
                  </h4>
                  <p className="text-[0.72rem] text-ink-faint mt-1 leading-snug">
                    2-stage recovery · Real guards evaluated · PT confirmed
                  </p>
                </div>
                <span className="text-[0.72rem] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover/sc:translate-x-0.5 transition-transform">
                  Launch Scenario 3 <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative group">
      <Link href={`/app/book?tripId=${trip.id}`}>
        <Card lift className="p-5">
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
              <Train className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold text-ink">{trip.from} → {trip.to}</span>
                <Chip tone="brand">{trip.travelClass}</Chip>
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                  <Chip tone={word.tone}>{t(word.key)}</Chip>
                </span>
              </div>
              <div className="mt-0.5 text-sm text-ink-faint">
                {trip.dateLabel === "Tomorrow" ? t("common.tomorrow") : trip.dateLabel} · {trip.trainName} · {trip.travellerIds.length} {travWord}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  deleteTrip(trip.id);
                }}
                title="Remove trip"
                aria-label="Remove trip"
                className="grid h-8 w-8 place-items-center rounded-full text-ink-faint hover:bg-danger-soft hover:text-danger transition cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <span className="hidden items-center gap-1 text-sm font-medium text-brand sm:inline-flex">
                {confirmed ? t("trips.viewTicket") : t("home.missionControl")} <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </div>

          {confirmed && trip.booking?.status === "success" && (
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface-muted/50 p-3 sm:grid-cols-4">
              <TicketField label={t("ticket.pnr")} value={trip.booking.pnr ?? "—"} />
              <TicketField label={t("ticket.coach")} value={trip.booking.coach ?? "—"} />
              <TicketField label={t("ticket.boarding")} value={trip.boardingStationName} />
              <TicketField label={t("ticket.amount")} value={formatFare(trip.booking.amount ?? trip.fare)} />
            </div>
          )}
        </Card>
      </Link>
    </div>
  );
}

function TicketField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.66rem] font-medium uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="tabular mt-0.5 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}
