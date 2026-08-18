"use client";

import { useId, useState } from "react";
import { Laptop, Smartphone, Tablet, Wifi, type LucideIcon } from "lucide-react";
import { EQUIPMENT_TOKENS, EQUIPMENT_LABEL } from "@/lib/brief/equipment";

/**
 * Form primitives for the brief editor.
 *
 * Every one of these saves on BLUR, not on keystroke: the numeric fields need no
 * AI call, so making them instant is free — but firing a request per keystroke
 * would be a request per keystroke.
 *
 * They all share one rule, stated in the UI rather than hidden: an empty field
 * means "no constraint". That is the single most important thing for HR to
 * understand here, because leaving a box blank is not the same as setting it
 * to zero, and getting it backwards would reject everyone.
 */

export function FieldGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-2.5">
        <h3 className="text-sm font-medium text-slate-900">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** A number input that commits on blur and shows "ไม่จำกัด" when empty. */
export function NumberField({
  label,
  value,
  onCommit,
  placeholder = "ไม่จำกัด",
  suffix,
  disabled,
}: {
  label: string;
  value: number | null;
  onCommit: (v: number | null) => void;
  placeholder?: string;
  suffix?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value === null ? "" : String(value));

  // Re-sync when the SERVER sends a different value back — e.g. a reversed
  // age range that the API silently repaired — so the input never disagrees
  // with what was actually saved.
  //
  // Adjusted during render rather than in an effect: an effect would paint the
  // stale value first and then correct it, which reads as the field flickering
  // back to what you just typed.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value === null ? "" : String(value));
  }

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          disabled={disabled}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const n = draft.trim() === "" ? null : Number(draft);
            const next = n !== null && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
            if (next !== value) onCommit(next);
          }}
          className={`w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm tabular-nums text-slate-900 transition-colors duration-150 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 ${
            suffix ? "pr-10" : ""
          }`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/** Segmented control — used where the options are few and worth seeing at once. */
export function SegmentedField<T extends string>({
  label,
  value,
  options,
  onSelect,
  hint,
}: {
  label: string;
  value: T | null;
  options: Array<{ value: T | null; label: string }>;
  onSelect: (v: T | null) => void;
  hint?: string;
}) {
  return (
    <div>
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1 inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.label}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(o.value)}
              className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

const EQUIPMENT_ICON: Record<string, LucideIcon> = {
  computer: Laptop,
  internet: Wifi,
  phone: Smartphone,
  tablet: Tablet,
};

/**
 * Equipment as icon toggles.
 *
 * Four options with an icon above the label, because the set is small, visual,
 * and genuinely multi-select — a dropdown would hide the whole vocabulary and a
 * checkbox column would look like a legal form.
 */
export function EquipmentField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (token: string) => {
    onChange(value.includes(token) ? value.filter((v) => v !== token) : [...value, token]);
  };

  return (
    <div>
      <span className="block text-xs font-medium text-slate-600">อุปกรณ์ที่ต้องมี</span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {EQUIPMENT_TOKENS.map((token) => {
          const Icon = EQUIPMENT_ICON[token];
          const active = value.includes(token);
          return (
            <button
              key={token}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(token)}
              className={`flex w-[88px] cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                active
                  ? "border-blue-500 bg-blue-50 text-blue-800"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="text-center text-[11px] leading-tight">
                {EQUIPMENT_LABEL[token]}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">
        คนที่ไม่ได้ตอบเรื่องอุปกรณ์จะไม่ถูกตัดออก
      </p>
    </div>
  );
}
