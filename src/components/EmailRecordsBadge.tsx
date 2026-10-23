"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  isAdmin?: boolean;
  variant?: "dropdown";
  onTotalCountChange?: (count: number) => void;
}

export function EmailRecordsBadge({
  isAdmin,
  variant,
  onTotalCountChange,
}: Props) {
  const [myCount, setMyCount] = useState(0);
  const [unknownCount, setUnknownCount] = useState(0);
  const pathname = usePathname();
  const callbackRef = useRef(onTotalCountChange);
  callbackRef.current = onTotalCountChange;

  const fetchCounts = () => {
    fetch("/api/email-records/counts")
      .then((r) => r.json())
      .then((d) => {
        setMyCount(d.myPendingCount ?? 0);
        setUnknownCount(d.unknownPendingCount ?? 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchCounts();
    const t = setInterval(fetchCounts, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    callbackRef.current?.(myCount + (isAdmin ? unknownCount : 0));
  }, [myCount, unknownCount, isAdmin]);

  const isDropdown = variant === "dropdown";

  const linkClass = (path: string) => {
    const active = pathname === path || pathname.startsWith(path + "/");
    if (isDropdown) {
      return `relative block px-4 py-2.5 text-sm transition ${
        active
          ? "text-indigo-700 bg-indigo-50 font-medium"
          : "text-gray-700 hover:bg-gray-50"
      }`;
    }
    return "relative px-4 py-2 rounded-md text-gray-700 hover:bg-black/5 font-medium transition";
  };

  const badgePositionClass = isDropdown
    ? "ml-2 inline-flex"
    : "absolute -top-1 -right-1 flex";

  const emailBadgeCount = isDropdown
    ? myCount + (isAdmin ? unknownCount : 0)
    : myCount;

  return (
    <>
      <Link
        href="/dashboard/email-records"
        className={linkClass("/dashboard/email-records")}
        role={isDropdown ? "menuitem" : undefined}
      >
        E-posta Kayıtları
        {emailBadgeCount > 0 && (
          <span
            className={`${badgePositionClass} min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-red-500 text-white text-xs font-medium leading-none`}
          >
            {emailBadgeCount > 99 ? "99+" : emailBadgeCount}
          </span>
        )}
      </Link>
      {isAdmin && !isDropdown && (
        <Link
          href="/dashboard/unknown-email-records"
          className={linkClass("/dashboard/unknown-email-records")}
          role={isDropdown ? "menuitem" : undefined}
        >
          Bilinmeyen Kayıtlar
          {unknownCount > 0 && (
            <span
              className={`${badgePositionClass} min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-medium leading-none`}
            >
              {unknownCount > 99 ? "99+" : unknownCount}
            </span>
          )}
        </Link>
      )}
    </>
  );
}
