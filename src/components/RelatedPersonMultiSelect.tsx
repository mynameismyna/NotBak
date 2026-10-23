"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatUserDisplayName } from "@/lib/display-name";
import { useOverlayEscape } from "@/lib/overlay-escape";
import { MODAL_Z } from "@/lib/modal-layer";

export interface RelatedPersonUser {
  id: string;
  displayName: string;
  email: string;
}

interface RelatedPersonMultiSelectProps {
  users: RelatedPersonUser[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  excludeUserIds?: string[];
  placeholder?: string;
  loading?: boolean;
  emptyMessage?: string;
}

const MENU_Z = MODAL_Z.base + 500;
const MAX_MENU_HEIGHT = 240;

export function RelatedPersonMultiSelect({
  users,
  selectedIds,
  onChange,
  excludeUserIds = [],
  placeholder = "İlgili kişiler seçin...",
  loading = false,
  emptyMessage = "Eklenebilecek başka aktif kullanıcı bulunmuyor.",
}: RelatedPersonMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const exclude = new Set(excludeUserIds.filter(Boolean));
  const options = users.filter((u) => !exclude.has(u.id));

  useOverlayEscape(open, () => setOpen(false), MENU_Z);

  function computeMenuStyle(): React.CSSProperties | null {
    const el = triggerRef.current;
    if (!el || typeof window === "undefined") return null;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const common: React.CSSProperties = {
      position: "fixed",
      left: rect.left,
      width: Math.max(rect.width, 280),
      zIndex: MENU_Z,
      maxHeight: MAX_MENU_HEIGHT,
      overflowY: "auto",
    };
    if (openUp) {
      return {
        ...common,
        bottom: window.innerHeight - rect.top + 4,
        maxHeight: Math.min(MAX_MENU_HEIGHT, spaceAbove),
      };
    }
    return {
      ...common,
      top: rect.bottom + 4,
      maxHeight: Math.min(MAX_MENU_HEIGHT, spaceBelow),
    };
  }

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const next = computeMenuStyle();
      if (next) setMenuStyle(next);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const toggleUser = (userId: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedIds, userId]);
    } else {
      onChange(selectedIds.filter((id) => id !== userId));
    }
  };

  if (loading) {
    return (
      <p className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
        Kullanıcı listesi yükleniyor...
      </p>
    );
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
        {emptyMessage}
      </p>
    );
  }

  const menuReady = menuStyle.top != null || menuStyle.bottom != null;

  return (
    <div ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setOpen((prev) => {
            const next = !prev;
            if (next) {
              const initial = computeMenuStyle();
              if (initial) setMenuStyle(initial);
            }
            return next;
          });
        }}
        className="w-full flex items-center justify-between gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 text-left"
      >
        <span className="text-gray-700 truncate">
          {selectedIds.length === 0 ? placeholder : `${selectedIds.length} kişi seçili`}
        </span>
        <span className="text-gray-400 shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {open && typeof document !== "undefined" && menuReady
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              role="listbox"
              aria-multiselectable="true"
              className="border border-gray-200 rounded-lg bg-white shadow-xl py-1"
              style={menuStyle}
            >
              {options.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(u.id)}
                    onChange={(e) => toggleUser(u.id, e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-gray-800">{formatUserDisplayName(u.displayName)}</span>
                  <span className="text-gray-500 text-xs truncate">({u.email})</span>
                </label>
              ))}
              {selectedIds.length > 0 && (
                <div className="border-t border-gray-100 px-3 py-2 flex gap-2 flex-wrap items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Seçilen kişiler kayıt oluşturulduğunda ilgili kişi olarak eklenecektir.
                  </p>
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    className="text-gray-600 hover:underline text-sm"
                  >
                    Seçimi temizle
                  </button>
                </div>
              )}
            </div>,
            document.body
          )
        : null}

      {selectedIds.length > 0 && (
        <ul className="mt-2 text-sm text-gray-600 space-y-1">
          {selectedIds.map((id) => {
            const u = users.find((x) => x.id === id);
            if (!u) return null;
            return (
              <li key={id} className="flex items-center gap-2">
                <span>{formatUserDisplayName(u.displayName)}</span>
                <button
                  type="button"
                  onClick={() => onChange(selectedIds.filter((x) => x !== id))}
                  className="text-red-600 hover:underline text-xs"
                >
                  Kaldır
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
