"use client";

import { PaginatedListSection, LIST_PAGE_SIZE } from "@/components/PaginatedListSection";
import type { TaskListItem } from "@/lib/task-list";
import type { ReactNode } from "react";

export const TASK_LIST_PAGE_SIZE = LIST_PAGE_SIZE;

interface TaskListPaginatedSectionProps {
  items: TaskListItem[];
  resetKey: string;
  children: (visibleItems: TaskListItem[]) => ReactNode;
  emptyMessage?: string;
}

/** @deprecated PaginatedListSection kullanın; geriye dönük uyumluluk için bırakıldı. */
export function TaskListPaginatedSection(props: TaskListPaginatedSectionProps) {
  return <PaginatedListSection {...props} />;
}
