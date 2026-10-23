"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatUserDisplayName } from "@/lib/display-name";

export interface UserMenuUser {
  displayName?: string | null;
  email: string;
  /** false ise "Parola değiştir" gizlenir (LDAP kullanıcıları). */
  canChangePassword?: boolean;
}

export function UserMenu({ user }: { user: UserMenuUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayLabel = formatUserDisplayName(user.displayName) || user.email;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-gray-700 hover:bg-black/5 transition"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Kullanıcı menüsü"
      >
        <span className="truncate max-w-[180px]">{displayLabel}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 py-1 min-w-[180px] rounded-lg shadow-lg border border-gray-200 bg-white z-50"
          role="menu"
        >
          {user.canChangePassword !== false && (
            <Link
              href="/dashboard/settings/password"
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Parola değiştir
            </Link>
          )}
          <Link
            href="/dashboard/settings/email-notifications"
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            E-posta bilgilendirme
          </Link>
          <button
            type="button"
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-b-lg"
            role="menuitem"
            onClick={handleLogout}
          >
            Oturumu Kapat
          </button>
        </div>
      )}
    </div>
  );
}
