"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Brain,
  ListChecks,
  ClipboardCheck,
  Ticket,
  Train,
  ChevronRight,
  Users,
  Radio,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageToggle } from "@/components/brand/language-toggle";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";

const STEPS = [
  { icon: Brain, key: "map.understand" },
  { icon: ListChecks, key: "map.recommend" },
  { icon: ClipboardCheck, key: "map.prepare" },
  { icon: Ticket, key: "map.book" },
  { icon: Train, key: "map.travel" },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "An AI strategy, not a train list",
    body: "Copilot separates your hard constraints from soft preferences, compares every train, and gives you one clear recommendation with two backups — each with honest confidence, never fake percentages.",
  },
  {
    icon: Users,
    title: "A Traveller Vault that remembers",
    body: "Save your regular travellers once. When Tatkal opens, add anyone to a booking in a single tap instead of typing names and IDs under pressure.",
  },
  {
    icon: Radio,
    title: "Mission Control for the window",
    body: "A countdown, a readiness checklist and a calm AI coach — so the moment Tatkal opens, everything is already prepared and you're not guessing.",
  },
];

export function Landing() {
  const { t } = useLang();
  const router = useRouter();
  const [goal, setGoal] = useState("");

  const plan = (g?: string) => {
    const q = (g ?? goal).trim();
    router.push(q ? `/app/plan?goal=${encodeURIComponent(q)}` : "/app/plan");
  };

  return (
    <div>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo />
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link href="/app" className="hidden sm:block">
              <Button variant="secondary" size="sm">Open app</Button>
            </Link>
            <Link href="/app/plan">
              <Button size="sm">Plan a trip</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-brand/10 blur-[120px]" />
        <div className="relative mx-auto max-w-3xl px-5 pt-16 pb-16 text-center sm:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/80 px-4 py-1.5 text-sm font-medium text-ink-soft backdrop-blur"
          >
            <Sparkles className="h-4 w-4 text-brand" />
            {t("hero.eyebrow")}
          </motion.div>
          <h1 className="text-display">
            <span className="block">{t("hero.title1")}</span>
            <span className="block bg-gradient-to-r from-brand to-[#7c74f5] bg-clip-text text-transparent">
              {t("hero.title2")}
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
            {t("hero.subtitle")}
          </p>
          <p className="mt-2 text-[0.95rem] font-medium text-brand">
            Plan once. Your Copilot watches the clock.
          </p>

          <div className="mx-auto mt-8 max-w-xl rounded-[var(--radius-lg)] border border-line-strong bg-surface p-3 text-left shadow-[var(--shadow-card)] focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
            <div className="flex items-center gap-2">
              <Sparkles className="ml-2 h-5 w-5 shrink-0 text-brand" />
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && plan()}
                placeholder={t("goal.placeholder")}
                className="w-full bg-transparent px-1 py-2.5 text-[1.05rem] text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <button
                onClick={() => plan()}
                aria-label="Plan"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white shadow-[var(--shadow-brand)] hover:bg-[#4338ca]"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {[t("goal.example1"), t("goal.example2"), t("goal.example3")].map((ex) => (
              <button
                key={ex}
                onClick={() => plan(ex)}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-brand/40 hover:text-ink"
              >
                {ex}
              </button>
            ))}
          </div>
          <p className="mt-5 inline-flex items-center gap-1.5 text-sm text-ink-faint">
            <ShieldCheck className="h-4 w-4 text-confirm" />
            {t("hero.trust")}
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-surface/50 py-12">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            {t("hero.journeyTitle")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-3">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center">
                <div className="flex flex-col items-center gap-2">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-surface text-brand shadow-[var(--shadow-card)]">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <span className="w-16 text-[0.72rem] font-medium leading-tight text-ink-soft">
                    {t(s.key)}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="mx-0.5 mb-6 h-4 w-4 shrink-0 text-line-strong" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Trust & security */}
      <section className="border-y border-line bg-surface/50 py-14">
        <div className="mx-auto grid max-w-4xl gap-4 px-5 sm:grid-cols-3">
          {[
            { icon: Lock, title: "Never books without you", body: "Copilot prepares and advises. You always authorize. It never automates a real railway system." },
            { icon: ShieldCheck, title: "Your data stays local", body: "Travellers, trips and preferences are stored only on your device in this prototype." },
            { icon: CheckCircle2, title: "Honest about the demo", body: "Train data, availability, payments, OTP and PNRs are simulated — and clearly labelled." },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl border border-line bg-surface p-5">
              <c.icon className="h-5 w-5 text-brand" />
              <h4 className="mt-3 font-semibold text-ink">{c.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h2 className="text-headline">Stop guessing. Start winning Tatkal.</h2>
        <p className="mx-auto mt-3 max-w-lg text-lg text-ink-soft">
          Tell Copilot where you need to be. Get a strategy in seconds — no login required to start.
        </p>
        <Button size="xl" className="group mt-8" onClick={() => plan()}>
          Plan a trip
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Button>
      </section>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-sm text-ink-faint sm:flex-row">
          <Logo />
          <span>Prototype · Simulated booking · Not affiliated with IRCTC or Indian Railways.</span>
        </div>
      </footer>
    </div>
  );
}
