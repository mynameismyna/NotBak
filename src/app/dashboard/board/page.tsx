"use client";

import { useState, useEffect } from "react";
import { ModalShell } from "@/components/ModalShell";
import { NotlarBoard } from "@/components/NotlarBoard";
import { TaskForm } from "@/components/TaskForm";
import { ExcelImportButton } from "@/components/ExcelImportButton";
import { AppSelect } from "@/components/AppSelect";
export default function BoardPage() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [newTaskType, setNewTaskType] = useState<string>("NOT");
  const [newTaskPrivate, setNewTaskPrivate] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="typo-page-title">Notlar</h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          {projects.length > 0 && (
            <AppSelect
              value={projectId}
              onChange={(v) => setProjectId(v)}
              size="sm"
              triggerClassName="shadow font-medium"
              aria-label="Proje filtresi"
            >
              <option value="">Tüm Projeler</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </AppSelect>
          )}
          <ExcelImportButton type="NOT" onSuccess={() => setRefreshTrigger((t) => t + 1)} />
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2.5 rounded-lg text-sm font-medium shadow-lg transition border-0"
            style={{ backgroundColor: "var(--metro-tile-notlar)", color: "white" }}
          >
            Yeni
          </button>
        </div>
      </div>
      <div
        className="rounded-xl p-4 pb-6"
        style={{
          background: "linear-gradient(135deg, var(--notebook-binding) 0%, var(--notebook-paper) 24px)",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <NotlarBoard projectId={projectId || undefined} refreshTrigger={refreshTrigger} />
      </div>
      <ModalShell
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setNewTaskType("NOT");
          setNewTaskPrivate(true);
        }}
        layer="base"
        ariaLabelledBy="new-note-modal-title"
        panelClassName="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-xl p-6 bg-white"
      >
        {showForm && (
          <>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <h2 id="new-note-modal-title" className="typo-modal-title shrink-0">
                  Yeni
                </h2>
                <AppSelect
                  value={newTaskType}
                  onChange={(v) => setNewTaskType(v)}
                  size="sm"
                  aria-label="Tip"
                >
                  <option value="GOREV">Görev</option>
                  <option value="NOT">Not</option>
                  <option value="FIKIR">Fikir</option>
                </AppSelect>
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={newTaskPrivate}
                    onChange={(e) => setNewTaskPrivate(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    aria-label="Bana Özel"
                  />
                  <span className="text-sm font-medium text-gray-700">Bana Özel</span>
                </label>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setNewTaskType("NOT");
                    setNewTaskPrivate(true);
                  }}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 shrink-0"
                  aria-label="Kapat"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <TaskForm
                defaultProjectId={projectId || undefined}
                taskId={undefined}
                initialData={undefined}
                type={newTaskType}
                onTypeChange={setNewTaskType}
                isPrivate={newTaskPrivate}
                onPrivateChange={setNewTaskPrivate}
                onSuccess={() => {
                  setShowForm(false);
                  setNewTaskType("NOT");
                  setNewTaskPrivate(true);
                  setRefreshTrigger((t) => t + 1);
                }}
                onCancel={() => {
                  setShowForm(false);
                  setNewTaskType("NOT");
                  setNewTaskPrivate(true);
                }}
              />
          </>
        )}
      </ModalShell>
    </div>
  );
}
