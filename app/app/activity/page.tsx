"use client";

import {
  Activity as ActivityIcon,
  Play,
  XCircle,
  RefreshCw,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  Clock,
  Bookmark,
  Bot,
  Bell,
  Search,
  UserX,
} from "lucide-react";
import { PageHeader, EmptyState } from "@/components/app/ui";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import type { ActivityEvent, ActivityKind } from "@/types";

const META: Record<ActivityKind, { icon: typeof Play; cls: string; label: string }> = {
  attempt_started: { icon: Play, cls: "bg-brand-soft text-brand", label: "Booking" },
  primary_unavailable: { icon: XCircle, cls: "bg-caution-soft text-caution", label: "Unavailable" },
  backup_attempted: { icon: RefreshCw, cls: "bg-brand-soft text-brand", label: "Backup" },
  confirmed: { icon: CheckCircle2, cls: "bg-confirm-soft text-confirm", label: "Confirmed" },
  failed: { icon: XCircle, cls: "bg-danger-soft text-danger", label: "Failed" },
  waitlisted: { icon: Clock, cls: "bg-caution-soft text-caution", label: "Waitlisted" },
  payment_event: { icon: CreditCard, cls: "bg-brand-soft text-brand", label: "Payment" },
  strategy_change: { icon: RefreshCw, cls: "bg-brand-soft text-brand", label: "Strategy" },
  authorized: { icon: ShieldCheck, cls: "bg-confirm-soft text-confirm", label: "Auth" },
  saved: { icon: Bookmark, cls: "bg-brand-soft text-brand", label: "Saved" },
  agent_reasoning: { icon: Bot, cls: "bg-[#eef2ff] text-[#4338ca]", label: "Agent" },
  notification_sent: { icon: Bell, cls: "bg-[#fff7ed] text-[#c2410c]", label: "Notification" },
  readiness_check: { icon: Search, cls: "bg-brand-soft text-brand", label: "Readiness" },
  user_inactive: { icon: UserX, cls: "bg-caution-soft text-caution", label: "Inactive" },
};

function timeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "numeric",
    month: "short",
  });
}

export default function ActivityPage() {
  const { activity } = useStore();
  const { t } = useLang();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("act.title")} subtitle={t("act.subtitle")} />

      {activity.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon className="h-6 w-6" />}
          title={t("act.emptyTitle")}
          body={t("act.emptyBody")}
          actionLabel={t("trips.planTrip")}
          actionHref="/app/plan"
        />
      ) : (
        <div className="relative pl-2">
          <div className="absolute bottom-2 left-[19px] top-2 w-px bg-line" />
          <div className="space-y-1">
            {activity.map((e) => (
              <Row key={e.id} event={e} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ event }: { event: ActivityEvent }) {
  const m = META[event.kind] ?? META.attempt_started;
  const Icon = m.icon;
  return (
    <div className="relative flex items-start gap-3.5 py-2">
      <span className={`z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full ${m.cls}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-[0.95rem] text-ink">{event.text}</span>
          {event.metadata?.aiGenerated && (
            <span className="rounded-full bg-[#eef2ff] px-1.5 py-0.5 text-[0.6rem] font-semibold text-[#4338ca]">
              AI
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
          <span>{timeLabel(event.at)}</span>
          {event.metadata?.tool && (
            <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.65rem]">
              {event.metadata.tool}()
            </span>
          )}
          {event.metadata?.channel && (
            <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase">
              {event.metadata.channel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
