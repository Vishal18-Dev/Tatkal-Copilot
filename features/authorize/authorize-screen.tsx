"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Check,
  Users,
  TrainFront,
  Split,
  MapPin,
  Bell,
  Zap,
  Info,
  Bookmark,
  Mail,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StepShell } from "@/components/step-shell";
import { DemoBadge } from "@/components/app/ui";
import { AuthModal } from "@/components/auth/auth-modal";
import { useJourney } from "@/lib/journey";
import { useStore } from "@/lib/store";
import { cn, formatFare } from "@/lib/utils";
import type { StrategySnapshot, StrategyOption } from "@/types";

function snapshot(o: StrategyOption): StrategySnapshot {
  return {
    optionId: o.id,
    trainName: o.title,
    travelClass: o.travelClass,
    boardingStationName: o.boardingStationName,
    departureDisplay: o.departureDisplay,
    arrivalDisplay: o.arrivalDisplay,
    level: o.level,
    fare: o.fare,
    via: o.kind === "split" ? o.title.replace(/^Split via\s*/, "") : undefined,
  };
}

export function AuthorizeScreen() {
  const { plan, chosenOption, recoveryOption, selectedPassengers, mode, setMode } =
    useJourney();
  const { user, isAuthed, updateProfile, saveJourney, addTrip, logActivity, pushNotification } = useStore();
  const [saveJ, setSaveJ] = useState(true);
  const [prefInApp, setPrefInApp] = useState(true);
  const [prefEmail, setPrefEmail] = useState(true);
  const [prefWhatsapp, setPrefWhatsapp] = useState(false);
  const [userEmail, setUserEmail] = useState(user?.email || "");
  const [authOpen, setAuthOpen] = useState(false);
  const router = useRouter();

  if (!plan || !chosenOption) return null;
  const total = chosenOption.fare * Math.max(1, selectedPassengers.length);

  // Local, honest readiness read-out for this in-progress plan — no live
  // system is queried; every item reflects what's already been chosen in
  // this wizard.
  const travellerNames = selectedPassengers.map((p) => p.name.split(" ")[0]);
  const notifyReady = prefEmail ? !!userEmail.trim() : prefInApp || prefWhatsapp;
  const checklist = [
    {
      id: "travellers",
      label: "Travellers ready",
      ready: selectedPassengers.length > 0,
      detail:
        selectedPassengers.length > 0
          ? travellerNames.join(", ")
          : "No travellers added yet",
      icon: <Users className="h-4 w-4" />,
    },
    {
      id: "primary",
      label: "Primary train selected",
      ready: true,
      detail: `${chosenOption.title} · ${chosenOption.travelClass}`,
      icon: <TrainFront className="h-4 w-4" />,
    },
    {
      id: "backup",
      label: "Backup strategy",
      ready: !!recoveryOption,
      detail: recoveryOption ? recoveryOption.title : "No backup selected — optional, but recommended",
      icon: <Split className="h-4 w-4" />,
    },
    {
      id: "boarding",
      label: "Boarding station confirmed",
      ready: true,
      detail: chosenOption.boardingStationName,
      icon: <MapPin className="h-4 w-4" />,
    },
    {
      id: "notify",
      label: "How we'll reach you",
      ready: notifyReady,
      detail: notifyReady
        ? prefEmail && userEmail
          ? userEmail
          : "In-app notifications enabled"
        : "Add an email or keep in-app alerts on",
      icon: <Bell className="h-4 w-4" />,
      action: !notifyReady,
    },
  ];
  const readyCount = checklist.filter((c) => c.ready).length;

  function activate() {
    if (!plan || !chosenOption) return;
    const primary = snapshot(chosenOption);
    const backup = recoveryOption ? snapshot(recoveryOption) : null;

    const trip = addTrip({
      status: "upcoming",
      from: plan.intent.from,
      fromCode: plan.intent.fromCode,
      to: plan.intent.to,
      toCode: plan.intent.toCode,
      dateLabel: "Tomorrow",
      trainName: primary.trainName,
      travelClass: primary.travelClass,
      travellerIds: selectedPassengers.map((p) => p.id),
      boardingStationName: primary.boardingStationName,
      arrivalDisplay: primary.arrivalDisplay,
      fare: primary.fare,
      mode,
      agentState: "scheduled",
      agentEnabled: true,
      tatkalOpensAtLabel: "10:00 AM",
      arrivalTargetLabel: plan.intent.arrivalDeadline
        ? `before ${plan.intent.arrivalDeadline}`
        : undefined,
      primary,
      backup,
      readinessDone: [],
      planNotifications: [],
      channelPreferences: {
        inApp: prefInApp,
        email: prefEmail,
        whatsappDemo: prefWhatsapp,
      },
      userEmail: userEmail || user?.email || "vishal@example.com",
    });

    if (userEmail) {
      updateProfile({ email: userEmail });
    }

    if (saveJ) {
      saveJourney({
        fromCode: plan.intent.fromCode,
        from: plan.intent.from,
        toCode: plan.intent.toCode,
        to: plan.intent.to,
        travellerIds: selectedPassengers.map((p) => p.id),
        travelClass: primary.travelClass,
        priority: "confirmation",
      });
    }

    logActivity(
      [
        { kind: "strategy_change", text: `Strategy created · ${primary.trainName}` },
        { kind: "saved", text: "Passenger list prepared" },
        ...(backup ? [{ kind: "strategy_change" as const, text: `Backup strategy created · ${backup.trainName}` }] : []),
        { kind: "authorized", text: `Plan activated · agent watching (${mode === "auto" ? "permissioned demo" : "assisted"})` },
      ],
      trip.id
    );
    pushNotification({
      title: "Tatkal plan activated",
      body: `${plan.intent.from} → ${plan.intent.to}. Your Copilot is watching the clock until Tatkal opens.`,
    });

    router.push(`/app/trips/${trip.id}`);
  }

  function onActivate() {
    if (isAuthed) activate();
    else setAuthOpen(true);
  }

  return (
    <StepShell wide>
      {/* Hero readiness banner */}
      <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-line bg-brand-ink px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-headline text-white">Prepare for tomorrow</h1>
          <p className="mt-1.5 max-w-md text-[0.95rem] text-white/75">
            Everything gets staged now, so nothing is left to chance when the Tatkal window opens.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 rounded-[var(--radius)] bg-white/10 px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15">
            <ShieldCheck className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="text-[0.9rem] font-semibold">{readyCount} of {checklist.length} ready</div>
            <div className="text-xs text-white/70">10:00 AM Tatkal window · tomorrow</div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        {/* Checklist */}
        <Card className="p-6 lg:col-span-7">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-brand">
            Readiness checklist
          </h3>
          <ul className="mt-3 space-y-2.5">
            {checklist.map((c, i) => (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i }}
                className={cn(
                  "flex items-start gap-3 rounded-[var(--radius)] border px-3.5 py-3",
                  c.action ? "border-caution/30 bg-caution-soft/40" : "border-line bg-surface-muted/40"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full",
                    c.ready ? "bg-confirm-soft text-confirm" : "bg-caution-soft text-caution"
                  )}
                >
                  {c.ready ? <Check className="h-4 w-4" strokeWidth={3} /> : <AlertTriangle className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[0.9rem] font-semibold text-ink">
                    {c.icon}
                    {c.label}
                    {c.action && (
                      <span className="rounded-full bg-caution-soft px-2 py-0.5 text-[0.65rem] font-semibold text-caution">
                        Action needed
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[0.83rem] text-ink-soft">{c.detail}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </Card>

        {/* Delegation choice + guarantee */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Card className="p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-brand">
              Your booking strategy
            </h3>
            <p className="mt-1 text-[0.85rem] text-ink-soft">
              Choose how tomorrow at 10:00 AM should play out.
            </p>
            <div className="mt-4 space-y-2.5" role="radiogroup" aria-label="Booking mode">
              <ModeCard
                active={mode === "assisted"}
                onClick={() => setMode("assisted")}
                icon={<Bell className="h-5 w-5" />}
                title="🤝 Assisted"
                badgeLabel="Keep me in control"
                body="Prepare everything, watch the clock, and make sure I'm there when Tatkal opens. I'll make the final booking decision."
              />
              <ModeCard
                active={mode === "auto"}
                onClick={() => setMode("auto")}
                icon={<Zap className="h-5 w-5" />}
                title="⚡ Permissioned"
                badgeLabel="Let Copilot act"
                body="Prepare everything and execute my booking strategy when Tatkal opens, including switching to my backup if needed."
                demo
              />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 text-brand">
              <ShieldCheck className="h-5 w-5" />
              <h3 className="text-sm font-semibold uppercase tracking-wide">Copilot's guarantee</h3>
            </div>
            <ul className="mt-3 space-y-2">
              {[
                "Never deducts money or enters a bank OTP without your approval",
                "Every payment happens under your direct confirmation on your device",
                "No standing auto-debit authority — nothing is ever open-ended",
              ].map((g) => (
                <li key={g} className="flex items-start gap-2 text-[0.85rem] text-ink">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-confirm" strokeWidth={3} />
                  {g}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Notification channel preferences */}
      <Card className="mt-5 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand">
            <Mail className="h-5 w-5" />
            <h3 className="text-sm font-semibold uppercase tracking-wide">How should Copilot reach you?</h3>
          </div>
          <span className="rounded-full bg-confirm-soft px-2.5 py-0.5 text-xs font-semibold text-confirm">
            Email + in-app recommended
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          We&apos;ll email you if you&apos;re away when Tatkal needs your attention.
        </p>

        {prefEmail && (
          <div className="mt-3">
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <Mail className="h-3.5 w-3.5 text-brand" /> Notification email address
            </label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-medium text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        )}
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface p-3">
            <span className="text-sm font-medium text-ink">In-app notification</span>
            <input
              type="checkbox"
              checked={prefInApp}
              onChange={(e) => setPrefInApp(e.target.checked)}
              className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface p-3">
            <span className="text-sm font-medium text-ink">Email escalation</span>
            <input
              type="checkbox"
              checked={prefEmail}
              onChange={(e) => setPrefEmail(e.target.checked)}
              className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface p-3">
            <span className="text-sm font-medium text-ink">WhatsApp <DemoBadge /></span>
            <input
              type="checkbox"
              checked={prefWhatsapp}
              onChange={(e) => setPrefWhatsapp(e.target.checked)}
              className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
            />
          </label>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface-muted px-3.5 py-2.5">
          <button
            type="button"
            role="switch"
            aria-checked={saveJ}
            onClick={() => setSaveJ((v) => !v)}
            className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", saveJ ? "bg-brand" : "bg-line-strong")}
          >
            <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", saveJ ? "left-[22px]" : "left-0.5")} />
          </button>
          <span className="flex items-center gap-1.5 text-sm text-ink">
            <Bookmark className="h-4 w-4 text-brand" /> Save this journey for next time
          </span>
        </label>
      </Card>

      <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-line bg-surface-muted px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <p className="text-[0.82rem] leading-relaxed text-ink-soft">
          Booking here is fully simulated <DemoBadge /> — payments, OTP and PNR are mocked.
          Real booking would run through an authorized railway integration.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between rounded-[var(--radius-lg)] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-card)]">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-faint">Estimated total</div>
          <div className="tabular text-xl font-semibold text-ink">{formatFare(total)}</div>
        </div>
        <Button size="lg" onClick={onActivate} className="group">
          <ShieldCheck className="h-5 w-5" />
          Activate Tatkal plan
        </Button>
      </div>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={() => activate()}
        title="Save this journey"
        reason="Sign in so Copilot can remember your plan and keep watching the clock until Tatkal opens."
      />
    </StepShell>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  body,
  badgeLabel,
  demo,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
  badgeLabel?: string;
  demo?: boolean;
}) {
  return (
    <button onClick={onClick} className="block w-full text-left" role="radio" aria-checked={active}>
      <Card
        className={cn(
          "border-2 p-4 transition-colors",
          active ? "border-brand shadow-[var(--shadow-card)]" : "border-line hover:border-line-strong"
        )}
      >
        <div className="flex items-center justify-between">
          <span className={cn("grid h-9 w-9 place-items-center rounded-lg", active ? "bg-brand text-white" : "bg-brand-soft text-brand")}>
            {icon}
          </span>
          <div className="flex items-center gap-1.5">
            {demo && <DemoBadge />}
            {badgeLabel && (
              <span className="rounded-full bg-confirm-soft px-2 py-0.5 text-[0.66rem] font-semibold text-confirm">
                {badgeLabel}
              </span>
            )}
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="font-semibold text-ink">{title}</span>
          {active && <Check className="h-4 w-4 text-brand" strokeWidth={3} />}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{body}</p>
      </Card>
    </button>
  );
}
