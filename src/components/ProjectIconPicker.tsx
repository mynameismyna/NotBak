"use client";

import { ProjectIcon } from "@/components/ProjectIcon";
import {
  PROJECT_ICON_LABELS,
  PROJECT_ICON_PICKER_KEYS,
  type ProjectIconKey,
} from "@/lib/project-icons";

export function ProjectIconPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: ProjectIconKey;
  onChange: (key: ProjectIconKey) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-6 sm:grid-cols-9 gap-2"
      role="radiogroup"
      aria-label="Proje ikonu"
    >
      {PROJECT_ICON_PICKER_KEYS.map((key) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={PROJECT_ICON_LABELS[key]}
            title={PROJECT_ICON_LABELS[key]}
            disabled={disabled}
            onClick={() => onChange(key)}
            className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2 transition ${
              selected
                ? "border-[var(--metro-tile-projeler)] bg-indigo-50 ring-2 ring-[var(--metro-tile-projeler)]/30"
                : "border-gray-200 bg-white hover:bg-gray-50"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <ProjectIcon iconKey={key} className="w-5 h-5 text-indigo-700" />
            <span className="text-[10px] leading-tight text-gray-600 text-center line-clamp-2 hidden sm:block">
              {PROJECT_ICON_LABELS[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
