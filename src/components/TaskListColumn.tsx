"use client";

import { useState, useMemo, type ReactNode } from "react";
import { PaginatedListSection } from "@/components/PaginatedListSection";
import { RecordListCard } from "@/components/RecordListCard";
import {
  FutureCustomDateRange,
  FutureDueDateSelect,
} from "@/components/FutureColumnDueDateFilters";
import {
  filterTasksBySearch,
  filterTasksByFutureDueDate,
  isTaskRelevantToUser,
  priorityRank,
  type DueColumnKey,
  type FutureDueDatePreset,
  type TaskListItem,
} from "@/lib/task-list";

const columnSearchInputClass =
  "w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-800 bg-white placeholder:text-gray-400 outline-none focus:outline-none focus:ring-2 focus:ring-[var(--metro-tile-gorevler)]/30";

export function TaskListColumn({
  label,
  headerClass,
  items,
  listResetKey,
  columnKey,
  emptyMessage = "Kayıt yok",
  showCreatedBy = false,
  showDueBadge = false,
  forceOverdueAccent = false,
  enableColumnSearch = false,
  columnSearchPlaceholder,
  currentUserId = null,
  headerAction,
  menuOpenId,
  setMenuOpenId,
  onOpenDetail,
  onDelete,
  onSendToCalendar,
}: {
  label: string;
  headerClass: string;
  items: TaskListItem[];
  listResetKey: string;
  columnKey?: DueColumnKey;
  emptyMessage?: string;
  showCreatedBy?: boolean;
  showDueBadge?: boolean;
  forceOverdueAccent?: boolean;
  enableColumnSearch?: boolean;
  columnSearchPlaceholder?: string;
  currentUserId?: string | null;
  headerAction?: ReactNode;
  menuOpenId: string | null;
  setMenuOpenId: (id: string | null) => void;
  onOpenDetail: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onSendToCalendar?: (taskId: string) => void;
}) {
  const [columnQuery, setColumnQuery] = useState("");
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);
  const [dueDatePreset, setDueDatePreset] = useState<FutureDueDatePreset>("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const enableFutureDueFilter = columnKey === "future" && enableColumnSearch;

  const afterAssignedFilter = useMemo(() => {
    if (!assignedToMeOnly || !currentUserId) return items;
    return items.filter((t) => isTaskRelevantToUser(t, currentUserId));
  }, [items, assignedToMeOnly, currentUserId]);

  const afterDueDateFilter = useMemo(() => {
    if (!enableFutureDueFilter || !dueDatePreset) return afterAssignedFilter;
    if (dueDatePreset === "custom" && !customFrom && !customTo) return afterAssignedFilter;
    return filterTasksByFutureDueDate(
      afterAssignedFilter,
      dueDatePreset,
      customFrom,
      customTo
    );
  }, [
    afterAssignedFilter,
    enableFutureDueFilter,
    dueDatePreset,
    customFrom,
    customTo,
  ]);

  const displayedItems = useMemo(
    () =>
      enableColumnSearch
        ? filterTasksBySearch(afterDueDateFilter, columnQuery)
        : afterDueDateFilter,
    [afterDueDateFilter, columnQuery, enableColumnSearch]
  );

  const displayedItemsSorted = useMemo(() => {
    // Geciken sütununda: en eski son tarih + en önemli üstte
    if (columnKey !== "overdue") return displayedItems;
    return [...displayedItems].sort((a, b) => {
      const dueA = new Date(a.dueDate);
      const dueB = new Date(b.dueDate);
      const dueDiff = dueA.getTime() - dueB.getTime(); // eski (küçük) üstte
      if (dueDiff !== 0) return dueDiff;
      const prioDiff = priorityRank(b.priority) - priorityRank(a.priority); // önemli (büyük) üstte
      if (prioDiff !== 0) return prioDiff;
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createdB - createdA; // en yeni üstte
    });
  }, [displayedItems, columnKey]);

  const paginationResetKey = [
    listResetKey,
    assignedToMeOnly ? "mine:1" : "mine:0",
    enableFutureDueFilter ? `due:${dueDatePreset}|${customFrom}|${customTo}` : "",
    enableColumnSearch ? `col:${columnQuery.trim().toLowerCase()}` : "",
  ]
    .filter(Boolean)
    .join("|");

  const countLabel =
    displayedItemsSorted.length !== items.length
      ? `${displayedItemsSorted.length} / ${items.length}`
      : String(displayedItemsSorted.length);

  const hasDateFilter =
    enableFutureDueFilter &&
    dueDatePreset &&
    (dueDatePreset !== "custom" || Boolean(customFrom || customTo));

  const listEmptyMessage = columnQuery.trim()
    ? "Bu sütunda eşleşen kayıt yok"
    : hasDateFilter
      ? "Seçilen tarih aralığında kayıt yok"
      : assignedToMeOnly && currentUserId
        ? "Size atanmış kayıt yok"
        : emptyMessage;

  const searchPlaceholder = columnSearchPlaceholder ?? `${label} kayıtlarında ara…`;

  return (
    <section className="min-w-0 flex flex-col">
      <header
        className={`rounded-t-lg border px-3 py-2 text-sm font-semibold ${headerClass}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span>
            {label}
            <span className="ml-1.5 font-normal opacity-80">({countLabel})</span>
          </span>
          {headerAction}
        </div>
      </header>
      <div
        className="rounded-b-lg border border-t-0 border-gray-200 p-2 min-h-[3rem]"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        {enableColumnSearch && (
          <div className="mb-2 flex flex-col gap-2">
            {/* Tüm sütunlarda aynı yükseklik: Bana atanmış + (Gelecek’te tarih listesi) */}
            <div className="flex items-center gap-2 min-h-[1.875rem]">
              <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={assignedToMeOnly}
                  onChange={(e) => setAssignedToMeOnly(e.target.checked)}
                  disabled={!currentUserId}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-[var(--metro-tile-gorevler)] focus:ring-[var(--metro-tile-gorevler)]/30 disabled:opacity-50"
                  aria-label="Bana atanmış"
                />
                <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                  Bana atanmış
                </span>
              </label>
              {enableFutureDueFilter ? (
                <FutureDueDateSelect
                  preset={dueDatePreset}
                  onPresetChange={(next) => {
                    setDueDatePreset(next);
                    if (next !== "custom") {
                      setCustomFrom("");
                      setCustomTo("");
                    }
                  }}
                />
              ) : (
                <div className="min-w-0 flex-1" aria-hidden />
              )}
            </div>

            {enableFutureDueFilter && dueDatePreset === "custom" && (
              <FutureCustomDateRange
                customFrom={customFrom}
                customTo={customTo}
                onCustomFromChange={setCustomFrom}
                onCustomToChange={setCustomTo}
              />
            )}

            <label className="block min-h-[2.125rem]">
              <span className="sr-only">{searchPlaceholder}</span>
              <input
                type="search"
                value={columnQuery}
                onChange={(e) => setColumnQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className={columnSearchInputClass}
                autoComplete="off"
              />
            </label>
          </div>
        )}
        <PaginatedListSection
          items={displayedItemsSorted}
          resetKey={paginationResetKey}
          emptyMessage={listEmptyMessage}
        >
          {(visibleItems) => (
            <ul className="space-y-2">
              {visibleItems.map((task) => (
                <RecordListCard
                  key={task.id}
                  task={task}
                  showCreatedBy={showCreatedBy}
                  showDueBadge={showDueBadge}
                  forceOverdueAccent={forceOverdueAccent}
                  menuOpenId={menuOpenId}
                  setMenuOpenId={setMenuOpenId}
                  onOpen={onOpenDetail}
                  onDelete={onDelete}
                  onSendToCalendar={onSendToCalendar}
                />
              ))}
            </ul>
          )}
        </PaginatedListSection>
      </div>
    </section>
  );
}
