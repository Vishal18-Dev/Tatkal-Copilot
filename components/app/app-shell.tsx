"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home,
  Sparkles,
  Ticket,
  Users,
  Activity as ActivityIcon,
  Bell,
  User as UserIcon,
  Plus,
  LifeBuoy,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageToggle } from "@/components/brand/language-toggle";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { AuthModal } from "@/components/auth/auth-modal";
import { VoiceButton } from "@/components/voice/VoiceButton";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Figma V2 shell — a calm horizontal top nav in place of the sidebar.
// Items are the app's real destinations (the journey stages Options/Prepare/
// Book live inside the /app/plan wizard's own progress, not as routes).
const NAV = [
  { href: "/app", label: "nav.home", icon: Home, exact: true },
  { href: "/app/plan", label: "nav.plan", icon: Sparkles },
  { href: "/app/trips", label: "nav.trips", icon: Ticket },
  { href: "/app/travellers", label: "nav.travellers", icon: Users },
  { href: "/app/activity", label: "nav.activity", icon: ActivityIcon },
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

  return (
    <div className="flex min-h-full flex-col">
      {/* ---------- Top navigation ---------- */}
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 lg:px-6">
          {/* Brand lockup */}
          <Link href="/app" className="flex shrink-0 items-center gap-2.5">
            <Logo showWord={false} />
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="text-[0.95rem] font-semibold tracking-tight text-ink">
                {t("brand")}
              </span>
              <span className="text-[0.72rem] text-ink-faint">
                {t("brand.tagline")}
              </span>
            </span>
          </Link>

          {/* Center nav (desktop) */}
          <nav className="hidden items-center gap-1 lg:flex">
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
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href="/app/help"
              className="hidden items-center gap-1.5 rounded-[var(--radius)] px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink md:inline-flex"
            >
              <LifeBuoy className="h-4 w-4" />
              {t("nav.help")}
            </Link>
            <LanguageToggle />
            <ThemeToggle />
            <VoiceButton />
            <NotificationsButton count={unreadCount} notifications={notifications} />
            <ProfilePill
              isAuthed={isAuthed}
              name={user?.name}
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
        "rounded-[var(--radius)] px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-brand-soft text-brand-ink"
          : "text-ink-soft hover:bg-surface-muted hover:text-ink"
      )}
    >
      {label}
    </Link>
  );
}

function ProfilePill({
  isAuthed,
  name,
  onSignIn,
}: {
  isAuthed: boolean;
  name?: string;
  onSignIn: () => void;
}) {
  const { t } = useLang();
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
    <Link
      href="/app/settings"
      className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-2 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
    >
      <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-semibold text-white">
        {(name ?? "You").slice(0, 1).toUpperCase()}
      </span>
      <span className="hidden max-w-[9rem] truncate pr-1 sm:inline">
        {name ?? t("shell.account")}
      </span>
    </Link>
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
        className="relative grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-surface text-ink-soft transition-colors hover:text-ink"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.6rem] font-bold text-white">
            {count}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-lift)]"
          >
            <div className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
              {t("shell.notifications")}
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ink-faint">
                {t("shell.noNotifs")}
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifications.slice(0, 12).map((n) => (
                  <div key={n.id} className="border-b border-line px-4 py-3 last:border-0">
                    <div className="text-sm font-medium text-ink">{n.title}</div>
                    <div className="text-xs text-ink-soft">{n.body}</div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
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
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/90 backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map((it) => {
          const active = isActive(pathname, it.href, it.exact);
          if (it.primary) {
            return (
              <Link key={it.href} href={it.href} className="flex items-center justify-center py-1.5">
                <span className="grid h-12 w-12 -translate-y-3 place-items-center rounded-[var(--radius-lg)] bg-brand text-white shadow-[var(--shadow-brand)]">
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
