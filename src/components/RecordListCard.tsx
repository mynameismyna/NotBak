"use client";

import { DropdownMenu } from "@/components/DropdownMenu";
import { formatUserDisplayName } from "@/lib/display-name";
import { OVERLAY_Z } from "@/lib/overlay-layer";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  TYPE_LABELS,
  formatDueLabel,
  dueCategory,
  statusBadgeClass,
  typeBadgeClass,
  priorityBadgeClass,
  daysAgoText,
  getAssigneeLabel,
  type TaskListItem,
} from "@/lib/task-list";

/** Başlık + içerik + rozet satırı — tüm kutular aynı yükseklikte. */
export const RECORD_CARD_HEIGHT_CLASS = "h-[8rem]";
const CONTENT_LINE_CLASS = "typo-card-line";

function buildContentLines(
  task: TaskListItem,
  showDueBadge: boolean,
  metaParts: string[]
): string[] {
  const lines: string[] = [];

  if (showDueBadge) {
    const due = formatDueLabel(task.dueDate, task.status);
    if (due && due !== "—") lines.push(due);
  }

  const desc = task.description?.trim();
  if (desc) lines.push(desc);

  const meta = metaParts.filter(Boolean).join(" · ");
  if (meta) lines.push(meta);

  return lines.slice(0, 3);
}

export function RecordListCard({
  task,
  showCreatedBy = false,
  showDueBadge = false,
  forceOverdueAccent = false,
  onOpen,
  menuOpenId,
  setMenuOpenId,
  onDelete,
  onSendToCalendar,
}: {
  task: TaskListItem;
  showCreatedBy?: boolean;
  showDueBadge?: boolean;
  forceOverdueAccent?: boolean;
  onOpen: (taskId: string) => void;
  menuOpenId?: string | null;
  setMenuOpenId?: (id: string | null) => void;
  onDelete?: (id: string) => void;
  onSendToCalendar?: (id: string) => void;
}) {
  const showMenu = Boolean(setMenuOpenId);
  const isCompleted = task.status === "TAMAMLANDI";
  const cat = dueCategory(task.dueDate, task.status);
  const showOverdueAccent = (cat === "OVERDUE" && !isCompleted) || forceOverdueAccent;

  const metaParts: string[] = [getAssigneeLabel(task)];
  if (task.project?.name && !metaParts[0]?.includes(task.project.name)) {
    metaParts.push(task.project.name);
  }
  const updatedShort = daysAgoText(task.statusChangedAt).replace(" güncellendi", "");
  if (updatedShort) metaParts.push(updatedShort);
  if (showCreatedBy && task.createdBy?.displayName) {
    metaParts.push(formatUserDisplayName(task.createdBy.displayName));
  }

  const contentLines = buildContentLines(task, showDueBadge, metaParts);
  const isMenuOpen = showMenu && menuOpenId === task.id;

  return (
    <li
      className={`min-w-0 relative ${RECORD_CARD_HEIGHT_CLASS}`}
      style={isMenuOpen ? { zIndex: OVERLAY_Z.dropdownMenu } : undefined}
    >
      <article
        className={`group relative h-full flex flex-col rounded-lg shadow-sm backdrop-blur border transition hover:shadow-md ${
          isCompleted ? "opacity-75" : ""
        } ${
          showOverdueAccent
            ? "border-red-200 border-l-[3px] border-l-red-500"
            : "border-gray-100"
        } ${isMenuOpen ? "shadow-lg" : ""}`}
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <button
          type="button"
          onClick={() => onOpen(task.id)}
          className={`w-full h-full min-h-0 text-left p-2.5 flex flex-col ${showMenu ? "pr-8" : "pr-2.5"}`}
        >
          <h3
            className={`typo-card-title leading-5 h-5 line-clamp-1 shrink-0 ${
              isCompleted ? "line-through text-gray-500" : ""
            }`}
          >
            {task.title}
          </h3>

          <div className="mt-0.5 h-12 shrink-0 flex flex-col overflow-hidden">
            {contentLines.map((line, index) => (
              <p
                key={index}
                className={`${CONTENT_LINE_CLASS} ${index === 0 && showDueBadge ? "text-gray-500" : ""}`}
              >
                {line}
              </p>
            ))}
          </div>

          <div className="flex flex-wrap gap-1 mt-auto pt-1 min-h-[1.375rem] shrink-0 items-center">
            <span
              className={`typo-badge inline-flex items-center px-1.5 py-0.5 rounded leading-none ${typeBadgeClass(task.type)}`}
            >
              {TYPE_LABELS[task.type] ?? task.type}
            </span>
            <span
              className={`typo-badge inline-flex items-center px-1.5 py-0.5 rounded leading-none ${statusBadgeClass(task.status)}`}
            >
              {STATUS_LABELS[task.status] ?? task.status}
            </span>
            <span
              className={`typo-badge inline-flex items-center px-1.5 py-0.5 rounded leading-none ${priorityBadgeClass(task.priority)}`}
            >
              {PRIORITY_LABELS[task.priority] ?? task.priority}
            </span>
          </div>
        </button>

        {showMenu && setMenuOpenId && (
          <div className="absolute top-1.5 right-1 z-10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(isMenuOpen ? null : task.id);
              }}
              className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--metro-tile-gorevler)]/30"
              aria-label="İşlemler"
              aria-expanded={isMenuOpen}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            <DropdownMenu
              open={isMenuOpen}
              onClose={() => setMenuOpenId(null)}
              menuClassName="absolute right-0 top-full mt-1 w-44 rounded-lg shadow-xl bg-white ring-1 ring-black/10 py-1"
            >
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 outline-none focus:outline-none focus-visible:bg-gray-50"
                    onClick={() => {
                      setMenuOpenId(null);
                      onOpen(task.id);
                    }}
                  >
                    Detay
                  </button>
                  {onSendToCalendar && !isCompleted && (
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 outline-none focus:outline-none focus-visible:bg-gray-50"
                      onClick={() => {
                        setMenuOpenId(null);
                        onSendToCalendar(task.id);
                      }}
                    >
                      Takvime ekle
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!task.canEdit}
                      title={
                        task.canEdit ? undefined : "Bu kaydı yalnızca sorumlu veya ekleyen silebilir."
                      }
                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:text-gray-400 disabled:hover:bg-white disabled:cursor-not-allowed outline-none focus:outline-none focus-visible:bg-red-50"
                      onClick={() => {
                        setMenuOpenId(null);
                        if (task.canEdit) onDelete(task.id);
                      }}
                    >
                      Sil
                    </button>
                  )}
            </DropdownMenu>
          </div>
        )}
      </article>
    </li>
  );
}
