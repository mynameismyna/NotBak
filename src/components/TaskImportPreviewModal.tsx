"use client";

import { formatUserDisplayName } from "@/lib/display-name";

import { useState, useEffect } from "react";
import type { TaskType, TaskStatus, Priority } from "@/types";
import { ModalShell } from "@/components/ModalShell";
import { AppSelect } from "@/components/AppSelect";

export interface PreviewRow {
  index: number;
  title: string;
  description: string;
  type: TaskType;
  isPrivate: boolean;
  priority: Priority;
  dueDate: string;
  status: TaskStatus;
  assigneeId: string;
  projectId: string | null;
}

interface UserOption {
  id: string;
  displayName: string;
  email: string;
}

interface ProjectOption {
  id: string;
  name: string;
  ownerId: string | null;
}

interface TaskImportPreviewModalProps {
  open: boolean;
  rows: PreviewRow[];
  users: UserOption[];
  projects: ProjectOption[];
  currentUserId: string;
  onClose: () => void;
  onConfirm: (rows: PreviewRow[]) => Promise<void> | void;
}

const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: "GOREV", label: "Görev" },
  { value: "NOT", label: "Not" },
  { value: "FIKIR", label: "Fikir" },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "URGENT", label: "Acil" },
  { value: "HIGH", label: "Yüksek" },
  { value: "MEDIUM", label: "Orta" },
  { value: "LOW", label: "Düşük" },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "YENI", label: "Yeni" },
  { value: "DEVAM_EDIYOR", label: "Devam Ediyor" },
  { value: "BEKLEMEDE", label: "Beklemede" },
  { value: "TAMAMLANDI", label: "Tamamlandı" },
];

function truncate(text: string, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;
  const sliced = text.slice(0, max);
  // Kelime ortasından bölmemek için son boşluk/linebreak karakterini bul
  const lastSpace = Math.max(
    sliced.lastIndexOf(" "),
    sliced.lastIndexOf("\n"),
    sliced.lastIndexOf("\t")
  );
  const cutIndex = lastSpace > 0 ? lastSpace : max;
  return `${sliced.slice(0, cutIndex).trimEnd()}...`;
}

export function TaskImportPreviewModal({
  open,
  rows,
  users,
  projects,
  currentUserId,
  onClose,
  onConfirm,
}: TaskImportPreviewModalProps) {
  const [localRows, setLocalRows] = useState<PreviewRow[]>(rows);
  const [submitting, setSubmitting] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  // Önizleme her açıldığında veya satırlar değiştiğinde tabloyu güncelle
  useEffect(() => {
    if (open) {
      setLocalRows(
        rows.map((r) => ({
          ...r,
          isPrivate: r.projectId ? false : r.isPrivate,
        }))
      );
      setDetailIndex(null);
    }
  }, [rows, open]);

  if (!open) return null;

  const handleChange = <K extends keyof PreviewRow>(index: number, key: K, value: PreviewRow[K]) => {
    setLocalRows((prev) =>
      prev.map((r) => (r.index === index ? { ...r, [key]: value } : r))
    );
  };

  const handleProjectChange = (index: number, projectId: string | null) => {
    const project = projects.find((p) => p.id === projectId);
    setLocalRows((prev) =>
      prev.map((r) => {
        if (r.index !== index) return r;
        const next: PreviewRow = {
          ...r,
          projectId,
          isPrivate: projectId ? false : r.isPrivate,
        };
        if (project?.ownerId) {
          next.assigneeId = project.ownerId;
        }
        return next;
      })
    );
  };

  const handlePrivateChange = (index: number, checked: boolean) => {
    setLocalRows((prev) =>
      prev.map((r) =>
        r.index === index
          ? {
              ...r,
              isPrivate: checked,
              ...(checked ? { projectId: null } : {}),
            }
          : r
      )
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const normalizedRows = localRows.map((r) => ({
        ...r,
        isPrivate: r.projectId ? false : r.isPrivate,
      }));
      await onConfirm(normalizedRows);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ModalShell
        open={open}
        onClose={onClose}
        layer="base"
        overlayClassName="p-2 sm:p-4"
        panelClassName="w-[95vw] max-w-[90rem] max-h-[90vh] overflow-y-auto rounded-xl shadow-xl p-4 sm:p-6 bg-white"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="typo-modal-title">Toplu Yükleme Önizleme</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            disabled={submitting}
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Excel&apos;den gelen kayıtları satır bazında kontrol edip gerekli alanları doldurun. Kaydı
          oluşturmadan önce &quot;Kayıt Tipi&quot;, &quot;Öncelik&quot;, &quot;Son Tarih&quot; (görevler için),
          &quot;Sorumlu&quot; ve &quot;Durum&quot; alanları gözden geçirilmelidir.
        </p>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-xs table-auto">
            <colgroup>
              {/* Başlık ve Açıklama: içeriğe göre genişler, metinler truncate edilir */}
              <col />
              <col />
              {/* Diğerleri tamamen içeriğe göre */}
              <col />
              <col />
              <col />
              <col />
              <col />
              <col />
              <col />
              <col />
            </colgroup>
            <thead className="bg-gray-100">
              <tr>
                <th className="px-1 py-0.5 text-left font-medium text-gray-700 whitespace-nowrap">
                  Bana Özel
                </th>
                <th className="px-1 py-0.5 text-left font-medium text-gray-700">Başlık</th>
                <th className="px-1 py-0.5 text-left font-medium text-gray-700">Açıklama</th>
                <th className="px-1 py-0.5 text-left font-medium text-gray-700 whitespace-nowrap">
                  Kayıt Tipi
                </th>
                <th className="px-1 py-0.5 text-left font-medium text-gray-700">Öncelik</th>
                <th className="px-1 py-0.5 text-left font-medium text-gray-700">Son Tarih</th>
                <th className="px-1 py-0.5 text-left font-medium text-gray-700">Durum</th>
                <th className="px-1 py-0.5 text-left font-medium text-gray-700">Proje</th>
                <th className="px-1 py-0.5 text-left font-medium text-gray-700">Sorumlu</th>
                <th className="px-1 py-0.5 text-left font-medium text-gray-700">Detay</th>
              </tr>
            </thead>
            <tbody>
              {localRows.map((row) => {
                const isTask = row.type === "GOREV";
                const projectForRow = projects.find((p) => p.id === row.projectId);
                const projectHasOwner = !!projectForRow?.ownerId;
                return (
                  <tr key={row.index} className="border-t">
                    <td className="px-1 py-0.5 align-top text-center">
                      <input
                        type="checkbox"
                        checked={row.isPrivate}
                        disabled={!!row.projectId}
                        title={
                          row.projectId
                            ? "Proje seçili kayıtlar Bana Özel olamaz"
                            : undefined
                        }
                        onChange={(e) =>
                          handlePrivateChange(row.index, e.target.checked)
                        }
                        className={row.projectId ? "cursor-not-allowed opacity-50" : ""}
                      />
                    </td>
                    <td className="px-1 py-0.5 align-top">
                      <input
                        type="text"
                        value={row.title}
                        onChange={(e) =>
                          handleChange(row.index, "title", e.target.value)
                        }
                        className="w-full border-0 bg-transparent px-1 py-0.5 text-xs outline-none shadow-none focus:outline-none focus:ring-0"
                        aria-label="Başlık"
                      />
                    </td>
                    <td className="px-1 py-0.5 align-top">
                      <textarea
                        value={row.description}
                        onChange={(e) =>
                          handleChange(row.index, "description", e.target.value)
                        }
                        className="w-full border-0 bg-transparent px-1 py-0.5 text-xs outline-none shadow-none focus:outline-none focus:ring-0 min-h-[2.25rem] resize-y whitespace-pre-line"
                        aria-label="Açıklama"
                      />
                    </td>
                    <td className="px-1 py-0.5 align-top">
                      <AppSelect
                        value={row.type}
                        onChange={(v) =>
                          handleChange(row.index, "type", v as TaskType)
                        }
                        size="sm"
                      >
                        {TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </AppSelect>
                    </td>
                    <td className="px-1 py-0.5 align-top">
                      <AppSelect
                        value={row.priority}
                        onChange={(v) =>
                          handleChange(row.index, "priority", v as Priority)
                        }
                        size="sm"
                      >
                        {PRIORITY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </AppSelect>
                    </td>
                    <td className="px-1 py-0.5 align-top">
                      <input
                        type="date"
                        value={row.dueDate}
                        onChange={(e) =>
                          handleChange(row.index, "dueDate", e.target.value || row.dueDate)
                        }
                        className="border rounded px-1 py-0.5 text-xs"
                        required={isTask}
                      />
                    </td>
                    <td className="px-1 py-0.5 align-top">
                      <AppSelect
                        value={row.status}
                        onChange={(v) =>
                          handleChange(row.index, "status", v as TaskStatus)
                        }
                        size="sm"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </AppSelect>
                    </td>
                    <td className="px-1 py-0.5 align-top">
                      <AppSelect
                        value={row.projectId || ""}
                        onChange={(v) =>
                          handleProjectChange(row.index, v || null)
                        }
                        size="sm"
                      >
                        <option value="">(Proje Yok)</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {truncate(p.name, 40)}
                          </option>
                        ))}
                      </AppSelect>
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <AppSelect
                        value={row.assigneeId || currentUserId}
                        onChange={(v) =>
                          handleChange(row.index, "assigneeId", v || currentUserId)
                        }
                        disabled={projectHasOwner}
                        size="sm"
                      >
                        <option value={currentUserId}>Yükleyen Kullanıcı</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {truncate(formatUserDisplayName(u.displayName) || u.email, 40)}
                          </option>
                        ))}
                      </AppSelect>
                    </td>
                    <td className="px-1 py-0.5 align-top">
                      <button
                        type="button"
                        onClick={() => setDetailIndex(row.index)}
                        className="px-2 py-0.5 rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-100"
                      >
                        Detay
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            disabled={submitting}
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white shadow-md"
            style={{ backgroundColor: "var(--metro-tile-gorevler)" }}
          >
            {submitting ? "Yükleniyor..." : "Yüklemeyi Tamamla"}
          </button>
        </div>
      </ModalShell>

      <ModalShell
        open={detailIndex !== null}
        onClose={() => setDetailIndex(null)}
        layer="nested"
        panelClassName="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-xl p-6 bg-white"
      >
        {detailIndex !== null && (() => {
            const row = localRows.find((r) => r.index === detailIndex);
            if (!row) return null;
            const isTask = row.type === "GOREV";
            return (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="typo-subsection-title">Kayıt Detayı</h3>
                  <button
                    type="button"
                    onClick={() => setDetailIndex(null)}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <AppSelect
                    value={row.type}
                    onChange={(v) =>
                      handleChange(detailIndex, "type", v as TaskType)
                    }
                    size="sm"
                    aria-label="Kayıt Tipi"
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </AppSelect>
                  <label
                    className={`flex items-center gap-2 shrink-0 ${
                      row.projectId ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                    }`}
                    title={
                      row.projectId
                        ? "Proje seçili kayıtlar Bana Özel olamaz"
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={row.isPrivate}
                      disabled={!!row.projectId}
                      onChange={(e) =>
                        handlePrivateChange(detailIndex, e.target.checked)
                      }
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm font-medium text-gray-700">Bana Özel</span>
                  </label>
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Başlık
                  </label>
                  <input
                    type="text"
                    value={row.title}
                    onChange={(e) =>
                      setLocalRows((prev) =>
                        prev.map((r) =>
                          r.index === detailIndex ? { ...r, title: e.target.value } : r
                        )
                      )
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Açıklama
                  </label>
                  <textarea
                    value={row.description}
                    onChange={(e) =>
                      setLocalRows((prev) =>
                        prev.map((r) =>
                          r.index === detailIndex ? { ...r, description: e.target.value } : r
                        )
                      )
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm min-h-[120px] resize-vertical"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Öncelik
                    </label>
                    <AppSelect
                      value={row.priority}
                      onChange={(v) =>
                        handleChange(detailIndex, "priority", v as Priority)
                      }
                      className="w-full"
                    >
                      {PRIORITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </AppSelect>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Son Tarih {isTask && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="date"
                      value={row.dueDate}
                      onChange={(e) =>
                        handleChange(
                          detailIndex,
                          "dueDate",
                          e.target.value || row.dueDate
                        )
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      required={isTask}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Durum
                    </label>
                    <AppSelect
                      value={row.status}
                      onChange={(v) =>
                        handleChange(detailIndex, "status", v as TaskStatus)
                      }
                      className="w-full"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </AppSelect>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Proje
                    </label>
                    <AppSelect
                      value={row.projectId || ""}
                      onChange={(v) =>
                        handleProjectChange(detailIndex, v || null)
                      }
                      className="w-full"
                    >
                      <option value="">(Proje Yok)</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </AppSelect>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Sorumlu
                  </label>
                  <AppSelect
                    value={row.assigneeId || currentUserId}
                    onChange={(v) =>
                      handleChange(
                        detailIndex,
                        "assigneeId",
                        v || currentUserId
                      )
                    }
                    className="w-full"
                  >
                    <option value={currentUserId}>Yükleyen Kullanıcı</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {formatUserDisplayName(u.displayName) || u.email}
                      </option>
                    ))}
                  </AppSelect>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailIndex(null)}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  >
                    Kapat
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailIndex(null)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white shadow-md"
                    style={{ backgroundColor: "var(--metro-tile-gorevler)" }}
                  >
                    Kaydet
                  </button>
                </div>
              </>
            );
          })()}
      </ModalShell>
    </>
  );
}

