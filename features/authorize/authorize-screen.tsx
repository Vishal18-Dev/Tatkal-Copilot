"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Check,
  Users,
  TrainFront,
  Ticket,
  Split,
  CreditCard,
  Bell,
  Zap,
  Info,
  Bookmark,
  Eye,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StepShell, Eyebrow } from "@/components/step-shell";
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
  const [userEmail, setUserEmail] = useState(user?.email || "vishal@example.com");
  const [authOpen, setAuthOpen] = useState(false);
  const router = useRouter();

  if (!plan || !chosenOption) return null;
  const total = chosenOption.fare * Math.max(1, selectedPassengers.length);

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

  const scope = [
    { icon: <Eye className="h-4 w-4" />, text: "Watch the journey and Tatkal countdown" },
    { icon: <Users className="h-4 w-4" />, text: `Prepare ${selectedPassengers.length} traveller${selectedPassengers.length > 1 ? "s" : ""}` },
    { icon: <TrainFront className="h-4 w-4" />, text: `Hold ${chosenOption.title} as the primary strategy` },
    ...(recoveryOption ? [{ icon: <Split className="h-4 w-4" />, text: `Keep ${recoveryOption.title} ready as backup` }] : []),
    { icon: <Bell className="h-4 w-4" />, text: "Notify you before and when the window opens" },
    { icon: <Ticket className="h-4 w-4" />, text: "Route you into booking — you make the final call" },
  ];

  return (
    <StepShell>
      <Eyebrow>Step 6 · Activate your agent</Eyebrow>
      <h2 className="text-headline">Hand this to your Copilot</h2>
      <p className="mt-3 text-lg text-ink-soft">
        You stay in control. Choose how your agent should act, then activate the plan.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
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

      {/* Notification Channel Preferences */}
      <Card className="mt-4 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand">
            <Bell className="h-5 w-5" />
            <h3 className="text-sm font-semibold uppercase tracking-wide">How should Copilot reach you?</h3>
          </div>
          <span className="rounded-full bg-confirm-soft px-2.5 py-0.5 text-xs font-semibold text-confirm">
            Email + In-app Recommended
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          We&apos;ll email you if you&apos;re away when Tatkal needs your attention.
        </p>

        {prefEmail && (
          <div className="mt-3">
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <Mail className="h-3.5 w-3.5 text-brand" /> Notification Email Address
            </label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="e.g. vishal@example.com"
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-medium text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <p className="mt-1 text-[0.78rem] text-ink-faint">
              Real email alerts sent via Resend REST API or demo payload generated
            </p>
          </div>
        )}
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface p-3">
            <span className="text-sm font-medium text-ink">In-app Notification</span>
            <input
              type="checkbox"
              checked={prefInApp}
              onChange={(e) => setPrefInApp(e.target.checked)}
              className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface p-3">
            <span className="text-sm font-medium text-ink">Email Escalation</span>
            <input
              type="checkbox"
              checked={prefEmail}
              onChange={(e) => setPrefEmail(e.target.checked)}
              className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface p-3">
            <span className="text-sm font-medium text-ink">WhatsApp (Demo)</span>
            <input
              type="checkbox"
              checked={prefWhatsapp}
              onChange={(e) => setPrefWhatsapp(e.target.checked)}
              className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
            />
          </label>
        </div>
      </Card>

      <Card className="mt-4 p-6">
        <div className="flex items-center gap-2 text-brand">
          <ShieldCheck className="h-5 w-5" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">
            Your agent will
          </h3>
        </div>
        <ul className="mt-3 space-y-2">
          {scope.map((s, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + i * 0.05 }}
              className="flex items-center gap-2.5 text-[0.98rem] text-ink"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-confirm-soft text-confirm">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <span className="text-ink-faint">{s.icon}</span>
              {s.text}
            </motion.li>
          ))}
        </ul>
        <div className="mt-3 rounded-xl bg-surface-muted px-3.5 py-2.5 text-[0.85rem] text-ink-soft">
          It will never enter an OTP, make a real payment, or claim a booking happened
          without you.
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
    <button onClick={onClick} className="text-left">
      <Card
        className={cn(
          "h-full border-2 p-5 transition-colors",
          active ? "border-brand shadow-[var(--shadow-card)]" : "border-line hover:border-line-strong"
        )}
      >
        <div className="flex items-center justify-between">
          <span className={cn("grid h-9 w-9 place-items-center rounded-lg", active ? "bg-brand text-white" : "bg-brand-soft text-brand")}>
            {icon}
          </span>
          {demo && <DemoBadge />}
          {badgeLabel && (
            <span className="rounded-full bg-confirm-soft px-2 py-0.5 text-[0.66rem] font-semibold text-confirm">
              {badgeLabel}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="font-semibold text-ink">{title}</span>
          {active && <Check className="h-4 w-4 text-brand" strokeWidth={3} />}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{body}</p>
      </Card>
    </button>
  );
}
