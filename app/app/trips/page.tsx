"use client";

import { useState } from "react";
import Link from "next/link";
import { Train, Ticket, Bookmark, Trash2, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState, Chip } from "@/components/app/ui";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { tripStatusWord, statusMeta } from "@/lib/agent";
import { formatFare, cn } from "@/lib/utils";
import type { Trip } from "@/types";

export default function TripsPage() {
  const { trips, savedJourneys, deleteJourney } = useStore();
  const { t } = useLang();
  const [tab, setTab] = useState<"upcoming" | "completed">("upcoming");

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
  const { t } = useLang();
  const word = tripStatusWord(trip.agentState);
  const meta = statusMeta(trip.agentState);
  const confirmed = trip.agentState === "confirmed";
  const travWord = trip.travellerIds.length > 1 ? t("common.travellers") : t("common.traveller");
  return (
    <Link href={`/app/trips/${trip.id}`}>
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
              {trip.dateLabel} · {trip.trainName} · {trip.travellerIds.length} {travWord}
            </div>
          </div>
          <span className="hidden items-center gap-1 text-sm font-medium text-brand sm:inline-flex">
            {confirmed ? t("trips.viewTicket") : t("home.missionControl")} <ArrowRight className="h-4 w-4" />
          </span>
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
