"use client";

import { RecordListActions } from "@/components/RecordListActions";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  dueCategory,
  formatDueLabel,
  getAssigneeLabel,
  priorityBadgeClass,
  statusBadgeClass,
  typeBadgeClass,
  type TaskListItem,
} from "@/lib/task-list";

interface RecordListRowProps {
  task: TaskListItem;
  menuOpenId: string | null;
  setMenuOpenId: (id: string | null) => void;
  onOpen: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onSendToCalendar?: (taskId: string) => void;
}

/** Kayıtların yoğun bilgi içeren, tek satırlık görünümü. */
export function RecordListRow({
  task,
  menuOpenId,
  setMenuOpenId,
  onOpen,
  onDelete,
  onSendToCalendar,
}: RecordListRowProps) {
  const isCompleted = task.status === "TAMAMLANDI";
  const isOverdue = dueCategory(task.dueDate, task.status) === "OVERDUE" && !isCompleted;

  return (
    <li
      className={`flex items-center gap-3 rounded-lg border bg-[var(--metro-card-bg)] px-3 py-2 shadow-sm transition hover:shadow-md ${
        isOverdue ? "border-l-[3px] border-l-red-500 border-red-200" : "border-gray-100"
      } ${isCompleted ? "opacity-75" : ""}`}
    >
      <button
        type="button"
        onClick={() => onOpen(task.id)}
        className="min-w-0 flex-1 text-left btn-focus-clean"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className={`typo-card-title truncate ${isCompleted ? "line-through text-gray-500" : ""}`}>
            {task.title}
          </h3>
          <span className="text-xs text-gray-500">{formatDueLabel(task.dueDate, task.status)}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {[getAssigneeLabel(task), task.project?.name].filter(Boolean).join(" · ") || "—"}
        </p>
      </button>
      <div className="hidden sm:flex shrink-0 flex-wrap justify-end gap-1">
        <span className={`typo-badge rounded px-1.5 py-0.5 ${typeBadgeClass(task.type)}`}>
          {TYPE_LABELS[task.type] ?? task.type}
        </span>
        <span className={`typo-badge rounded px-1.5 py-0.5 ${statusBadgeClass(task.status)}`}>
          {STATUS_LABELS[task.status] ?? task.status}
        </span>
        <span className={`typo-badge rounded px-1.5 py-0.5 ${priorityBadgeClass(task.priority)}`}>
          {PRIORITY_LABELS[task.priority] ?? task.priority}
        </span>
      </div>
      <RecordListActions
        task={task}
        menuOpenId={menuOpenId}
        setMenuOpenId={setMenuOpenId}
        onOpen={onOpen}
        onDelete={onDelete}
        onSendToCalendar={onSendToCalendar}
      />
    </li>
  );
}
