import type { TaskListItem } from "@/lib/task-list";
import { formatUserDisplayName } from "@/lib/display-name";

export interface DashboardTaskRow {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  status: string;
  priority?: string;
  dueDate: string;
  updatedAt?: string;
  assignee?: { id: string; displayName: string; email: string } | null;
  createdBy?: { id: string; displayName: string; email: string } | null;
  project?: { id: string; name: string; ownerId?: string | null } | null;
}

export function toTaskListItem(row: DashboardTaskRow): TaskListItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    type: row.type,
    status: row.status,
    priority: row.priority ?? "MEDIUM",
    dueDate: row.dueDate,
    statusChangedAt: row.updatedAt ?? null,
    assignee: row.assignee
      ? {
          ...row.assignee,
          displayName: formatUserDisplayName(row.assignee.displayName) || "—",
        }
      : { id: "", displayName: "—", email: "" },
    createdBy: row.createdBy
      ? { ...row.createdBy, displayName: formatUserDisplayName(row.createdBy.displayName) }
      : null,
    project: row.project
      ? { name: row.project.name, ownerId: row.project.ownerId ?? null }
      : { name: "" },
  };
}
