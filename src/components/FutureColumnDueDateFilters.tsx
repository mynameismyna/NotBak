"use client";

import { AppSelect } from "@/components/AppSelect";
import {
  FUTURE_DUE_DATE_PRESETS,
  type FutureDueDatePreset,
} from "@/lib/task-list";

const dateInputClass =
  "w-[7.25rem] min-w-0 rounded-md border-0 bg-gray-50 shadow-sm px-1.5 py-1.5 text-xs text-gray-800 outline-none focus:outline-none focus:ring-2 focus:ring-[var(--metro-tile-gorevler)]/30";

export const dueDateFilterOptions = [
  { value: "", label: "Tüm tarihler" },
  ...FUTURE_DUE_DATE_PRESETS,
];

/** Gelecek sütunu: tarih açılır listesi (üst satırın sağ yarısı). */
export function FutureDueDateSelect({
  preset,
  onPresetChange,
}: {
  preset: FutureDueDatePreset;
  onPresetChange: (preset: FutureDueDatePreset) => void;
}) {
  const handlePresetChange = (value: string) => {
    onPresetChange(value as FutureDueDatePreset);
  };

  return (
    <AppSelect
      value={preset}
      onChange={handlePresetChange}
      options={dueDateFilterOptions}
      size="sm"
      className="min-w-0 flex-1"
      aria-label="Son tarih filtresi"
    />
  );
}

/** Özel aralık seçilince ikinci satır (yalnızca Gelecek). */
export function FutureCustomDateRange({
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
}: {
  customFrom: string;
  customTo: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 min-h-[1.875rem]">
      <input
        type="date"
        value={customFrom}
        onChange={(e) => onCustomFromChange(e.target.value)}
        className={dateInputClass}
        aria-label="Başlangıç tarihi"
        title="Başlangıç"
      />
      <span className="text-xs text-gray-400 shrink-0" aria-hidden>
        –
      </span>
      <input
        type="date"
        value={customTo}
        onChange={(e) => onCustomToChange(e.target.value)}
        className={dateInputClass}
        aria-label="Bitiş tarihi"
        title="Bitiş"
      />
    </div>
  );
}
