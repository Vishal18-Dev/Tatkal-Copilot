"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Ticket,
  Users,
  Activity as ActivityIcon,
  Bookmark,
  Train,
  Clock,
  Brain,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/app/ui";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { formatFare } from "@/lib/utils";

export default function HomePage() {
  const { hydrated, user, trips, savedJourneys, travellers } = useStore();
  const { t } = useLang();
  const router = useRouter();
  const [goal, setGoal] = useState("");

  const upcoming = trips.filter((tr) => tr.agentState !== "confirmed");
  const booked = trips.filter((tr) => tr.agentState === "confirmed");

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return t("home.greetMorning");
    if (h < 17) return t("home.greetAfternoon");
    return t("home.greetEvening");
  }

  function plan(g?: string) {
    const q = (g ?? goal).trim();
    router.push(q ? `/app/plan?goal=${encodeURIComponent(q)}` : "/app/plan");
  }

  const travWord = (n: number) => (n > 1 ? t("common.travellers") : t("common.traveller"));

  // Data-backed memory insights (never fabricated).
  const routes = [
    ...booked.map((tr) => `${tr.from} → ${tr.to}`),
    ...savedJourneys.map((j) => `${j.from} → ${j.to}`),
  ];
  const insights: string[] = [];
  const freqRoute = mode(routes);
  if (freqRoute) insights.push(`${t("home.usuallyTravel")} ${freqRoute}.`);
  const freqClass = mode(booked.map((tr) => tr.travelClass));
  if (freqClass) insights.push(`${t("home.preferClass")} ${freqClass}.`);

  return (
    <div className="mx-auto max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-ink-soft">
          {greeting()}
          {user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-[1.9rem]">
          {t("home.title")}
        </h1>
      </motion.div>

      {/* Conversational entry */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-5 rounded-[var(--radius-lg)] border border-line-strong bg-surface p-3 shadow-[var(--shadow-card)] focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="ml-2 h-5 w-5 shrink-0 text-brand" />
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && plan()}
            placeholder={t("home.placeholder")}
            className="w-full bg-transparent px-1 py-2.5 text-[1.05rem] text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <button
            onClick={() => plan()}
            aria-label={t("nav.plan")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white shadow-[var(--shadow-brand)] transition-colors hover:bg-[#4338ca]"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </motion.div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {[t("goal.example1"), t("goal.example3"), t("goal.example2")].map((ex) => (
          <button
            key={ex}
            onClick={() => plan(ex)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-brand/40 hover:text-ink"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Upcoming trip */}
      {hydrated && upcoming.length > 0 && (
        <div className="mt-8">
          <SectionLabel>{t("home.upcoming")}</SectionLabel>
          {upcoming.slice(0, 1).map((tr) => (
            <Link key={tr.id} href={`/app/trips/${tr.id}`}>
              <Card lift className="mt-2 flex items-center gap-4 p-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <Train className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold text-ink">
                      {tr.from} → {tr.to}
                    </span>
                    <Chip tone="brand">{tr.travelClass}</Chip>
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                      <span className="h-2 w-2 rounded-full bg-confirm" /> {t("home.watching")}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sm text-ink-faint">
                    {tr.dateLabel} · {tr.travellerIds.length} {travWord(tr.travellerIds.length)} · {tr.trainName}
                  </div>
                </div>
                <span className="hidden items-center gap-1 text-sm font-medium text-brand sm:inline-flex">
                  {t("home.missionControl")} <ArrowRight className="h-4 w-4" />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-8">
        <SectionLabel>{t("home.quickActions")}</SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction href="/app/plan" icon={<Sparkles className="h-5 w-5" />} label={t("nav.plan")} sub={t("home.newJourney")} />
          <QuickAction href="/app/trips" icon={<Ticket className="h-5 w-5" />} label={t("nav.trips")} sub={`${trips.length} ${t("home.saved")}`} />
          <QuickAction href="/app/travellers" icon={<Users className="h-5 w-5" />} label={t("nav.travellers")} sub={`${travellers.length} ${t("home.saved")}`} />
          <QuickAction href="/app/activity" icon={<ActivityIcon className="h-5 w-5" />} label={t("nav.activity")} sub={t("home.agentLog")} />
        </div>
      </div>

      {/* Saved journeys */}
      {savedJourneys.length > 0 && (
        <div className="mt-8">
          <SectionLabel>{t("home.savedJourneys")}</SectionLabel>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {savedJourneys.slice(0, 4).map((j) => (
              <button
                key={j.id}
                onClick={() => plan(`${j.from} to ${j.to}`)}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-brand/40"
              >
                <Bookmark className="h-4 w-4 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink">
                    {j.from} → {j.to}
                  </div>
                  <div className="text-xs text-ink-faint">
                    {j.travelClass} · {j.travellerIds.length} {travWord(j.travellerIds.length)}
                  </div>
                </div>
                <span className="text-xs font-medium text-brand">{t("home.planAgain")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Copilot memory (data-backed only) */}
      {insights.length > 0 && (
        <Card className="mt-8 p-5">
          <div className="mb-2 flex items-center gap-2 text-brand">
            <Brain className="h-5 w-5" />
            <SectionLabel>{t("home.memory")}</SectionLabel>
          </div>
          <ul className="space-y-1.5">
            {insights.map((tx, i) => (
              <li key={i} className="flex items-start gap-2 text-[0.95rem] text-ink-soft">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                {tx}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {booked.length > 0 && (
        <div className="mt-8 flex items-center gap-2 text-sm text-ink-faint">
          <Clock className="h-4 w-4" />
          {booked.length} {t("home.confirmed")} {booked.length > 1 ? t("home.bookings") : t("home.booking")} ·{" "}
          {formatFare(booked.reduce((s, tr) => s + (tr.booking?.amount ?? 0), 0))} {t("home.total")}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{children}</h2>;
}

function QuickAction({
  href,
  icon,
  label,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <Link href={href} className="block h-full">
      <Card lift className="flex h-full flex-col gap-3 p-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand">
          {icon}
        </span>
        <div className="mt-auto">
          <div className="text-sm font-semibold text-ink">{label}</div>
          <div className="text-xs text-ink-faint">{sub}</div>
        </div>
      </Card>
    </Link>
  );
}

function mode(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const x of arr) counts[x] = (counts[x] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
