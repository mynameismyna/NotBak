"use client";

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useId,
  type ReactNode,
  isValidElement,
  Children,
} from "react";
import { createPortal } from "react-dom";
import { useOverlayEscape } from "@/lib/overlay-escape";
import { OVERLAY_Z } from "@/lib/overlay-layer";
import { MODAL_Z } from "@/lib/modal-layer";

export interface AppSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

function extractOptionsFromChildren(children: ReactNode): AppSelectOption[] {
  const options: AppSelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "option") {
      const props = child.props as {
        value?: string | number;
        disabled?: boolean;
        children?: ReactNode;
      };
      options.push({
        value: String(props.value ?? ""),
        label: String(props.children ?? "").trim(),
        disabled: props.disabled,
      });
    }
  });
  return options;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 shrink-0 text-gray-600 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export interface AppSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options?: AppSelectOption[];
  children?: ReactNode;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}

/**
 * Kayıtlar menüsü ile uyumlu özel açılır liste (native select yerine).
 */
export function AppSelect({
  id,
  value,
  onChange,
  options: optionsProp,
  children,
  label,
  placeholder = "Seçin",
  disabled = false,
  required,
  className = "",
  triggerClassName = "",
  size = "md",
  "aria-label": ariaLabel,
}: AppSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const optionsFromChildren = useMemo(
    () => (children ? extractOptionsFromChildren(children) : []),
    [children]
  );
  const options = optionsProp ?? optionsFromChildren;

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? (value === "" ? placeholder : value);

  useOverlayEscape(open, () => setOpen(false), OVERLAY_Z.dropdownMenu);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const rootEl = rootRef.current;
      const menuEl = menuRef.current;
      const clickedInsideRoot = !!rootEl && rootEl.contains(target);
      const clickedInsideMenu = !!menuEl && menuEl.contains(target);
      if (!clickedInsideRoot && !clickedInsideMenu) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  function computeMenuStyle() {
    const el = triggerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: Math.max(OVERLAY_Z.dropdownMenu, MODAL_Z.nested + 100),
    } as React.CSSProperties;
  }

  useLayoutEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;

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
  }, [open]);

  const sizeClass = size === "sm" ? "app-select-trigger-sm" : "app-select-trigger-md";

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      {label ? (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </label>
      ) : null}
      <button
        id={id}
        type="button"
        disabled={disabled}
        ref={triggerRef}
        aria-label={ariaLabel ?? label ?? placeholder}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => {
            const next = !o;
            if (next) {
              const initial = computeMenuStyle();
              if (initial) setMenuStyle(initial);
            }
            return next;
          });
        }}
        className={`app-select-trigger ${sizeClass} ${triggerClassName} ${
          disabled ? "app-select-trigger-disabled" : ""
        }`}
      >
        <span className="truncate text-left flex-1">{displayLabel}</span>
        <Chevron open={open} />
      </button>
      {open && !disabled && typeof document !== "undefined" && menuStyle.top != null
        ? createPortal(
            <ul
              ref={menuRef}
              id={listId}
              role="listbox"
              className="app-select-menu"
              style={menuStyle}
            >
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <li key={`${opt.value}-${opt.label}`} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={opt.disabled}
                      onClick={() => !opt.disabled && pick(opt.value)}
                      className={`app-select-item ${isSelected ? "app-select-item-active" : ""} ${
                        opt.disabled ? "app-select-item-disabled" : ""
                      }`}
                    >
                      {opt.label}
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body
          )
        : null}
    </div>
  );
}
