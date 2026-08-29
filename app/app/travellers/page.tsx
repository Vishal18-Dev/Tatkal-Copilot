"use client";

import { PageHeader } from "@/components/app/ui";
import { TravellerManager } from "@/components/travellers/traveller-manager";
import { useLang } from "@/lib/i18n";

export default function TravellersPage() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("trav.title")} subtitle={t("trav.subtitle")} />
      <TravellerManager />
    </div>
  );
}
