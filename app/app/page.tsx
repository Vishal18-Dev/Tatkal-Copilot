"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Mic,
  ArrowRight,
  Ticket,
  Users,
  Activity as ActivityIcon,
  Bookmark,
  Train,
  Clock,
  Brain,
  Plus,
  Compass,
  Radio,
  MessageCircle,
  ShieldCheck,
  Wallet,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/app/ui";
import { CallButton } from "@/components/calling/CallButton";
import { VoiceConversation } from "@/components/voice/VoiceConversation";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { useInteractionMode } from "@/lib/interaction-mode";
import { readinessFor } from "@/lib/agent";
import { formatFare } from "@/lib/utils";

export default function HomePage() {
  const { hydrated, user, trips, savedJourneys, travellers, activity, identity, wallet } = useStore();
  const { t } = useLang();
  const { mode: interactionMode } = useInteractionMode();
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);

  const voiceFirst = interactionMode === "voice" || interactionMode === "accessible";

  const upcoming = trips.filter((tr) => tr.agentState !== "confirmed");
  const booked = trips.filter((tr) => tr.agentState === "confirmed");
  const activeTrip = upcoming[0] ?? null;

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

  // Memory insights
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
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header Greeting & Agent Status */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-confirm opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-confirm" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-confirm">
              {t("home.copilotWatching")}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-[1.9rem]">
            {greeting()}
            {user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            {t("home.commandCenterSub")}
          </p>
        </div>

        <Link href="/app/plan">
          <Button size="md" className="gap-2 shadow-[var(--shadow-brand)]">
            <Plus className="h-4 w-4" /> {t("home.planNewTrip")}
          </Button>
        </Link>
      </motion.div>

      {/* Prominent Goal Entry */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-[var(--radius-lg)] border border-line-strong bg-surface p-3 shadow-[var(--shadow-card)] focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="ml-2 h-5 w-5 shrink-0 text-brand" />
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && plan()}
            placeholder={t("home.placeholderNext")}
            className="w-full bg-transparent px-1 py-2 text-[1.02rem] text-ink placeholder:text-ink-faint focus:outline-none"
          />
          {/* Speak this journey — leads with brand emphasis when voice is the chosen mode. */}
          <button
            onClick={() => setVoiceOpen(true)}
            aria-label={t("goal.speakTitle")}
            aria-haspopup="dialog"
            className={
              voiceFirst
                ? "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white shadow-[var(--shadow-brand)] transition hover:opacity-90"
                : "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-ink-soft transition-colors hover:border-brand hover:text-brand"
            }
          >
            <Mic className="h-5 w-5" />
          </button>
          <button
            onClick={() => plan()}
            aria-label={t("nav.plan")}
            className={
              voiceFirst
                ? "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-ink-soft transition-colors hover:border-brand hover:text-brand"
                : "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white shadow-[var(--shadow-brand)] transition-colors hover:bg-[#4338ca]"
            }
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {voiceOpen && <VoiceConversation key="home-voice" onClose={() => setVoiceOpen(false)} />}
      </AnimatePresence>

      {/* Primary Section: Active Tatkal Plan or Empty State */}
      {hydrated && activeTrip ? (
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {t("home.activePlanHeader")}
            </h2>
            <Link href="/app/trips" className="text-xs font-medium text-brand hover:underline">
              {t("home.viewAll")} ({trips.length})
            </Link>
          </div>

          <Card lift className="overflow-hidden border-brand/30 bg-gradient-to-br from-surface to-brand-soft/20 p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xl font-bold tracking-tight text-ink">
                    {activeTrip.from} → {activeTrip.to}
                  </span>
                  <Chip tone="brand">{activeTrip.travelClass}</Chip>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-confirm-soft px-2.5 py-0.5 text-xs font-semibold text-confirm">
                    <Radio className="h-3 w-3 animate-pulse" /> {t("home.activeWatch")}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
                  <span className="flex items-center gap-1.5">
                    <Train className="h-4 w-4 text-brand" /> {activeTrip.primary.trainName}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-brand" /> {t("home.tatkalOpens")} {activeTrip.tatkalOpensAtLabel}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-brand" /> {activeTrip.travellerIds.length} {travWord(activeTrip.travellerIds.length)}
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs font-medium text-ink-faint">{t("home.readinessLabel")}</span>
                  <div className="flex items-center gap-1">
                    {readinessFor(activeTrip).map((r) => (
                      <span
                        key={r.id}
                        title={r.label}
                        className={`h-2.5 w-6 rounded-full ${r.done ? "bg-confirm" : "bg-line"}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-confirm">
                    {readinessFor(activeTrip).filter((r) => r.done).length}/{readinessFor(activeTrip).length} {t("home.ready")}
                  </span>
                </div>

                {/* Identity + Payment readiness — prepared before Tatkal */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <ReadinessChip
                    ready={identity.status === "verified"}
                    icon={<ShieldCheck className="h-3.5 w-3.5" />}
                    label={t("readiness.identity")}
                  />
                  <ReadinessChip
                    ready={wallet.balance >= activeTrip.fare * Math.max(1, activeTrip.travellerIds.length)}
                    icon={<Wallet className="h-3.5 w-3.5" />}
                    label={t("readiness.payment")}
                  />
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
                <Link href={`/app/trips/${activeTrip.id}`}>
                  <Button size="lg" className="w-full gap-2 shadow-[var(--shadow-brand)]">
                    <Compass className="h-4 w-4" /> {t("home.viewMissionControl")}
                  </Button>
                </Link>
                <CallButton className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink" />
              </div>
            </div>
          </Card>
        </section>
      ) : hydrated ? (
        <Card className="border-dashed border-line p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Sparkles className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-ink">{t("trips.emptyUpTitle")}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
            {t("trips.emptyUpBody")}
          </p>
          <Link href="/app/plan" className="mt-5 inline-block">
            <Button size="md" className="gap-2">
              <Plus className="h-4 w-4" /> {t("trips.planTrip")}
            </Button>
          </Link>
        </Card>
      ) : null}

      {/* Quick Actions Grid */}
      <section>
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">{t("home.quickActions")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <QuickAction href="/app/plan" icon={<Sparkles className="h-5 w-5" />} label={t("nav.plan")} sub={t("home.newJourney")} />
          <QuickAction href="/app/trips" icon={<Ticket className="h-5 w-5" />} label={t("nav.trips")} sub={`${trips.length} ${t("home.saved")}`} />
          <QuickAction href="/app/travellers" icon={<Users className="h-5 w-5" />} label={t("nav.travellers")} sub={`${travellers.length} ${t("home.inVault")}`} />
          <QuickAction href="/app/activity" icon={<ActivityIcon className="h-5 w-5" />} label={t("nav.activity")} sub={`${activity.length} ${t("home.events")}`} />
          <QuickAction href="/app/whatsapp" icon={<MessageCircle className="h-5 w-5" />} label={t("wa.pageTitle")} sub={t("home.demo")} />
        </div>
      </section>

      {/* Saved Journeys & Memory */}
      {savedJourneys.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">{t("home.savedJourneys")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
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
        </section>
      )}

      {/* Data-backed Copilot Memory */}
      {insights.length > 0 && (
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2 text-brand">
            <Brain className="h-5 w-5" />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{t("home.memory")}</h2>
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
        <div className="flex items-center gap-2 text-sm text-ink-faint">
          <Clock className="h-4 w-4" />
          {booked.length} {t("home.confirmed")} {booked.length > 1 ? t("home.bookings") : t("home.booking")} ·{" "}
          {formatFare(booked.reduce((s, tr) => s + (tr.booking?.amount ?? 0), 0))} {t("home.total")}
        </div>
      )}
    </div>
  );
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

function ReadinessChip({
  ready,
  icon,
  label,
}: {
  ready: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-medium " +
        (ready ? "bg-confirm-soft text-confirm" : "bg-caution-soft text-caution")
      }
    >
      {icon}
      {label}
      {ready && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}

function mode(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const x of arr) counts[x] = (counts[x] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
