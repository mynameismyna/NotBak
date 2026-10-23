"use client";

import type React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import type { PreviewRow } from "./TaskImportPreviewModal";

interface ExcelImportButtonProps {
  type: "NOT" | "GOREV";
  onSuccess?: () => void;
  className?: string;
  /**
   * Varsayılan olarak kendi butonlarını render eder.
   * "controller" modunda ise children bir render-fonksiyonu olarak
   * kontrol callback'lerini alabilir.
   */
  mode?: "buttons" | "controller";
  children?:
    | React.ReactNode
    | ((args: {
        downloadTemplate: () => void;
        openFileDialog: () => void;
        uploading: boolean;
        pendingCount: number | null;
      }) => React.ReactNode);
  /**
   * Eğer set edilirse, dosya seçildiğinde önce /api/tasks/import/preview çağrılır
   * ve sonuç bu callback ile üst bileşene iletilir. Bu durumda /api/tasks/import
   * direkt çağrılmaz; üst bileşen önizleme sonrası commit çağrısını yapar.
   */
  onPreviewResult?: (result: {
    rows: PreviewRow[];
    currentUser: { id: string; displayName?: string; email?: string };
  }) => void;
}

export function ExcelImportButton({
  type,
  onSuccess,
  className,
  mode = "buttons",
  children,
  onPreviewResult,
}: ExcelImportButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPendingCount = useCallback(() => {
    fetch("/api/talepler/counts")
      .then((r) => r.json())
      .then((d) => setPendingCount(d.sentPendingItemCount ?? 0))
      .catch(() => setPendingCount(0));
  }, []);

  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount]);

  const templateName = type === "GOREV" ? "görev" : "not";

  const handleDownloadTemplate = () => {
    window.open(`/api/tasks/template?type=${type}`, "_blank");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMessage(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      if (onPreviewResult) {
        // Önizleme modu
        const res = await fetch("/api/tasks/import/preview", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Önizleme başarısız");
        onPreviewResult(data);
      } else {
        // Eski davranış: doğrudan içe aktarma
        const res = await fetch("/api/tasks/import", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Yükleme başarısız");

        const parts: string[] = [];
        if (data.created > 0) parts.push(`${data.created} kayıt oluşturuldu`);
        if (data.pendingCount > 0) parts.push(`${data.pendingCount} talep onay bekliyor`);
        if (data.errors?.length) parts.push(`${data.errors.length} satır atlandı`);

        setMessage({
          type: "success",
          text: parts.length ? parts.join(". ") : "İşlem tamamlandı.",
        });
        onSuccess?.();
        fetchPendingCount();
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Yükleme başarısız",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const controllerArgs = {
    downloadTemplate: handleDownloadTemplate,
    openFileDialog,
    uploading,
    pendingCount,
  };

  const isRenderProp = typeof children === "function";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {mode === "buttons" && (
          <>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className={`px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition ${className ?? ""}`}
            >
              {templateName.charAt(0).toUpperCase() + templateName.slice(1)} şablonu indir
            </button>
            {pendingCount != null && pendingCount > 0 && (
              <Link
                href="/dashboard/talepler?tab=sent"
                className="px-4 py-2 rounded-lg text-sm font-medium border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition inline-flex items-center gap-1.5"
              >
                <span>Onay Bekleyen</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-semibold text-xs">
                  {pendingCount}
                </span>
              </Link>
            )}
            <button
              type="button"
              onClick={openFileDialog}
              disabled={uploading}
              className={`px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 ${className ?? ""}`}
            >
              {uploading ? "Yükleniyor..." : "Excel'den toplu yükle"}
            </button>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
        />
        {mode === "controller" && isRenderProp
          ? (children as (args: typeof controllerArgs) => React.ReactNode)(controllerArgs)
          : !isRenderProp && children}
      </div>
      {message && (
        <div
          className={`text-sm p-2 rounded-lg ${
            message.type === "success"
              ? "bg-green-100 text-green-800 border border-green-300"
              : "bg-red-100 text-red-800 border border-red-300"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}

