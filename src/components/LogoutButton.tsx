"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      type="button"
      className="px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-black/5 transition"
    >
      Çıkış
    </button>
  );
}
