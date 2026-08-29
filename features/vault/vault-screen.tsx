"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepShell, Eyebrow } from "@/components/step-shell";
import { TravellerManager } from "@/components/travellers/traveller-manager";
import { useJourney } from "@/lib/journey";
import { useLang } from "@/lib/i18n";

export function VaultScreen() {
  const { selectedPassengerIds, togglePassenger, goTo } = useJourney();
  const { t } = useLang();
  const count = selectedPassengerIds.length;

  return (
    <StepShell>
      <Eyebrow>{t("vault.eyebrow")}</Eyebrow>
      <h2 className="text-headline">Who's travelling?</h2>
      <p className="mt-3 text-lg text-ink-soft">
        Tap to add travellers to this booking. Manage them anytime under Travellers.
      </p>

      <div className="mt-8">
        <TravellerManager
          selectable
          selectedIds={selectedPassengerIds}
          onToggle={togglePassenger}
        />
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <span className="text-sm text-ink-faint">
          {count} {t("vault.selectedCount")}
        </span>
        <Button size="lg" disabled={count === 0} onClick={() => goTo("review")} className="group">
          {count === 0 ? t("vault.needMore") : t("vault.cta")}
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>
    </StepShell>
  );
}
