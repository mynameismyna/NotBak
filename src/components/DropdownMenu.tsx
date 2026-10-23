"use client";

import { createPortal } from "react-dom";
import { OVERLAY_Z } from "@/lib/overlay-layer";
import { useOverlayEscape } from "@/lib/overlay-escape";

export interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Menü paneli (konumlandırma: absolute right-0 top-full vb.) */
  menuClassName?: string;
}

/**
 * Tam ekran tıklanabilir arka plan (portal) + konumlandırılmış menü paneli.
 * Escape ile kapanır; z-index modalların altındadır.
 */
export function DropdownMenu({ open, onClose, children, menuClassName = "" }: DropdownMenuProps) {
  useOverlayEscape(open, onClose, OVERLAY_Z.dropdownMenu);

  if (!open) return null;

  const backdrop =
    typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0"
            style={{ zIndex: OVERLAY_Z.dropdownBackdrop }}
            aria-hidden
            onClick={onClose}
          />,
          document.body
        )
      : null;

  return (
    <>
      {backdrop}
      <div
        role="menu"
        className={menuClassName}
        style={{ zIndex: OVERLAY_Z.dropdownMenu }}
      >
        {children}
      </div>
    </>
  );
}
