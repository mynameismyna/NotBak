"use client";

import Link from "next/link";

interface DashboardStatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  href?: string;
  variant?: "default" | "warning" | "success" | "info";
  borderColor?: string;
}

const VARIANT_STYLES: Record<string, { bg: string; border: string }> = {
  default: { bg: "var(--metro-tile-projeler)", border: "rgba(255,255,255,0.2)" },
  warning: { bg: "var(--metro-tile-gorevler)", border: "rgba(255,255,255,0.2)" },
  success: { bg: "var(--metro-tile-notlar)", border: "rgba(255,255,255,0.2)" },
  info: { bg: "#d97706", border: "rgba(255,255,255,0.2)" },
};

export function DashboardStatsCard({
  title,
  value,
  subtitle,
  href,
  variant = "default",
  borderColor,
}: DashboardStatsCardProps) {
  const style = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default;
  const content = (
    <div
      className={`group rounded-xl overflow-hidden shadow-xl transition-all duration-200 h-full flex flex-col ${
        href ? "hover:shadow-2xl hover:scale-[1.02] cursor-pointer" : ""
      }`}
      style={{
        backgroundColor: style.bg,
        borderLeft: borderColor ? `4px solid ${borderColor}` : undefined,
      }}
    >
      <div className="p-6 text-white flex-1 flex flex-col min-h-[120px]">
        <h3 className="text-sm font-medium opacity-90">{title}</h3>
        <p className="text-3xl font-bold mt-1">{value}</p>
        {subtitle && <p className="text-sm mt-2 opacity-80 line-clamp-2">{subtitle}</p>}
      </div>
      {href && <div className="h-1 bg-white/20 group-hover:bg-white/30 transition" />}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }
  return content;
}
