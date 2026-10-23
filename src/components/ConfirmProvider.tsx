"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { ModalShell } from "@/components/ModalShell";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    return {
      confirm: async (options: ConfirmOptions) =>
        typeof window !== "undefined" ? window.confirm(options.message) : true,
    };
  }
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<
    | (ConfirmOptions & {
        resolve: (value: boolean) => void;
      })
    | null
  >(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        title: options.title ?? "Onay",
        message: options.message,
        confirmLabel: options.confirmLabel ?? "Evet",
        cancelLabel: options.cancelLabel ?? "Vazgeç",
        resolve,
      });
    });
  }, []);

  const handleClose = (result: boolean) => {
    if (state) {
      state.resolve(result);
      setState(null);
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ModalShell
        open={!!state}
        onClose={() => handleClose(false)}
        layer="confirm"
        closeOnBackdrop
        panelClassName="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6"
      >
        {state && (
          <>
            <h3 className="typo-modal-title mb-2">{state.title}</h3>
            <p className="text-sm text-gray-700 mb-4 whitespace-pre-wrap">{state.message}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {state.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => handleClose(true)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                {state.confirmLabel}
              </button>
            </div>
          </>
        )}
      </ModalShell>
    </ConfirmContext.Provider>
  );
}
