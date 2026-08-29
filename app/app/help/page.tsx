"use client";

import { LifeBuoy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/ui";
import { useLang } from "@/lib/i18n";

export default function HelpPage() {
  const { t } = useLang();
  const faq = [
    { q: t("help.q1"), a: t("help.a1") },
    { q: t("help.q2"), a: t("help.a2") },
    { q: t("help.q3"), a: t("help.a3") },
    { q: t("help.q4"), a: t("help.a4") },
  ];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("help.title")} subtitle={t("help.subtitle")} />
      <div className="space-y-3">
        {faq.map((f) => (
          <Card key={f.q} className="p-5">
            <div className="flex items-start gap-3">
              <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <div>
                <div className="font-semibold text-ink">{f.q}</div>
                <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-soft">{f.a}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
