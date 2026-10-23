"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface Task {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  dueDate: string;
  assignee?: { displayName: string };
  createdBy?: { displayName: string } | null;
  project?: { name: string };
}

interface TaskCardProps {
  task: Task;
  isDragOverlay?: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  LOW: "bg-gray-100 text-gray-800",
};

export function TaskCard({ task, isDragOverlay }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const transformStyle = transform
    ? { transform: CSS.Translate.toString(transform) }
    : {};
  const cardStyle = {
    ...transformStyle,
    backgroundColor: "var(--metro-card-bg)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  };

  return (
    <div
      ref={setNodeRef}
      style={cardStyle}
      {...listeners}
      {...attributes}
      className={`rounded-lg p-3 cursor-grab active:cursor-grabbing border-l-4 border-[var(--metro-tile-notlar)] ${
        isDragging && !isDragOverlay ? "opacity-50" : ""
      } ${isDragOverlay ? "shadow-lg" : ""}`}
    >
      <Link href={`/dashboard/tasks/${task.id}`} onClick={(e) => isDragging && e.preventDefault()} className="block">
        <h4 className="typo-card-title truncate">{task.title}</h4>
        <p className="typo-caption truncate mt-0.5">{task.description}</p>
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_COLORS[task.priority] || "bg-gray-100"}`}>
            {task.priority === "URGENT" ? "Acil" : task.priority === "HIGH" ? "Yüksek" : task.priority === "MEDIUM" ? "Orta" : "Düşük"}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(task.dueDate).toLocaleDateString("tr-TR")}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
          {task.assignee && <span>Sorumlu: {task.assignee.displayName}</span>}
          {task.createdBy && <span>Ekleyen: {task.createdBy.displayName}</span>}
        </div>
      </Link>
    </div>
  );
}
