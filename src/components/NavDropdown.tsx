"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface NavDropdownProps {
  label: string;
  activePaths: string[];
  badgeCount?: number;
  children: React.ReactNode;
}

export function NavDropdown({
  label,
  activePaths,
  badgeCount,
  children,
}: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const isActive = activePaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`relative px-4 py-2 rounded-md font-medium transition flex items-center gap-1.5 ${
          isActive
            ? "text-indigo-700 bg-black/5"
            : "text-gray-700 hover:bg-black/5"
        }`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {label}
        {!open && badgeCount != null && badgeCount > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-medium leading-none">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 min-w-[210px] py-1 rounded-lg shadow-xl border border-gray-200 bg-white z-50"
          role="menu"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface NavDropdownItemProps {
  href: string;
  children: React.ReactNode;
}

export function NavDropdownItem({ href, children }: NavDropdownItemProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`block px-4 py-2.5 text-sm transition ${
        active
          ? "text-indigo-700 bg-indigo-50 font-medium"
          : "text-gray-700 hover:bg-gray-50"
      }`}
      role="menuitem"
    >
      {children}
    </Link>
  );
}
