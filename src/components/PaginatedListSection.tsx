"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";

export const LIST_PAGE_SIZE = 5;

interface PaginatedListSectionProps<T extends { id: string }> {
  items: T[];
  resetKey: string;
  children: (visibleItems: T[]) => ReactNode;
  emptyMessage?: string;
}

/** İlk 5 öğe; yalnızca "Daha fazla göster" ile 5'er ek yükler. */
export function PaginatedListSection<T extends { id: string }>({
  items,
  resetKey,
  children,
  emptyMessage = "Kayıt yok",
}: PaginatedListSectionProps<T>) {
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(LIST_PAGE_SIZE);
  }, [resetKey]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;
  const remaining = items.length - visibleCount;

  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + LIST_PAGE_SIZE, items.length));
  }, [items.length]);

  if (items.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-4">{emptyMessage}</p>;
  }

  return (
    <>
      {children(visibleItems)}
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          className="mt-2 w-full py-2 text-xs font-medium text-[var(--metro-tile-gorevler)] hover:text-[var(--btn-primary-hover)] bg-white/80 hover:bg-white rounded-lg border border-gray-200 transition btn-focus-clean"
        >
          Daha fazla göster ({remaining} kalan)
        </button>
      )}
    </>
  );
}
