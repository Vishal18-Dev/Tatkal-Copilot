"use client";

import { Sun, Moon, MonitorCog } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useLang } from "@/lib/i18n";

const ICON = { light: Sun, dark: Moon, system: MonitorCog } as const;

/** Cycles light → dark → system on tap. Icon always reflects what's on screen. */
export function ThemeToggle() {
  const { preference, cycle } = useTheme();
  const { t } = useLang();
  const Icon = ICON[preference];

  return (
    <button
      onClick={cycle}
      aria-label={t(`theme.${preference}`)}
      title={t(`theme.${preference}`)}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line/60 glass-pill text-ink-soft transition-all hover-lift active-press hover:text-ink cursor-pointer"
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}
