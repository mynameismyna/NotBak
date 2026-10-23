"use client";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

/** Basit skeleton loading bileşeni. */
export function Skeleton({ className = "", width, height }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200/70 ${className}`}
      style={{
        width: width ?? undefined,
        height: height ?? undefined,
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden shadow-lg p-6" style={{ backgroundColor: "var(--metro-card-bg)" }}>
      <Skeleton className="h-5 w-32 mb-4" />
      <Skeleton className="h-10 w-24 mb-2" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}
