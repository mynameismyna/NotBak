import { STATUS_LABELS } from "@/lib/task-list";
import type { TaskStatus, TaskType } from "@/types";

export type ProjectTaskCounts = {
  total: number;
  completed: number;
  active: number;
  completionPercent: number;
};

export type StatusBreakdownItem = {
  status: TaskStatus;
  label: string;
  count: number;
  percent: number;
};

export type TypeBreakdownItem = {
  type: TaskType;
  label: string;
  count: number;
  percent: number;
  byStatus: StatusBreakdownItem[];
};

export type ProjectStatsPayload = {
  projectId: string;
  projectName: string;
  counts: ProjectTaskCounts;
  byStatus: StatusBreakdownItem[];
  byType: TypeBreakdownItem[];
};

const STATUS_ORDER: TaskStatus[] = [
  "YENI",
  "ONAY_BEKLIYOR",
  "DEVAM_EDIYOR",
  "BEKLEMEDE",
  "TAMAMLANDI",
  "REDDEDILDI",
];

const TYPE_ORDER: TaskType[] = ["GOREV", "NOT", "FIKIR"];

const TYPE_LABELS: Record<TaskType, string> = {
  GOREV: "Görevler",
  NOT: "Notlar",
  FIKIR: "Fikirler",
};

const EMPTY_COUNTS: ProjectTaskCounts = {
  total: 0,
  completed: 0,
  active: 0,
  completionPercent: 0,
};

export function computeProjectTaskCounts(completed: number, total: number): ProjectTaskCounts {
  const active = total - completed;
  const completionPercent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, active, completionPercent };
}

type ProjectStatusRow = {
  projectId: string | null;
  status: string;
  _count: { _all: number };
};

/** groupBy(projectId, status) sonuçlarından proje başına özet sayılar. */
export function aggregateCountsByProject(
  rows: ProjectStatusRow[],
): Map<string, ProjectTaskCounts> {
  const byProject = new Map<string, { total: number; completed: number }>();

  for (const row of rows) {
    if (!row.projectId) continue;
    const count = row._count._all;
    const current = byProject.get(row.projectId) ?? { total: 0, completed: 0 };
    current.total += count;
    if (row.status === "TAMAMLANDI") current.completed += count;
    byProject.set(row.projectId, current);
  }

  const result = new Map<string, ProjectTaskCounts>();
  for (const [projectId, { total, completed }] of byProject) {
    result.set(projectId, computeProjectTaskCounts(completed, total));
  }
  return result;
}

type StatusTypeRow = {
  status: string;
  type: string;
  _count: { _all: number };
};

function buildStatusBreakdown(
  statusCounts: Map<string, number>,
  total: number,
): StatusBreakdownItem[] {
  return STATUS_ORDER.map((status) => {
    const count = statusCounts.get(status) ?? 0;
    const percent = total === 0 ? 0 : Math.round((count / total) * 100);
    return {
      status,
      label: STATUS_LABELS[status] ?? status,
      count,
      percent,
    };
  }).filter((item) => item.count > 0);
}

/** groupBy(status, type) sonuçlarından modal istatistikleri. */
export function buildProjectStatsPayload(
  projectId: string,
  projectName: string,
  rows: StatusTypeRow[],
): ProjectStatsPayload {
  const statusCounts = new Map<string, number>();
  const typeStatusCounts = new Map<string, Map<string, number>>();
  let total = 0;
  let completed = 0;

  for (const row of rows) {
    const count = row._count._all;
    total += count;
    if (row.status === "TAMAMLANDI") completed += count;

    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + count);

    const typeKey = row.type;
    if (!typeStatusCounts.has(typeKey)) typeStatusCounts.set(typeKey, new Map());
    const typeMap = typeStatusCounts.get(typeKey)!;
    typeMap.set(row.status, (typeMap.get(row.status) ?? 0) + count);
  }

  const counts = computeProjectTaskCounts(completed, total);

  const byStatus = STATUS_ORDER.map((status) => {
    const count = statusCounts.get(status) ?? 0;
    const percent = total === 0 ? 0 : Math.round((count / total) * 100);
    return {
      status,
      label: STATUS_LABELS[status] ?? status,
      count,
      percent,
    };
  });

  const byType: TypeBreakdownItem[] = TYPE_ORDER.map((type) => {
    const typeMap = typeStatusCounts.get(type);
    const typeTotal = typeMap
      ? [...typeMap.values()].reduce((sum, n) => sum + n, 0)
      : 0;
    return {
      type,
      label: TYPE_LABELS[type],
      count: typeTotal,
      percent: total === 0 ? 0 : Math.round((typeTotal / total) * 100),
      byStatus: typeTotal > 0 ? buildStatusBreakdown(typeMap!, typeTotal) : [],
    };
  }).filter((item) => item.count > 0);

  return { projectId, projectName, counts, byStatus, byType };
}

export function emptyProjectTaskCounts(): ProjectTaskCounts {
  return { ...EMPTY_COUNTS };
}
