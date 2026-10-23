"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { MODAL_Z, type ModalLayer } from "@/lib/modal-layer";
import { useOverlayEscape } from "@/lib/overlay-escape";

export interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** z-index katmanı (varsayılan: base) */
  layer?: ModalLayer;
  /** Dışarı tıklayınca kapat (varsayılan: true) */
  closeOnBackdrop?: boolean;
  /** Escape ile kapat (varsayılan: true) */
  closeOnEscape?: boolean;
  overlayClassName?: string;
  panelClassName?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

export function ModalShell({
  open,
  onClose,
  children,
  layer = "base",
  closeOnBackdrop = true,
  closeOnEscape = true,
  overlayClassName = "",
  panelClassName = "",
  ariaLabelledBy,
  ariaDescribedBy,
}: ModalShellProps) {
  useOverlayEscape(open, onClose, MODAL_Z[layer], closeOnEscape);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 bg-black/50 ${overlayClassName}`.trim()}
      style={{ zIndex: MODAL_Z[layer] }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div className={panelClassName} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}
