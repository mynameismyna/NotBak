"use client";

import type { ReactNode } from "react";
import { AppSelect } from "@/components/AppSelect";
import {
  TYPE_OPTIONS,
  type TaskTypeFilter,
  viewLabel,
} from "@/lib/task-list";

interface ProjectOption {
  id: string;
  name: string;
}

export interface ListFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  view?: string;
  onViewChange?: (view: string) => void;
  viewOptions?: { value: string; label: string }[];
  showViewFilter?: boolean;
  showQuickViews?: boolean;
  projectId: string;
  onProjectIdChange: (id: string) => void;
  projects: ProjectOption[];
  typeFilter?: TaskTypeFilter;
  onTypeFilterChange?: (type: TaskTypeFilter) => void;
  showTypeFilter?: boolean;
}

const filterInputClass =
  "border-0 rounded-lg px-3 py-2 text-sm bg-white shadow w-full outline-none focus:outline-none focus:ring-2 focus:ring-[var(--metro-tile-gorevler)]/30 ring-offset-0";

function FilterSelect({
  id,
  label,
  value,
  onChange,
  wrapperClassName,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  wrapperClassName?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={
        wrapperClassName ??
        "flex flex-col gap-1 min-w-0 flex-1 sm:flex-initial sm:min-w-[140px]"
      }
    >
      <label htmlFor={id} className="typo-label-on-gradient">
        {label}
      </label>
      <AppSelect id={id} value={value} onChange={onChange} triggerClassName="shadow-sm">
        {children}
      </AppSelect>
    </div>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white text-gray-800 shadow">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full hover:bg-gray-200 w-4 h-4 flex items-center justify-center text-gray-500 btn-focus-clean"
        aria-label={`${label} filtresini kaldır`}
      >
        ×
      </button>
    </span>
  );
}

export function ListFilterBar({
  searchQuery,
  onSearchChange,
  view = "",
  onViewChange,
  viewOptions = [],
  showViewFilter = true,
  showQuickViews = true,
  projectId,
  onProjectIdChange,
  projects,
  typeFilter = "",
  onTypeFilterChange,
  showTypeFilter = false,
}: ListFilterBarProps) {
  const activeChips: { label: string; onRemove: () => void }[] = [];

  if (showViewFilter && view && onViewChange) {
    activeChips.push({
      label: viewLabel(view, viewOptions),
      onRemove: () => onViewChange(""),
    });
  }
  if (showTypeFilter && typeFilter && onTypeFilterChange) {
    const typeLabel = TYPE_OPTIONS.find((o) => o.value === typeFilter)?.label ?? typeFilter;
    activeChips.push({
      label: typeLabel,
      onRemove: () => onTypeFilterChange(""),
    });
  }
  if (projectId) {
    const proj = projects.find((p) => p.id === projectId);
    activeChips.push({
      label: proj?.name ?? "Proje",
      onRemove: () => onProjectIdChange(""),
    });
  }

  const quickViews =
    showViewFilter && showQuickViews && onViewChange
      ? [
          { value: "assigned", label: "Bana atanmış" },
          { value: "overdue", label: "Geciken", danger: true },
        ].filter((q) => viewOptions.some((o) => o.value === q.value))
      : [];

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <label htmlFor="record-list-search" className="typo-label-on-gradient">
            Ara
          </label>
          <input
            id="record-list-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Başlık, sorumlu, proje..."
            className={`${filterInputClass} text-gray-800 placeholder:text-gray-400`}
          />
        </div>

        {showTypeFilter && onTypeFilterChange && (
          <FilterSelect
            id="record-list-type"
            label="Tip"
            value={typeFilter}
            onChange={(v) => onTypeFilterChange(v as TaskTypeFilter)}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>
        )}

        {showViewFilter && onViewChange && (
          <FilterSelect id="record-list-view" label="Görünüm" value={view} onChange={onViewChange}>
            {viewOptions.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>
        )}

        {projects.length > 0 && (
          <FilterSelect
            id="record-list-project"
            label="Proje"
            value={projectId}
            onChange={onProjectIdChange}
            wrapperClassName={
              showViewFilter
                ? undefined
                : "flex flex-col gap-1 min-w-0 flex-1 sm:min-w-[280px]"
            }
          >
            <option value="">Tüm projeler</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </FilterSelect>
        )}
      </div>

      {(quickViews.length > 0 || activeChips.length > 0) && (
      <div className="flex flex-wrap items-center gap-2">
        {quickViews.map((q) => (
          <button
            key={q.value}
            type="button"
            onClick={() => onViewChange?.(view === q.value ? "" : q.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shadow btn-focus-clean ${
              view === q.value
                ? "text-white"
                : "bg-white/95 text-gray-700 hover:bg-white"
            }`}
            style={
              view === q.value
                ? { backgroundColor: q.danger ? "#dc2626" : "var(--metro-tile-gorevler)" }
                : undefined
            }
          >
            {q.label}
          </button>
        ))}
        {activeChips.map((chip) => (
          <ActiveChip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
        ))}
      </div>
      )}
    </div>
  );
}
