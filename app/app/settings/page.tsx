"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  User as UserIcon,
  Route,
  Ticket,
  Bell,
  Shield,
  Lock,
  Info,
  LogOut,
  Play,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, DemoBadge } from "@/components/app/ui";
import { AuthModal } from "@/components/auth/auth-modal";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { stations } from "@/lib/data";
import { cn } from "@/lib/utils";
import type { ConfirmationPriority, TravelClass } from "@/types";

export default function SettingsPage() {
  const { isAuthed, user, preferences, updatePreferences, updateProfile, logout, seedDemoPlan } = useStore();
  const { t } = useLang();
  const [authOpen, setAuthOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("set.title")} subtitle={t("set.subtitle")} />

      <Section icon={<UserIcon className="h-4 w-4" />} title={t("set.account")}>
        {isAuthed ? (
          <>
            <TextRow label={t("set.name")} value={user?.name ?? ""} placeholder={t("set.namePh")} onSave={(name) => updateProfile({ name })} />
            <Row label={t("set.phone")}>
              <span className="text-sm text-ink-soft">+91 {user?.phone}</span>
            </Row>
            <TextRow label={t("set.email")} value={user?.email ?? ""} placeholder={t("set.emailPh")} onSave={(email) => updateProfile({ email })} />
          </>
        ) : (
          <Row label={t("set.notSignedIn")}>
            <Button size="sm" onClick={() => setAuthOpen(true)}>{t("shell.signin")}</Button>
          </Row>
        )}
      </Section>

      <Section icon={<Route className="h-4 w-4" />} title={t("set.travelPrefs")}>
        <Row label={t("set.homeStation")}>
          <select
            value={preferences.homeStationCode ?? ""}
            onChange={(e) => updatePreferences({ homeStationCode: e.target.value || undefined })}
            className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
          >
            <option value="">{t("set.notSet")}</option>
            {stations.map((s) => (
              <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
            ))}
          </select>
        </Row>
        <Row label={t("set.preferredClass")}>
          <select
            value={preferences.preferredClass ?? "any"}
            onChange={(e) => updatePreferences({ preferredClass: e.target.value as TravelClass | "any" })}
            className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
          >
            {["any", "1A", "2A", "3A", "SL"].map((c) => (
              <option key={c} value={c}>{c === "any" ? t("set.noPref") : c}</option>
            ))}
          </select>
        </Row>
        <Row label={t("set.confPriority")} hint={t("set.confPriorityHint")}>
          <Segmented<ConfirmationPriority>
            options={[
              { v: "confirmation", l: t("set.pConfirmation") },
              { v: "balanced", l: t("set.pBalanced") },
              { v: "price", l: t("set.pPrice") },
            ]}
            value={preferences.confirmationPriority}
            onChange={(v) => updatePreferences({ confirmationPriority: v })}
          />
        </Row>
      </Section>

      <Section icon={<Ticket className="h-4 w-4" />} title={t("set.booking")}>
        <Row label={t("set.defaultMode")} hint={t("set.defaultModeHint")}>
          <Segmented
            options={[
              { v: "assisted", l: t("set.assisted") },
              { v: "auto", l: t("set.autoBook") },
            ]}
            value={preferences.defaultMode}
            onChange={(v) => updatePreferences({ defaultMode: v })}
          />
        </Row>
        <Row label={t("set.provider")}>
          <span className="inline-flex items-center gap-2 text-sm text-ink-soft">
            {t("set.simulated")} <DemoBadge />
          </span>
        </Row>
      </Section>

      <Section icon={<Bell className="h-4 w-4" />} title={t("set.notifications")}>
        {(
          [
            ["tatkalReminders", t("set.tatkalReminders")],
            ["bookingUpdates", t("set.bookingUpdates")],
            ["tripReminders", t("set.tripReminders")],
          ] as const
        ).map(([key, label]) => (
          <Row key={key} label={label}>
            <Toggle
              on={preferences.notifications[key]}
              onChange={(on) => updatePreferences({ notifications: { ...preferences.notifications, [key]: on } })}
            />
          </Row>
        ))}
      </Section>

      <Section icon={<Shield className="h-4 w-4" />} title={t("set.security")}>
        {isAuthed ? (
          <>
            <Row label={t("set.thisDevice")} hint={t("set.signedInSession")}>
              <span className="text-sm text-confirm">{t("set.active")}</span>
            </Row>
            <Row label={t("set.signout")}>
              <Button size="sm" variant="secondary" onClick={logout}>
                <LogOut className="h-4 w-4" /> {t("set.signout")}
              </Button>
            </Row>
          </>
        ) : (
          <Row label={t("set.manageSessions")}>
            <Button size="sm" onClick={() => setAuthOpen(true)}>{t("shell.signin")}</Button>
          </Row>
        )}
      </Section>

      <Section icon={<Lock className="h-4 w-4" />} title={t("set.privacy")}>
        <Row label={t("set.yourData")} hint={t("set.storedOnDevice")}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (confirm(t("set.clearConfirm"))) {
                try {
                  Object.keys(localStorage).filter((k) => k.startsWith("tatkal.")).forEach((k) => localStorage.removeItem(k));
                } catch {}
                router.refresh();
                location.reload();
              }
            }}
          >
            {t("set.clearData")}
          </Button>
        </Row>
      </Section>

      <Section icon={<Play className="h-4 w-4" />} title={t("set.demo")}>
        <Row label={t("set.loadScenario")} hint={t("set.loadScenarioHint")}>
          <Button
            size="sm"
            onClick={() => {
              const plan = seedDemoPlan();
              router.push(`/app/trips/${plan.id}`);
            }}
          >
            {t("set.loadOpen")}
          </Button>
        </Row>
      </Section>

      <Section icon={<Info className="h-4 w-4" />} title={t("set.about")}>
        <Row label={t("set.version")}><span className="text-sm text-ink-soft">{t("set.versionVal")}</span></Row>
        <Row label={t("set.bookingAccess")}>
          <span className="inline-flex items-center gap-2 text-sm text-ink-soft">
            {t("set.demoOnly")} <DemoBadge />
          </span>
        </Row>
        <p className="px-1 pt-2 text-xs leading-relaxed text-ink-faint">{t("set.aboutBlurb")}</p>
      </Section>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {icon}
        {title}
      </div>
      <Card className="divide-y divide-line p-0">{children}</Card>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[0.95rem] font-medium text-ink">{label}</div>
        {hint && <div className="text-xs text-ink-faint">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function TextRow({ label, value, placeholder, onSave }: { label: string; value: string; placeholder: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <Row label={label}>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onSave(v.trim())}
        placeholder={placeholder}
        className="w-44 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-right text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
      />
    </Row>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-brand" : "bg-line-strong")}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

function Segmented<T extends string>({ options, value, onChange }: { options: { v: T; l: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-lg border border-line-strong p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", value === o.v ? "bg-brand text-white" : "text-ink-soft hover:text-ink")}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
