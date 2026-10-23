"use client";

import { useDroppable } from "@dnd-kit/core";
import { TaskCard } from "./TaskCard";

interface Task {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  dueDate: string;
  assignee?: { displayName: string };
  project?: { name: string };
}

interface NotlarColumnProps {
  id: string;
  title: string;
  tasks: Task[];
}

export function NotlarColumn({ id, title, tasks }: NotlarColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 min-h-[420px] rounded-r-lg shadow-lg overflow-hidden ${isOver ? "ring-2 ring-[var(--metro-tile-notlar)] ring-offset-2" : ""}`}
      style={{
        background: "var(--notebook-paper)",
        backgroundImage: `repeating-linear-gradient(
          transparent,
          transparent 31px,
          var(--notebook-line) 31px,
          var(--notebook-line) 32px
        )`,
        borderLeft: "8px solid var(--notebook-margin)",
        boxShadow: "4px 0 8px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.04)",
      }}
    >
      <div className="pl-4 pr-3 pt-4 pb-4" style={{ paddingLeft: "1rem" }}>
        <h3 className="font-semibold mb-3 flex items-center justify-between text-gray-800 border-b border-[var(--notebook-line)] pb-2">
          {title}
          <span className="text-sm font-normal text-gray-500 bg-[var(--notebook-paper)] px-2 rounded">
            {tasks.length}
          </span>
        </h3>
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </div>
    </div>
  );
}
