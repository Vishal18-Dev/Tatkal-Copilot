"use client";

import { Wallet, Check, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DemoBadge } from "@/components/app/ui";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { formatFare } from "@/lib/utils";

/**
 * Rail Wallet readiness — payment prepared BEFORE Tatkal. Shows balance vs the
 * estimated journey fare and whether it covers the trip. Demo balance only; no
 * real payment credential is involved.
 */
export function WalletCard({ estimatedFare }: { estimatedFare: number }) {
  const { t } = useLang();
  const { wallet } = useStore();
  const covers = wallet.balance >= estimatedFare;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-brand">
          <Wallet className="h-5 w-5" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">{t("pay.ready")}</h3>
        </div>
        <DemoBadge />
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-xs text-ink-faint">{t("pay.walletTitle")}</div>
          <div className="tabular text-2xl font-bold text-brand-ink">{formatFare(wallet.balance)}</div>
          <div className="text-[0.7rem] text-ink-faint">{t("pay.available")}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-ink-faint">{t("pay.estFare")}</div>
          <div className="tabular text-lg font-semibold text-ink">{formatFare(estimatedFare)}</div>
        </div>
      </div>

      <div
        className={
          "mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[0.83rem] font-medium " +
          (covers ? "bg-confirm-soft text-confirm" : "bg-caution-soft text-caution")
        }
      >
        {covers ? <Check className="h-4 w-4" strokeWidth={3} /> : <AlertTriangle className="h-4 w-4" />}
        {covers ? t("pay.enough") : t("pay.notEnough")}
      </div>
    </Card>
  );
}
