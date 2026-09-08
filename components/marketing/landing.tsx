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
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { AuthModal } from "@/components/auth/auth-modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/app/ui";
import { CopilotWorkspace } from "@/components/copilot/CopilotWorkspace";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";

/* ============================================================
   Marketing landing — Figma "Railway Booking Made Peaceful".
   Fully localized via useLang().
   ============================================================ */

export function Landing() {
  const { t } = useLang();
  const { isAuthed, loginDemo } = useStore();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);

  const go = () => {
    if (!isAuthed) {
      loginDemo();
    }
    router.push("/app");
  };

  const timelineSteps = [
    {
      icon: Sparkles,
      time: t("landing.timeline.step1.time"),
      title: t("landing.timeline.step1.title"),
      body: t("landing.timeline.step1.body"),
      note: t("landing.timeline.step1.note"),
    },
    {
      icon: Bell,
      time: t("landing.timeline.step2.time"),
      title: t("landing.timeline.step2.title"),
      body: t("landing.timeline.step2.body"),
      note: t("landing.timeline.step2.note"),
    },
    {
      icon: TrainFront,
      time: t("landing.timeline.step3.time"),
      title: t("landing.timeline.step3.title"),
      body: t("landing.timeline.step3.body"),
      note: t("landing.timeline.step3.note"),
    },
    {
      icon: Smartphone,
      time: t("landing.timeline.step4.time"),
      title: t("landing.timeline.step4.title"),
      body: t("landing.timeline.step4.body"),
      note: t("landing.timeline.step4.note"),
    },
  ];

  const oldWayItems = [
    t("landing.compare.old1"),
    t("landing.compare.old2"),
    t("landing.compare.old3"),
    t("landing.compare.old4"),
  ];

  const newWayItems = [
    t("landing.compare.new1"),
    t("landing.compare.new2"),
    t("landing.compare.new3"),
    t("landing.compare.new4"),
  ];

  const trustCards = [
    {
      icon: Lock,
      title: t("landing.trust.c1.title"),
      body: t("landing.trust.c1.body"),
      tag: t("landing.trust.c1.tag"),
    },
    {
      icon: GitBranch,
      title: t("landing.trust.c2.title"),
      body: t("landing.trust.c2.body"),
      tag: t("landing.trust.c2.tag"),
    },
    {
      icon: Wallet,
      title: t("landing.trust.c3.title"),
      body: t("landing.trust.c3.body"),
      tag: t("landing.trust.c3.tag"),
    },
  ];

  const voiceQuotes = [
    {
      quote: t("landing.voices.v1.quote"),
      who: t("landing.voices.v1.who"),
    },
    {
      quote: t("landing.voices.v2.quote"),
      who: t("landing.voices.v2.who"),
    },
  ];

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
              {t("landing.nav.howItWorks")}
            </a>
            <a href="#compare" className="rounded-[var(--radius)] px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink">
              {t("landing.nav.whyItWorks")}
            </a>
            <a href="#trust" className="rounded-[var(--radius)] px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink">
              {t("landing.nav.yourControl")}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <Button
              size="sm"
              variant={isAuthed ? "secondary" : "primary"}
              onClick={go}
            >
              {isAuthed ? t("landing.nav.commandCenter") : t("landing.nav.planTrip")}
            </Button>
          </div>
        </div>
      </header>

      {/* ---------- Hero Section (Unified Copilot Workspace) ---------- */}
      <section className="relative overflow-hidden border-b border-line bg-surface/30 pt-8 pb-12">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-brand/10 blur-[120px]" />
        <div className="relative mx-auto max-w-5xl px-5">
          <CopilotWorkspace
            onPrepareTatkal={(plan) => {
              router.push(`/app/plan?goal=${encodeURIComponent(`from ${plan.intent.from} to ${plan.intent.to}`)}`);
            }}
          />
        </div>
      </section>

      {/* ---------- Timeline / how it works ---------- */}
      <section id="timeline" className="border-y border-line bg-surface/50 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <SectionEyebrow>{t("landing.timeline.eyebrow")}</SectionEyebrow>
          <h2 className="text-headline text-brand-ink">
            {t("landing.timeline.title")}
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-ink-soft">
            {t("landing.timeline.desc")}
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {timelineSteps.map((s, i) => (
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
          <SectionEyebrow>{t("landing.compare.eyebrow")}</SectionEyebrow>
          <h2 className="text-headline text-brand-ink">
            {t("landing.compare.title")}
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-ink-soft">
            {t("landing.compare.desc")}
          </p>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <Card className="border-danger/25 p-6">
              <div className="flex items-center gap-2 text-danger">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-danger-soft">
                  <X className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <h3 className="text-lg font-semibold">{t("landing.compare.oldTitle")}</h3>
              </div>
              <ul className="mt-5 space-y-3">
                {oldWayItems.map((x, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-[0.95rem] text-ink-soft">
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
                  {t("landing.compare.newTitle")}
                </h3>
              </div>
              <ul className="mt-5 space-y-3">
                {newWayItems.map((x, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-[0.95rem] text-ink">
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
          <SectionEyebrow>{t("landing.trust.eyebrow")}</SectionEyebrow>
          <h2 className="text-headline text-brand-ink">{t("landing.trust.title")}</h2>
          <p className="mt-3 max-w-2xl text-lg text-ink-soft">
            {t("landing.trust.desc")}
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {trustCards.map((c) => (
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
              {t("landing.voices.title")}
            </h2>
            <span className="rounded-full border border-caution/40 bg-caution-soft px-2.5 py-0.5 text-[0.66rem] font-bold uppercase tracking-wide text-caution">
              {t("landing.voices.badge")}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {voiceQuotes.map((v, idx) => (
              <Card key={idx} className="p-6">
                <p className="text-[1.02rem] leading-relaxed text-ink">
                  &ldquo;{v.quote}&rdquo;
                </p>
                <div className="mt-4 text-sm text-ink-faint">{v.who}</div>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-faint">
            {t("landing.voices.disclaimer")}
          </p>
        </div>
      </section>

      {/* ---------- CTA band ---------- */}
      <section className="px-5 pb-20">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[var(--radius-xl)] bg-brand px-6 py-14 text-center text-white">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-10" />
          <div className="relative">
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white/60">
              {t("landing.cta.badge")}
            </span>
            <h2 className="mt-3 text-headline text-white">
              {t("landing.cta.title")}
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-lg text-white/75">
              {t("landing.cta.desc")}
            </p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <button
                onClick={go}
                className="group inline-flex h-14 items-center gap-2 rounded-[var(--radius)] bg-white px-8 text-base font-semibold text-brand-ink transition-transform hover:-translate-y-0.5"
              >
                {t("landing.cta.button")}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
              <span className="inline-flex items-center gap-1.5 text-sm text-white/60">
                <DemoBadge className="border-white/30 bg-white/10 text-white" /> {t("landing.cta.simulated")}
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
            {t("landing.footer.disclaimer")}
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
