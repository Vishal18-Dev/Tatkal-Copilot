"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  User,
  Plus,
  Pencil,
  Trash2,
  Utensils,
  BedDouble,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/ui";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { BerthPreference, MealPreference, Traveller } from "@/types";

const BERTHS: BerthPreference[] = ["Lower", "Middle", "Upper", "Side Lower", "No preference"];
const MEALS: MealPreference[] = ["Veg", "Non-veg", "Jain", "No meal"];

type Draft = Omit<Traveller, "id">;
const emptyDraft: Draft = {
  name: "",
  age: 30,
  gender: "M",
  berthPreference: "No preference",
  mealPreference: "Veg",
  isSenior: false,
};

export function TravellerManager({
  selectable = false,
  selectedIds = [],
  onToggle,
}: {
  selectable?: boolean;
  selectedIds?: string[];
  onToggle?: (id: string) => void;
}) {
  const { travellers, addTraveller, updateTraveller, deleteTraveller } = useStore();
  const { t } = useLang();
  const [editing, setEditing] = useState<Traveller | "new" | null>(null);

  return (
    <div>
      {travellers.length === 0 ? (
        <EmptyState
          icon={<User className="h-6 w-6" />}
          title={t("trav.emptyTitle")}
          body={t("trav.emptyBody")}
          actionLabel={t("trav.formAdd")}
          onAction={() => setEditing("new")}
        />
      ) : (
        <div className="space-y-3">
          {travellers.map((p, i) => {
            const selected = selectedIds.includes(p.id);
            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  "flex items-center gap-4 rounded-[var(--radius-lg)] border bg-surface px-4 py-3.5 transition-colors",
                  selectable && selected
                    ? "border-2 border-brand shadow-[var(--shadow-card)]"
                    : "border border-line"
                )}
              >
                {selectable && (
                  <button
                    onClick={() => onToggle?.(p.id)}
                    aria-pressed={selected}
                    aria-label={t("trav.travellingNow")}
                    className={cn(
                      "grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-semibold transition-colors",
                      selected ? "bg-brand text-white" : "bg-surface-muted text-ink-soft"
                    )}
                  >
                    {selected ? <Check className="h-5 w-5" strokeWidth={3} /> : <User className="h-5 w-5" />}
                  </button>
                )}

                <button
                  onClick={() => (selectable ? onToggle?.(p.id) : setEditing(p))}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[1.05rem] font-semibold text-ink">{p.name}</span>
                    {p.isSenior && (
                      <span className="rounded-full bg-caution-soft px-2 py-0.5 text-[0.68rem] font-semibold text-caution">
                        {t("trav.senior")}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-ink-faint">
                    <span>{p.age} · {p.gender}</span>
                    <span className="inline-flex items-center gap-1">
                      <BedDouble className="h-3.5 w-3.5" /> {p.berthPreference}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Utensils className="h-3.5 w-3.5" /> {p.mealPreference}
                    </span>
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setEditing(p)}
                    aria-label="Edit"
                    className="grid h-9 w-9 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteTraveller(p.id)}
                    aria-label="Delete"
                    className="grid h-9 w-9 place-items-center rounded-full text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {travellers.length > 0 && (
        <button
          onClick={() => setEditing("new")}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed border-line-strong bg-surface/60 py-4 text-[0.98rem] font-medium text-ink-soft transition-colors hover:border-brand/50 hover:text-brand"
        >
          <Plus className="h-5 w-5" />
          {t("trav.add")}
        </button>
      )}

      <div className="mt-5 flex items-center gap-1.5 text-sm text-ink-faint">
        <ShieldCheck className="h-4 w-4 text-confirm" />
        {t("trav.privacy")}
      </div>

      <AnimatePresence>
        {editing && (
          <TravellerForm
            initial={editing === "new" ? emptyDraft : editing}
            title={editing === "new" ? t("trav.formAdd") : t("trav.formEdit")}
            onCancel={() => setEditing(null)}
            onSave={(draft) => {
              if (editing === "new") addTraveller(draft);
              else updateTraveller(editing.id, draft);
              setEditing(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TravellerForm({
  initial,
  title,
  onCancel,
  onSave,
}: {
  initial: Draft;
  title: string;
  onCancel: () => void;
  onSave: (draft: Draft) => void;
}) {
  const { t } = useLang();
  const [draft, setDraft] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const valid = draft.name.trim().length > 1 && draft.age >= 1 && draft.age <= 120;

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="relative w-full max-w-md rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-[var(--shadow-lift)]"
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-xl font-semibold text-ink">{title}</h3>
        <div className="mt-5 space-y-4">
          <Field label={t("trav.fName")}>
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("trav.fAge")}>
              <input
                type="number"
                min={1}
                max={120}
                value={draft.age}
                onChange={(e) => {
                  const age = parseInt(e.target.value, 10) || 0;
                  setDraft((d) => ({ ...d, age, isSenior: age >= 60 }));
                }}
                className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-ink focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
              />
            </Field>
            <Field label={t("trav.fGender")}>
              <Segmented options={["M", "F", "O"]} value={draft.gender} onChange={(v) => set("gender", v as Draft["gender"])} />
            </Field>
          </div>
          <Field label={t("trav.fBerth")}>
            <select
              value={draft.berthPreference}
              onChange={(e) => set("berthPreference", e.target.value as BerthPreference)}
              className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-ink focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
            >
              {BERTHS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Field>
          <Field label={t("trav.fMeal")}>
            <Segmented options={MEALS} value={draft.mealPreference} onChange={(v) => set("mealPreference", v as MealPreference)} />
          </Field>
          <label className="flex items-center justify-between rounded-xl border border-line bg-surface-muted px-3.5 py-2.5">
            <span className="text-sm font-medium text-ink">{t("trav.fSenior")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.isSenior}
              onClick={() => set("isSenior", !draft.isSenior)}
              className={cn("relative h-6 w-11 rounded-full transition-colors", draft.isSenior ? "bg-brand" : "bg-line-strong")}
            >
              <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", draft.isSenior ? "left-[22px]" : "left-0.5")} />
            </button>
          </label>
        </div>
        <div className="mt-6 flex gap-2.5">
          <Button variant="ghost" size="md" className="flex-1" onClick={onCancel}>
            {t("trav.cancel")}
          </Button>
          <Button size="md" className="flex-1" disabled={!valid} onClick={() => onSave({ ...draft, name: draft.name.trim() })}>
            {t("trav.save")}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</span>
      {children}
    </label>
  );
}

function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "flex-1 rounded-xl border px-2 py-2 text-sm font-medium transition-colors",
            value === o ? "border-brand bg-brand-soft text-brand-ink" : "border-line-strong text-ink-soft hover:bg-surface-muted"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
