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
  Settings,
  LifeBuoy,
  Bell,
  LogOut,
  User as UserIcon,
  Plus,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageToggle } from "@/components/brand/language-toggle";
import { AuthModal } from "@/components/auth/auth-modal";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { href: "/app", label: "nav.home", icon: Home, exact: true },
  { href: "/app/plan", label: "nav.plan", icon: Sparkles },
  { href: "/app/trips", label: "nav.trips", icon: Ticket },
  { href: "/app/travellers", label: "nav.travellers", icon: Users },
  { href: "/app/activity", label: "nav.activity", icon: ActivityIcon },
];

const SECONDARY = [
  { href: "/app/settings", label: "nav.settings", icon: Settings },
  { href: "/app/help", label: "nav.help", icon: LifeBuoy },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, isAuthed, notifications, unreadCount } = useStore();
  const { t } = useLang();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="min-h-full lg:grid lg:grid-cols-[264px_1fr]">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-surface/60 px-4 py-5 lg:flex">
        <Link href="/app" className="px-2">
          <Logo />
        </Link>

        <nav className="mt-7 flex-1 space-y-0.5">
          {PRIMARY.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} label={t(item.label)} active={isActive(pathname, item.href, item.exact)} />
          ))}
          <div className="my-4 border-t border-line" />
          {SECONDARY.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} label={t(item.label)} active={isActive(pathname, item.href)} />
          ))}
        </nav>

        <ProfileCard onSignIn={() => setAuthOpen(true)} />
      </aside>

      {/* ---------- Content ---------- */}
      <div className="flex min-h-full flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 py-3 lg:px-8">
            <Link href="/app" className="lg:hidden">
              <Logo />
            </Link>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <NotificationsButton
                count={unreadCount}
                notifications={notifications}
              />
              {!isAuthed && (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="hidden rounded-full bg-brand px-4 h-9 text-sm font-medium text-white shadow-[var(--shadow-brand)] hover:bg-[#4338ca] sm:inline-flex sm:items-center"
                >
                  {t("shell.signin")}
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-6 lg:px-8 lg:pb-10">{children}</main>
      </div>

      {/* ---------- Mobile bottom nav ---------- */}
      <MobileNav pathname={pathname} isAuthed={isAuthed} user={user} onProfile={() => setAuthOpen(true)} />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-medium transition-colors",
        active
          ? "bg-brand-soft text-brand-ink"
          : "text-ink-soft hover:bg-surface-muted hover:text-ink"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px]", active ? "text-brand" : "text-ink-faint")} />
      {label}
    </Link>
  );
}

function ProfileCard({ onSignIn }: { onSignIn: () => void }) {
  const { isAuthed, user, logout } = useStore();
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  if (!isAuthed) {
    return (
      <button
        onClick={onSignIn}
        className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-line-strong"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-muted text-ink-soft">
          <UserIcon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-sm font-semibold text-ink">{t("shell.signin")}</div>
          <div className="text-xs text-ink-faint">{t("shell.signinSub")}</div>
        </div>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-line-strong"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-semibold text-white">
          {(user?.name ?? "You").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">
            {user?.name ?? t("shell.account")}
          </div>
          <div className="truncate text-xs text-ink-faint">+91 {user?.phone}</div>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-lift)]"
          >
            <Link
              href="/app/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-ink-soft hover:bg-surface-muted"
            >
              <Settings className="h-4 w-4" /> {t("nav.settings")}
            </Link>
            <button
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-danger hover:bg-danger-soft"
            >
              <LogOut className="h-4 w-4" /> {t("shell.signout")}
            </button>
          </motion.div>
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
            className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-lift)]"
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
                <span className="grid h-12 w-12 -translate-y-3 place-items-center rounded-2xl bg-brand text-white shadow-[var(--shadow-brand)]">
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
