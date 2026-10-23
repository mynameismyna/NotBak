"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { MODAL_Z } from "@/lib/modal-layer";

type ToastType = "success" | "error" | "info";
type Toast = { message: string; type: ToastType };

const ToastContext = createContext<{
  showToast: (message: string, type?: ToastType) => void;
} | null>(null);

const AUTO_DISMISS_MS = 4000;

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: (message: string, type?: ToastType) => {
        if (typeof window !== "undefined") alert(message);
      },
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    setToast({ message, type });
    const t = setTimeout(() => {
      setToast(null);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          className="fixed bottom-6 right-6 max-w-sm rounded-lg px-4 py-3 shadow-xl border flex items-center justify-between gap-3"
          style={{
            zIndex: MODAL_Z.toast,
            ...(toast.type === "success"
              ? { backgroundColor: "#f0fdf4", borderColor: "#22c55e", color: "#166534" }
              : toast.type === "error"
                ? { backgroundColor: "#fef2f2", borderColor: "#ef4444", color: "#991b1b" }
                : { backgroundColor: "#eff6ff", borderColor: "#3b82f6", color: "#1e40af" }),
          }}
          role="alert"
        >
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="shrink-0 text-gray-500 hover:text-gray-700 ml-1 p-0.5"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
