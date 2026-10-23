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

interface RecordListTableProps {
  tasks: TaskListItem[];
  menuOpenId: string | null;
  setMenuOpenId: (id: string | null) => void;
  onOpen: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onSendToCalendar?: (taskId: string) => void;
}

/** Kayıtların sütunlara göre hızlı karşılaştırılmasını sağlayan tablo görünümü. */
export function RecordListTable({
  tasks,
  menuOpenId,
  setMenuOpenId,
  onOpen,
  onDelete,
  onSendToCalendar,
}: RecordListTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-[var(--metro-card-bg)] shadow-sm">
      <table className="w-full min-w-[780px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-600">
            <th className="px-3 py-3">Kayıt</th>
            <th className="px-3 py-3">Tip</th>
            <th className="px-3 py-3">Durum</th>
            <th className="px-3 py-3">Öncelik</th>
            <th className="px-3 py-3 whitespace-nowrap">Son tarih</th>
            <th className="px-3 py-3">Sorumlu</th>
            <th className="px-3 py-3">Proje</th>
            <th className="w-10 px-2 py-3"><span className="sr-only">İşlemler</span></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const isCompleted = task.status === "TAMAMLANDI";
            const isOverdue = dueCategory(task.dueDate, task.status) === "OVERDUE" && !isCompleted;
            return (
              <tr
                key={task.id}
                className={`border-b border-gray-100 transition hover:bg-gray-50/80 ${
                  isCompleted ? "text-gray-500" : ""
                } ${isOverdue ? "border-l-[3px] border-l-red-500" : ""}`}
              >
                <td className="max-w-[19rem] px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => onOpen(task.id)}
                    className={`block max-w-full truncate text-left typo-card-title hover:underline btn-focus-clean ${
                      isCompleted ? "line-through text-gray-500" : ""
                    }`}
                    title={task.title}
                  >
                    {task.title}
                  </button>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className={`typo-badge rounded px-1.5 py-0.5 ${typeBadgeClass(task.type)}`}>
                    {TYPE_LABELS[task.type] ?? task.type}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className={`typo-badge rounded px-1.5 py-0.5 ${statusBadgeClass(task.status)}`}>
                    {STATUS_LABELS[task.status] ?? task.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className={`typo-badge rounded px-1.5 py-0.5 ${priorityBadgeClass(task.priority)}`}>
                    {PRIORITY_LABELS[task.priority] ?? task.priority}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">
                  {formatDueLabel(task.dueDate, task.status)}
                </td>
                <td className="max-w-[10rem] truncate px-3 py-2.5 text-gray-600" title={getAssigneeLabel(task)}>
                  {getAssigneeLabel(task)}
                </td>
                <td className="max-w-[10rem] truncate px-3 py-2.5 text-gray-600" title={task.project?.name}>
                  {task.project?.name ?? "—"}
                </td>
                <td className="px-2 py-2.5">
                  <RecordListActions
                    task={task}
                    menuOpenId={menuOpenId}
                    setMenuOpenId={setMenuOpenId}
                    onOpen={onOpen}
                    onDelete={onDelete}
                    onSendToCalendar={onSendToCalendar}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
