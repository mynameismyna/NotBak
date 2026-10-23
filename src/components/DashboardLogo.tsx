"use client";

import { useState } from "react";

export function DashboardLogo() {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className="relative w-9 h-9 flex items-center justify-center rounded-lg overflow-hidden bg-[var(--metro-tile-projeler)] shrink-0"
      style={{ minWidth: 36, minHeight: 36 }}
    >
      {!failed ? (
        <img
          src="/notbak_logo.png"
          alt="NotBak"
          className="w-full h-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="text-white font-bold text-sm flex items-center justify-center w-full h-full"
          aria-hidden
        >
          NB
        </span>
      )}
    </span>
  );
}
