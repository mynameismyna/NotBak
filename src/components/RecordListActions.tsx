"use client";

import { DropdownMenu } from "@/components/DropdownMenu";
import { OVERLAY_Z } from "@/lib/overlay-layer";
import type { TaskListItem } from "@/lib/task-list";

interface RecordListActionsProps {
  task: TaskListItem;
  menuOpenId: string | null;
  setMenuOpenId: (id: string | null) => void;
  onOpen: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onSendToCalendar?: (taskId: string) => void;
}

/** Kayıt liste ve tablo görünümlerinde kullanılan işlem menüsü. */
export function RecordListActions({
  task,
  menuOpenId,
  setMenuOpenId,
  onOpen,
  onDelete,
  onSendToCalendar,
}: RecordListActionsProps) {
  const isMenuOpen = menuOpenId === task.id;
  const isCompleted = task.status === "TAMAMLANDI";

  return (
    <div className="relative" style={isMenuOpen ? { zIndex: OVERLAY_Z.dropdownMenu } : undefined}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpenId(isMenuOpen ? null : task.id);
        }}
        className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 btn-focus-clean"
        aria-label={`${task.title} işlemleri`}
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
          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 btn-focus-clean"
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
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 btn-focus-clean"
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
            title={task.canEdit ? undefined : "Bu kaydı yalnızca sorumlu veya ekleyen silebilir."}
            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:text-gray-400 disabled:hover:bg-white disabled:cursor-not-allowed btn-focus-clean"
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
  );
}
