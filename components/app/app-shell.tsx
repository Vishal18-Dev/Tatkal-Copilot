"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home,
  Sparkles,
  Zap,
  Ticket,
  Users,
  Activity as ActivityIcon,
  Bell,
  User as UserIcon,
  Plus,
  LifeBuoy,
  Settings,
  LogOut,
  ChevronDown,
  Radio,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageToggle } from "@/components/brand/language-toggle";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { AuthModal } from "@/components/auth/auth-modal";
import { VoiceButton } from "@/components/voice/VoiceButton";
import { InteractionModeChooser } from "@/components/onboarding/interaction-mode-chooser";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useOptionalJourney, type Step } from "@/lib/journey";

// Figma V2 shell — a calm horizontal top nav in place of the sidebar.
// Items are the app's real destinations.
const NAV = [
  { href: "/app", label: "nav.home", icon: Home, exact: true },
  { href: "/app/plan", label: "nav.plan", icon: Sparkles },
  { href: "/app/trips", label: "nav.trips", icon: Ticket },
  { href: "/app/book", label: "nav.book", icon: Zap },
];

const PLAN_STAGES: { step: Step; label: string }[] = [
  { step: "plan", label: "Plan" },
  { step: "options", label: "Options" },
  { step: "prepare", label: "Prepare" },
  { step: "book", label: "Book" },
];

// Everything reachable from the account menu.
const MENU = [
  { href: "/app/settings", label: "nav.settings", icon: Settings },
  { href: "/app/travellers", label: "nav.travellers", icon: Users },
  { href: "/app/activity", label: "nav.activity", icon: ActivityIcon },
  { href: "/app/help", label: "nav.help", icon: LifeBuoy },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { notifications, unreadCount, isAuthed, user } = useStore();
  const { t } = useLang();
  const [authOpen, setAuthOpen] = useState(false);
  const journey = useOptionalJourney();
  const isPlanPage = pathname === "/app/plan";

  const currentStep = journey?.step || "plan";
  const normalizedStep =
    currentStep === "compose" || currentStep === "thinking"
      ? "plan"
      : currentStep === "strategy"
      ? "options"
      : currentStep === "vault"
      ? "prepare"
      : currentStep === "review" || currentStep === "authorize"
      ? "book"
      : currentStep;

  return (
    <div className="flex min-h-full flex-col">
      {/* ---------- Top navigation ---------- */}
      <header className="sticky top-0 z-40 border-b border-line/60 glass-dock backdrop-blur-2xl transition-all duration-300">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 lg:px-6">
          {/* Brand lockup */}
          <Link href="/app" className="flex shrink-0 items-center gap-2.5 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]">
            <Logo showWord={false} />
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="flex items-center gap-1.5 text-[0.95rem] font-bold tracking-tight text-ink font-[family-name:var(--font-outfit)]">
                <span>{t("brand")}</span>
                <span className="rounded bg-gradient-to-r from-orange-500 to-amber-500 px-1.5 py-0.2 text-[0.62rem] font-extrabold text-white tracking-wider shadow-xs">
                  PRO
                </span>
              </span>
              <span className="text-[0.72rem] text-ink-faint">
                {t("brand.tagline")}
              </span>
            </span>
          </Link>

          {/* Center nav (desktop) - Consistent across all pages */}
          <nav className="hidden items-center gap-1.5 md:flex rounded-full glass-subtle p-1 border border-line/50">
            {NAV.map((item) => (
              <TopNavLink
                key={item.href}
                href={item.href}
                label={t(item.label)}
                active={isActive(pathname, item.href, item.exact)}
              />
            ))}
          </nav>

          {/* Right controls */}
          <div className="flex shrink-0 items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <VoiceButton />
            <NotificationsButton count={unreadCount} notifications={notifications} />
            <AccountMenu
              isAuthed={isAuthed}
              name={user?.name}
              pathname={pathname}
              onSignIn={() => setAuthOpen(true)}
            />
          </div>
        </div>
      </header>

      {/* ---------- Content ---------- */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 lg:px-6 lg:pb-12">
        {children}
      </main>

      {/* ---------- Mobile bottom nav ---------- */}
      <MobileNav
        pathname={pathname}
        isAuthed={isAuthed}
        user={user}
        onProfile={() => setAuthOpen(true)}
      />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Accessibility entry point — shown once on first entry to the app. */}
      <InteractionModeChooser />
    </div>
  );
}

function TopNavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all duration-200 hover-lift active-press",
        active
          ? "bg-brand text-white shadow-xs dark:bg-brand dark:text-white"
          : "text-ink-soft hover:bg-surface/80 hover:text-ink"
      )}
    >
      {label}
    </Link>
  );
}

function AccountMenu({
  isAuthed,
  name,
  pathname,
  onSignIn,
}: {
  isAuthed: boolean;
  name?: string;
  pathname: string;
  onSignIn: () => void;
}) {
  const { t } = useLang();
  const { logout } = useStore();
  const [open, setOpen] = useState(false);

  if (!isAuthed) {
    return (
      <button
        onClick={onSignIn}
        className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-2 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-muted text-ink-soft">
          <UserIcon className="h-4 w-4" />
        </span>
        <span className="hidden pr-1 sm:inline">{t("shell.signin")}</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("shell.account")}
        className="inline-flex items-center gap-1.5 rounded-full border border-line/60 glass-pill py-1 pl-1.5 pr-2.5 text-sm font-medium text-ink transition-all hover-lift active-press"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-semibold text-white shadow-xs">
          {(name ?? "You").slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-[9rem] truncate sm:inline">{name ?? t("shell.account")}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-ink-faint transition-transform duration-200", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Click-away layer */}
            <button
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-black/10 backdrop-blur-[2px]"
            />
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-[var(--radius-lg)] border border-line/70 glass-panel py-1.5 shadow-[var(--shadow-lift)]"
            >
              {name && (
                <div className="truncate px-3.5 pb-1.5 pt-1 text-xs text-ink-faint">{name}</div>
              )}
              {MENU.map((m) => {
                const active = isActive(pathname, m.href, m.href === "/app");
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors",
                      active ? "bg-brand/10 text-brand font-medium dark:bg-brand/20 dark:text-brand-ink" : "text-ink hover:bg-surface-muted/70"
                    )}
                  >
                    <m.icon className="h-4 w-4 text-ink-soft" />
                    {t(m.label)}
                  </Link>
                );
              })}
              <div className="my-1 border-t border-line/60" />
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-danger transition-colors hover:bg-danger-soft/50 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                {t("shell.signout")}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotificationsButton({
  count,
  notifications,
}: {
  count: number;
  notifications: import("@/types").AppNotification[];
}) {
  const { markAllNotificationsRead } = useStore();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) markAllNotificationsRead();
        }}
        aria-label={t("shell.notifications")}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-line/60 glass-pill text-ink-soft transition-all hover-lift active-press hover:text-ink cursor-pointer"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.6rem] font-bold text-white shadow-xs">
            {count}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-black/10 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-[var(--radius-lg)] border border-line/70 glass-panel shadow-[var(--shadow-lift)]"
            >
              <div className="border-b border-line/60 px-4 py-2.5 text-sm font-semibold text-ink">
                {t("shell.notifications")}
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-ink-faint">
                  {t("shell.noNotifs")}
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {notifications.slice(0, 12).map((n) => (
                    <div key={n.id} className="border-b border-line/60 px-4 py-3 last:border-0 hover:bg-surface-muted/50 transition-colors">
                      <div className="text-sm font-medium text-ink">{n.title}</div>
                      <div className="text-xs text-ink-soft">{n.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileNav({
  pathname,
  isAuthed,
  user,
  onProfile,
}: {
  pathname: string;
  isAuthed: boolean;
  user: import("@/types").User | null;
  onProfile: () => void;
}) {
  const { t } = useLang();
  const items = [
    { href: "/app", label: t("nav.home"), icon: Home, exact: true },
    { href: "/app/trips", label: t("nav.trips"), icon: Ticket },
    { href: "/app/plan", label: t("nav.plan"), icon: Plus, primary: true },
    { href: "/app/activity", label: t("nav.activity"), icon: ActivityIcon },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line/60 glass-dock backdrop-blur-2xl lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map((it) => {
          const active = isActive(pathname, it.href, it.exact);
          if (it.primary) {
            return (
              <Link key={it.href} href={it.href} className="flex items-center justify-center py-1.5">
                <span className="grid h-12 w-12 -translate-y-3 place-items-center rounded-[var(--radius-lg)] bg-brand text-white shadow-[var(--shadow-brand)] transition-transform duration-200 hover:scale-105 active:scale-95">
                  <it.icon className="h-6 w-6" />
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-medium",
                active ? "text-brand" : "text-ink-faint"
              )}
            >
              <it.icon className="h-5 w-5" />
              {it.label}
            </Link>
          );
        })}
        {isAuthed ? (
          <Link
            href="/app/settings"
            className={cn(
              "flex flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-medium",
              isActive(pathname, "/app/settings") ? "text-brand" : "text-ink-faint"
            )}
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[0.6rem] font-bold text-white">
              {(user?.name ?? "Y").slice(0, 1).toUpperCase()}
            </span>
            {t("nav.profile")}
          </Link>
        ) : (
          <button
            onClick={onProfile}
            className="flex flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-medium text-ink-faint"
          >
            <UserIcon className="h-5 w-5" />
            {t("shell.signin")}
          </button>
        )}
      </div>
    </nav>
  );
}
