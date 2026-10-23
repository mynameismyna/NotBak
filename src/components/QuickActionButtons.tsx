"use client";

import { useState } from "react";
import Link from "next/link";
import { TaskForm } from "@/components/TaskForm";
import { ModalShell } from "@/components/ModalShell";

export function QuickActionButtons() {
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskType, setTaskType] = useState<"GOREV" | "NOT" | "FIKIR">("GOREV");

  const openNewTask = (type: "GOREV" | "NOT" | "FIKIR") => {
    setTaskType(type);
    setShowTaskModal(true);
  };

  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={() => openNewTask("GOREV")}
        className="btn-on-gradient-primary px-5 py-2.5 rounded-lg font-medium shadow-lg hover:shadow-xl transition flex items-center gap-2"
      >
        <span className="text-lg">+</span>
        Yeni Görev
      </button>
      <button
        onClick={() => openNewTask("NOT")}
        className="btn-on-gradient-secondary px-5 py-2.5 rounded-lg font-medium shadow-lg hover:shadow-xl transition flex items-center gap-2"
      >
        <span className="text-lg">+</span>
        Yeni Not
      </button>
      <Link
        href="/dashboard/projects"
        className="px-5 py-2.5 rounded-lg font-medium shadow-lg hover:shadow-xl transition flex items-center gap-2 border-2 border-white/40 text-white hover:bg-white/10"
      >
        <span className="text-lg">+</span>
        Yeni Proje
      </Link>

      <ModalShell
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        layer="base"
        ariaLabelledBy="quick-action-modal-title"
        panelClassName="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl shadow-xl bg-white"
      >
        <div className="px-6 pt-6 pb-4 shrink-0">
          <h2 id="quick-action-modal-title" className="typo-modal-title">
            {taskType === "GOREV" ? "Yeni Görev" : taskType === "NOT" ? "Yeni Not" : "Yeni Fikir"}
          </h2>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        <TaskForm
          type={taskType}
          onTypeChange={() => {}}
          onSuccess={() => setShowTaskModal(false)}
          onCancel={() => setShowTaskModal(false)}
        />
        </div>
      </ModalShell>
    </div>
  );
}
