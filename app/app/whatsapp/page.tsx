"use client";

import { Info } from "lucide-react";
import { PageHeader } from "@/components/app/ui";
import { WhatsAppThread } from "@/components/whatsapp/WhatsAppThread";
import { useLang } from "@/lib/i18n";

export default function WhatsAppPage() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("wa.pageTitle")} subtitle={t("wa.pageSubtitle")} />

      <WhatsAppThread />

      <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-line bg-surface-muted px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <p className="text-[0.82rem] leading-relaxed text-ink-soft">{t("wa.simNote")}</p>
      </div>
    </div>
  );
}
