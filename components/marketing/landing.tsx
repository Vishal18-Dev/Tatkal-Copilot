"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Clock,
  GitBranch,
  Lock,
  TrainFront,
  Check,
  X,
  Bell,
  Smartphone,
  Users,
  Play,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageToggle } from "@/components/brand/language-toggle";
import { AuthModal } from "@/components/auth/auth-modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/app/ui";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";

/* ============================================================
   Marketing landing — Figma "Railway Booking Made Peaceful".
   Visual design follows the Figma; copy is rewritten to stay
   honest and DEMO-safe (no implied live IRCTC/CRIS/Aadhaar,
   no fabricated PNRs/stats/reviews, no false compliance).
   ============================================================ */

export function Landing() {
  const { t } = useLang();
  const { isAuthed } = useStore();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);

  const go = () => router.push("/app/plan");

  return (
    <div className="min-h-full">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo showWord={false} />
            <span className="flex flex-col leading-tight">
              <span className="text-[0.95rem] font-semibold tracking-tight text-ink">
                {t("brand")}
              </span>
              <span className="hidden text-[0.72rem] text-ink-faint sm:block">
                {t("brand.tagline")}
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <a href="#timeline" className="rounded-[var(--radius)] px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink">
              How it works
            </a>
            <a href="#compare" className="rounded-[var(--radius)] px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink">
              Why it works
            </a>
            <a href="#trust" className="rounded-[var(--radius)] px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink">
              Your control
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button
              size="sm"
              variant={isAuthed ? "secondary" : "primary"}
              onClick={() => (isAuthed ? router.push("/app") : go())}
            >
              {isAuthed ? "Command Center" : "Plan a journey"}
            </Button>
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-brand/10 blur-[120px]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-14 lg:grid-cols-2 lg:pb-24 lg:pt-20">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/80 px-3.5 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink-soft backdrop-blur"
            >
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              Dignified railway booking for India
            </motion.div>
            <h1 className="text-display text-brand-ink">
              Tatkal booking without the{" "}
              <span className="text-brand">morning panic.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              We prepare your travellers and strategy the evening before, watch the
              clock, and walk you into booking the moment Tatkal opens. No frantic
              refreshing, no captcha scramble — and you always make the final call.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={go} className="group">
                Plan your journey
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <a
                href="#timeline"
                className="inline-flex items-center gap-2 rounded-[var(--radius)] px-4 py-3 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full border border-line-strong bg-surface">
                  <Play className="h-3.5 w-3.5 text-brand" />
                </span>
                See how it works
              </a>
            </div>
            <p className="mt-6 inline-flex items-center gap-1.5 text-sm text-ink-faint">
              <ShieldCheck className="h-4 w-4 text-confirm" />
              {t("hero.trust")}
            </p>
          </div>

          {/* Dispatcher preview card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card lift className="overflow-hidden p-0">
              <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-muted/60 px-5 py-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                  <TrainFront className="h-4 w-4 text-brand" /> Your Tatkal plan
                </span>
                <DemoBadge />
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <Endpoint code="MMCT" city="Mumbai Central" tone="brand" />
                  <div className="flex flex-1 flex-col items-center px-2">
                    <span className="text-[0.7rem] font-medium text-ink-faint">
                      1,384 km
                    </span>
                    <div className="relative my-1 h-3 w-full">
                      <div className="rail-sleepers absolute inset-0 top-1/2 h-2 -translate-y-1/2 opacity-70" />
                      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-strong" />
                      <div className="rail-glide absolute left-0 top-1/2 -translate-y-1/2">
                        <span className="grid h-4 w-6 place-items-center rounded-sm bg-brand text-white">
                          <TrainFront className="h-2.5 w-2.5" />
                        </span>
                      </div>
                    </div>
                    <span className="text-[0.7rem] text-confirm">Direct corridor</span>
                  </div>
                  <Endpoint code="NDLS" city="New Delhi" tone="caution" align="right" />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <MiniField icon={<Clock className="h-4 w-4" />} label="Journey date" value="Tomorrow" sub="Tatkal opens 10:00 AM" />
                  <MiniField icon={<TrainFront className="h-4 w-4" />} label="Class" value="AC 3 Tier (3A)" sub="Backup · Split via Kota" />
                </div>
                <div className="flex items-center gap-2 rounded-[var(--radius)] bg-confirm-soft px-3 py-2 text-sm text-confirm">
                  <Users className="h-4 w-4" /> 2 travellers ready
                </div>
                <Button size="md" onClick={go} className="group w-full">
                  Plan your journey
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ---------- Timeline / how it works ---------- */}
      <section id="timeline" className="border-y border-line bg-surface/50 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <SectionEyebrow>The plan, step by step</SectionEyebrow>
          <h2 className="text-headline text-brand-ink">
            The Tatkal timeline, prepared in advance.
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-ink-soft">
            While the rush fights sluggish servers, your plan is already in place —
            step by step, all clearly simulated in this prototype.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TIMELINE.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.06 }}
              >
                <Card className="flex h-full flex-col p-5">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-[var(--radius)] bg-brand-soft text-brand">
                      <s.icon className="h-5 w-5" />
                    </span>
                    <span className="tabular font-mono text-xs font-semibold text-caution">
                      {s.time}
                    </span>
                  </div>
                  <h3 className="mt-4 text-[1.05rem] font-semibold text-ink">
                    {s.title}
                  </h3>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-soft">
                    {s.body}
                  </p>
                  <div className="mt-3 rounded-[var(--radius)] bg-surface-muted px-3 py-2 text-xs font-medium text-ink-soft">
                    {s.note}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Old way vs Copilot way ---------- */}
      <section id="compare" className="py-16">
        <div className="mx-auto max-w-6xl px-5">
          <SectionEyebrow>The reality check</SectionEyebrow>
          <h2 className="text-headline text-brand-ink">
            The old way vs. the Copilot way.
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-ink-soft">
            Two very different mornings, at the same 10:00 AM.
          </p>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <Card className="border-danger/25 p-6">
              <div className="flex items-center gap-2 text-danger">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-danger-soft">
                  <X className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <h3 className="text-lg font-semibold">The 09:59 AM scramble</h3>
              </div>
              <ul className="mt-5 space-y-3">
                {OLD_WAY.map((x) => (
                  <li key={x} className="flex items-start gap-2.5 text-[0.95rem] text-ink-soft">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                    {x}
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="border-confirm/30 bg-confirm-soft/20 p-6">
              <div className="flex items-center gap-2 text-confirm">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-confirm-soft">
                  <Check className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <h3 className="text-lg font-semibold text-brand-ink">
                  The peaceful morning
                </h3>
              </div>
              <ul className="mt-5 space-y-3">
                {NEW_WAY.map((x) => (
                  <li key={x} className="flex items-start gap-2.5 text-[0.95rem] text-ink">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-confirm" strokeWidth={2.6} />
                    {x}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* ---------- Trust ---------- */}
      <section id="trust" className="border-y border-line bg-surface/50 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <SectionEyebrow>You stay in control</SectionEyebrow>
          <h2 className="text-headline text-brand-ink">Built around your trust.</h2>
          <p className="mt-3 max-w-2xl text-lg text-ink-soft">
            One principle: your money and identity stay entirely in your hands.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {TRUST.map((c) => (
              <Card key={c.title} className="p-6">
                <span className="grid h-11 w-11 place-items-center rounded-[var(--radius)] bg-brand-soft text-brand">
                  <c.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-ink">{c.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">
                  {c.body}
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-confirm-soft px-2.5 py-1 text-xs font-semibold text-confirm">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} /> {c.tag}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Illustrative voices ---------- */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <h2 className="text-headline text-brand-ink">
              Calm mornings, the way it should feel.
            </h2>
            <span className="rounded-full border border-caution/40 bg-caution-soft px-2.5 py-0.5 text-[0.66rem] font-bold uppercase tracking-wide text-caution">
              Illustrative
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {VOICES.map((v) => (
              <Card key={v.who} className="p-6">
                <p className="text-[1.02rem] leading-relaxed text-ink">
                  &ldquo;{v.quote}&rdquo;
                </p>
                <div className="mt-4 text-sm text-ink-faint">{v.who}</div>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-faint">
            Illustrative of the intended experience — not real customer reviews. This
            is a prototype.
          </p>
        </div>
      </section>

      {/* ---------- CTA band ---------- */}
      <section className="px-5 pb-20">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[var(--radius-xl)] bg-brand px-6 py-14 text-center text-white">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-10" />
          <div className="relative">
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white/60">
              No sign-up needed to start
            </span>
            <h2 className="mt-3 text-headline text-white">
              Ready for your next train journey?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-lg text-white/75">
              Set up tomorrow&apos;s Tatkal in under a minute. Sit back with your
              morning tea — your plan is lined up.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <button
                onClick={go}
                className="group inline-flex h-14 items-center gap-2 rounded-[var(--radius)] bg-white px-8 text-base font-semibold text-brand-ink transition-transform hover:-translate-y-0.5"
              >
                Plan your journey
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
              <span className="inline-flex items-center gap-1.5 text-sm text-white/60">
                <DemoBadge className="border-white/30 bg-white/10 text-white" /> Simulated booking — nothing real is charged
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-sm text-ink-faint sm:flex-row">
          <Logo />
          <span>
            Prototype · simulated booking · not affiliated with IRCTC or Indian
            Railways.
          </span>
        </div>
      </footer>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={() => router.push("/app")}
        reason="Sign in to save your journeys, travellers and Copilot preferences."
      />
    </div>
  );
}

/* ---------------- data (honest, demo-safe) ---------------- */

const TIMELINE = [
  {
    icon: Sparkles,
    time: "Evening prior",
    title: "Plan in peace",
    body: "Tell us where you need to go in plain words the evening before. Choose your primary train and an automatic fallback.",
    note: "Backup ready · Split via Kota",
  },
  {
    icon: Bell,
    time: "09:50 AM",
    title: "Get ready early",
    body: "We pre-stage your passenger list and prepare everything. A quiet reminder tells you it's all set.",
    note: "Reminder · you're primed",
  },
  {
    icon: TrainFront,
    time: "10:00 AM",
    title: "The window opens",
    body: "The moment Tatkal opens, your prepared plan is ready to book. If the primary quota vanishes, your backup steps in.",
    note: "Primary → backup, instantly",
  },
  {
    icon: Smartphone,
    time: "One tap",
    title: "You confirm",
    body: "Approve the payment on your own UPI app. Nothing is ever charged without you — and here it's all simulated.",
    note: "Confirmation to your app",
  },
];

const OLD_WAY = [
  "A dozen browser tabs, all throttled at once.",
  "Unreadable captchas that vanish in seconds.",
  "Payment portals that freeze before it's booked.",
  "The waitlist demotion — and a scramble for plan B.",
];

const NEW_WAY = [
  "Passenger details prepared and locked in hours ahead.",
  "No captcha scramble in the crucial seconds.",
  "Automatic fallback to your backup train if the first fills.",
  "One approval on your phone — you always decide.",
];

const TRUST = [
  {
    icon: Lock,
    title: "You always hold the key",
    body: "We never store your card, ask for bank OTPs, or take auto-debit permission. Every payment needs your approval on your own phone.",
    tag: "You approve every payment",
  },
  {
    icon: GitBranch,
    title: "Automatic backup strategy",
    body: "If your preferred train sells out in seconds, Copilot has already lined up your chosen alternative on the same corridor.",
    tag: "Backup prepared in advance",
  },
  {
    icon: Wallet,
    title: "No hidden anything",
    body: "No wallet holds, no confusing vouchers, no surprise fees. In this prototype nothing is charged at all.",
    tag: "Transparent by design",
  },
];

const VOICES = [
  {
    quote:
      "I'd plan the trip the night before and let it watch the clock. No sitting glued to the screen at 10 AM.",
    who: "A weekly commuter",
  },
  {
    quote:
      "As a senior traveller, the 10 AM rush was terrifying. Having the details ready and a backup lined up changed the morning entirely.",
    who: "A senior traveller",
  },
];

/* ---------------- small pieces ---------------- */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
      {children}
    </div>
  );
}

function Endpoint({
  code,
  city,
  tone,
  align = "left",
}: {
  code: string;
  city: string;
  tone: "brand" | "caution";
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className="flex items-center gap-1.5" style={{ flexDirection: align === "right" ? "row-reverse" : "row" }}>
        <span className={`h-2.5 w-2.5 rounded-full ${tone === "brand" ? "bg-brand" : "bg-caution"}`} />
        <span className="tabular font-mono text-sm font-semibold text-brand-ink">
          {code}
        </span>
      </div>
      <div className="mt-0.5 text-xs text-ink-faint">{city}</div>
    </div>
  );
}

function MiniField({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface-muted/60 px-3 py-2.5">
      <div className="text-[0.66rem] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[0.92rem] font-semibold text-ink">
        <span className="text-brand">{icon}</span>
        {value}
      </div>
      <div className="mt-0.5 text-[0.7rem] text-ink-faint">{sub}</div>
    </div>
  );
}
