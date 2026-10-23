"use client";

import { useState, useMemo, useEffect } from "react";
import { AppSelect } from "@/components/AppSelect";
import { PaginatedListSection } from "@/components/PaginatedListSection";
import { RecordListCard } from "@/components/RecordListCard";
import { RecordListRow } from "@/components/RecordListRow";
import { RecordListTable } from "@/components/RecordListTable";
import { TaskListColumn } from "@/components/TaskListColumn";
import {
  SORT_OPTIONS,
  sortTaskList,
  filterTasksBySearch,
  groupTasksByDueColumn,
  DUE_COLUMNS,
  type TaskListItem,
  type TaskListSortKey,
  type SortDir,
} from "@/lib/task-list";

export type TaskListLayoutMode = "columns" | "list" | "table";

export interface TaskListProps {
  tasks: TaskListItem[];
  loading?: boolean;
  emptyMessage: string;
  emptyHint?: string;
  searchQuery?: string;
  showCreatedBy?: boolean;
  onOpenDetail: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onSendToCalendar?: (taskId: string) => void;
  defaultSortKey?: TaskListSortKey;
  defaultSortDir?: SortDir;
  layoutMode?: TaskListLayoutMode;
  onLayoutModeChange?: (mode: TaskListLayoutMode) => void;
}

export function TaskList({
  tasks,
  loading = false,
  emptyMessage,
  emptyHint,
  searchQuery = "",
  showCreatedBy = false,
  onOpenDetail,
  onDelete,
  onSendToCalendar,
  defaultSortKey = "dueDate",
  defaultSortDir = "asc",
  layoutMode = "columns",
  onLayoutModeChange,
}: TaskListProps) {
  const [sortKey, setSortKey] = useState<TaskListSortKey>(defaultSortKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setCurrentUserId(d.user?.id ?? null))
      .catch(() => setCurrentUserId(null));
  }, []);

  const { displayed, groups, completedOnly, completedSorted, listResetKey } = useMemo(() => {
    const filtered = filterTasksBySearch(tasks, searchQuery);
    const sorted = sortTaskList(filtered, sortKey, sortDir);
    const grouped = groupTasksByDueColumn(sorted);
    const onlyCompleted =
      sorted.length > 0 && sorted.every((t) => t.status === "TAMAMLANDI");
    const completedSorted = sortTaskList(grouped.completed, "statusChangedAt", "desc");
    const resetKey = `${searchQuery}|${sortKey}|${sortDir}|${sorted.length}|${sorted.map((t) => t.id).join(",")}`;
    return {
      displayed: sorted,
      groups: grouped,
      completedOnly: onlyCompleted,
      completedSorted,
      listResetKey: resetKey,
    };
  }, [tasks, searchQuery, sortKey, sortDir]);

  const toggleSortDir = () => setSortDir((d) => (d === "asc" ? "desc" : "asc"));

  const cardProps = {
    showCreatedBy,
    menuOpenId,
    setMenuOpenId,
    onOpenDetail,
    onDelete,
    onSendToCalendar,
  };
  const usesFlatLayout = layoutMode !== "columns";
  const activeTasks = displayed.filter((task) => task.status !== "TAMAMLANDI");

  const renderFlatItems = (items: TaskListItem[], resetKey: string) => (
    <PaginatedListSection items={items} resetKey={resetKey}>
      {(visibleItems) =>
        layoutMode === "table" ? (
          <RecordListTable
            tasks={visibleItems}
            menuOpenId={cardProps.menuOpenId}
            setMenuOpenId={cardProps.setMenuOpenId}
            onOpen={cardProps.onOpenDetail}
            onDelete={cardProps.onDelete}
            onSendToCalendar={cardProps.onSendToCalendar}
          />
        ) : (
          <ul className="space-y-2">
            {visibleItems.map((task) => (
              <RecordListRow
                key={task.id}
                task={task}
                menuOpenId={cardProps.menuOpenId}
                setMenuOpenId={cardProps.setMenuOpenId}
                onOpen={cardProps.onOpenDetail}
                onDelete={cardProps.onDelete}
                onSendToCalendar={cardProps.onSendToCalendar}
              />
            ))}
          </ul>
        )
      }
    </PaginatedListSection>
  );

  if (loading) {
    return <p className="typo-loading-on-gradient">Yükleniyor...</p>;
  }

  if (tasks.length === 0) {
    return (
      <div
        className="rounded-xl shadow-xl p-8 text-center backdrop-blur typo-empty-on-card"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <p>{emptyMessage}</p>
        {emptyHint && <p className="mt-2 typo-caption">{emptyHint}</p>}
      </div>
    );
  }

  if (displayed.length === 0) {
    return (
      <div
        className="rounded-xl shadow-xl p-8 text-center backdrop-blur typo-empty-on-card"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <p>Arama kriterine uygun kayıt bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 backdrop-blur shadow-sm"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <span className="text-sm text-gray-600">
          <span className="font-semibold text-gray-800">{displayed.length}</span> kayıt
        </span>
        <div className="flex items-center gap-2">
          {onLayoutModeChange && (
            <div
              className="flex rounded-lg border border-gray-200 bg-white p-0.5"
              role="group"
              aria-label="Kayıt görünümü"
            >
              {(
                [
                  ["columns", "Kartlar"],
                  ["list", "Liste"],
                  ["table", "Tablo"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onLayoutModeChange(mode)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition btn-focus-clean ${
                    layoutMode === mode
                      ? "bg-[var(--metro-tile-gorevler)] text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                  aria-pressed={layoutMode === mode}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <span className="sr-only">Sırala</span>
            <AppSelect
              value={sortKey}
              onChange={(v) => setSortKey(v as TaskListSortKey)}
              options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              size="sm"
              className="w-[9.5rem]"
              aria-label="Sırala"
            />
          </label>
          <button
            type="button"
            onClick={toggleSortDir}
            className="rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-700 bg-white hover:bg-gray-50 btn-focus-clean"
            title={sortDir === "asc" ? "Artan" : "Azalan"}
            aria-label={sortDir === "asc" ? "Artan sıralama" : "Azalan sıralama"}
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {usesFlatLayout ? (
        <div className="space-y-3">
          {renderFlatItems(completedOnly ? completedSorted : activeTasks, `${listResetKey}:flat-active`)}
        </div>
      ) : completedOnly ? (
        <div
          className="rounded-lg border border-gray-200 p-2"
          style={{ backgroundColor: "var(--metro-card-bg)" }}
        >
          <h2 className="typo-subsection-title text-gray-700 px-2 py-1 mb-2">
            Tamamlanan ({completedSorted.length})
          </h2>
          <PaginatedListSection items={completedSorted} resetKey={`${listResetKey}:completed-only`}>
            {(visibleItems) => (
              <ul className="space-y-2">
                {visibleItems.map((task) => (
                  <RecordListCard
                    key={task.id}
                    task={task}
                    showDueBadge={false}
                    onOpen={cardProps.onOpenDetail}
                    menuOpenId={cardProps.menuOpenId}
                    setMenuOpenId={cardProps.setMenuOpenId}
                    onDelete={cardProps.onDelete}
                    onSendToCalendar={cardProps.onSendToCalendar}
                  />
                ))}
              </ul>
            )}
          </PaginatedListSection>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
          {DUE_COLUMNS.map((col) => (
            <TaskListColumn
              key={col.key}
              columnKey={col.key}
              label={col.label}
              headerClass={col.headerClass}
              items={groups[col.key]}
              listResetKey={`${listResetKey}:${col.key}`}
              enableColumnSearch
              columnSearchPlaceholder={col.searchPlaceholder}
              currentUserId={currentUserId}
              showCreatedBy={cardProps.showCreatedBy}
              showDueBadge={col.key === "future"}
              menuOpenId={cardProps.menuOpenId}
              setMenuOpenId={cardProps.setMenuOpenId}
              onOpenDetail={cardProps.onOpenDetail}
              onDelete={cardProps.onDelete}
              onSendToCalendar={cardProps.onSendToCalendar}
            />
          ))}
        </div>
      )}

      {!completedOnly && completedSorted.length > 0 && (
        <div
          className="rounded-lg border border-gray-200 p-2"
          style={{ backgroundColor: "var(--metro-card-bg)" }}
        >
          <h2 className="typo-subsection-title text-gray-600 px-2 py-1 mb-2">
            Tamamlanan ({completedSorted.length})
          </h2>
          {usesFlatLayout ? (
            renderFlatItems(completedSorted, `${listResetKey}:flat-completed`)
          ) : (
            <PaginatedListSection items={completedSorted} resetKey={`${listResetKey}:completed`}>
              {(visibleItems) => (
              <ul className="space-y-2">
                {visibleItems.map((task) => (
                  <RecordListCard
                    key={task.id}
                    task={task}
                    showDueBadge={false}
                    onOpen={cardProps.onOpenDetail}
                    menuOpenId={cardProps.menuOpenId}
                    setMenuOpenId={cardProps.setMenuOpenId}
                    onDelete={cardProps.onDelete}
                    onSendToCalendar={cardProps.onSendToCalendar}
                  />
                ))}
              </ul>
              )}
            </PaginatedListSection>
          )}
        </div>
      )}
    </div>
  );
}
