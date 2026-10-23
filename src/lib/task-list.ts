/** Paylaşılan görev/kayıt liste yardımcıları ve etiketler. */

import { formatUserDisplayName } from "@/lib/display-name";
import { parseAppDate } from "@/lib/parse-date";

export interface TaskListItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  dueDate: string;
  createdAt?: string;
  statusChangedAt?: string | null;
  completedAt?: string | null;
  assignee: { id: string; displayName: string; email: string };
  createdBy?: { id: string; displayName: string; email: string } | null;
  /** İlgili kişiler (ekip üyeleri). */
  collaborators?: { userId: string; displayName?: string; email?: string }[];
  project: { name: string; ownerId?: string | null };
  canEdit?: boolean;
}

/** Sorumlu veya ilgili kişi olarak kullanıcıya bağlı kayıt. */
export function isTaskRelevantToUser(task: TaskListItem, userId: string): boolean {
  if (!userId) return false;
  if (task.assignee?.id === userId) return true;
  return (task.collaborators ?? []).some((c) => c.userId === userId);
}

export type TaskTypeFilter = "" | "GOREV" | "NOT" | "FIKIR";

export type TaskListSortKey =
  | "dueDate"
  | "title"
  | "statusChangedAt"
  | "createdAt"
  | "status";

export type SortDir = "asc" | "desc";

export const STATUS_LABELS: Record<string, string> = {
  YENI: "Yeni",
  ONAY_BEKLIYOR: "Onay Bekliyor",
  DEVAM_EDIYOR: "Devam Ediyor",
  BEKLEMEDE: "Beklemede",
  TAMAMLANDI: "Tamamlandı",
  REDDEDILDI: "Reddedildi",
};

export const PRIORITY_LABELS: Record<string, string> = {
  URGENT: "Acil",
  HIGH: "Yüksek",
  MEDIUM: "Orta",
  LOW: "Düşük",
};

export function priorityRank(priority: string | null | undefined): number {
  switch (priority) {
    case "URGENT":
      return 3;
    case "HIGH":
      return 2;
    case "MEDIUM":
      return 1;
    case "LOW":
      return 0;
    default:
      return -1;
  }
}

export const TYPE_LABELS: Record<string, string> = {
  GOREV: "Görev",
  NOT: "Not",
  FIKIR: "Fikir",
};

export type DueCategory = "OVERDUE" | "TODAY" | "THIS_WEEK" | "LATER";

/** Liste sütunları: Geciken / Bugün / Gelecek */
export type DueColumnKey = "overdue" | "today" | "future";

export interface DueColumnGroup {
  overdue: TaskListItem[];
  today: TaskListItem[];
  future: TaskListItem[];
  completed: TaskListItem[];
}

export const DUE_COLUMNS: {
  key: DueColumnKey;
  label: string;
  headerClass: string;
  searchPlaceholder: string;
}[] = [
  {
    key: "overdue",
    label: "Geciken",
    headerClass: "bg-red-50 text-red-900 border-red-200",
    searchPlaceholder: "Geciken kayıtlarda ara…",
  },
  {
    key: "today",
    label: "Bugün",
    headerClass: "bg-amber-50 text-amber-900 border-amber-200",
    searchPlaceholder: "Bugün kayıtlarında ara…",
  },
  {
    key: "future",
    label: "Gelecek",
    headerClass: "bg-slate-50 text-slate-800 border-slate-200",
    searchPlaceholder: "Gelecek kayıtlarda ara…",
  },
];

export const VIEW_OPTIONS_FULL: { value: string; label: string }[] = [
  { value: "", label: "Tüm kayıtlar" },
  { value: "assigned", label: "Bana atanmış" },
  { value: "inprogress", label: "Devam eden" },
  { value: "requested", label: "Talep edilen" },
  { value: "teamOrProject", label: "Ekip / proje" },
  { value: "week", label: "Bu hafta" },
  { value: "overdue", label: "Geciken" },
  { value: "waiting", label: "Bekleyen" },
  { value: "completed", label: "Tamamlanan" },
  { value: "private", label: "Bana özel" },
];

export const VIEW_OPTIONS_TASKS: { value: string; label: string }[] = [
  { value: "", label: "Tüm görevler" },
  { value: "assigned", label: "Bana atanmış" },
  { value: "week", label: "Bu hafta" },
  { value: "overdue", label: "Geciken" },
  { value: "waiting", label: "Bekleyen" },
  { value: "completed", label: "Tamamlanan" },
  { value: "private", label: "Bana özel" },
];

export const TYPE_OPTIONS: { value: TaskTypeFilter; label: string }[] = [
  { value: "", label: "Tüm tipler" },
  { value: "GOREV", label: "Görevler" },
  { value: "NOT", label: "Notlar" },
  { value: "FIKIR", label: "Fikirler" },
];

export const SORT_OPTIONS: { value: TaskListSortKey; label: string }[] = [
  { value: "dueDate", label: "Son tarih" },
  { value: "title", label: "Başlık" },
  { value: "statusChangedAt", label: "Son güncelleme" },
  { value: "createdAt", label: "Eklenme tarihi" },
  { value: "status", label: "Durum" },
];

function getWeekBounds(d: Date): { start: Date; end: Date } {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(start.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Gelecek sütunu son tarih filtresi. */
export type FutureDueDatePreset = "" | "tomorrow" | "thisWeek" | "thisMonth" | "custom";

export const FUTURE_DUE_DATE_PRESETS: { value: FutureDueDatePreset; label: string }[] = [
  { value: "tomorrow", label: "Yarın" },
  { value: "thisWeek", label: "Bu Hafta" },
  { value: "thisMonth", label: "Bu Ay" },
  { value: "custom", label: "Özel Aralık" },
];

/** Gelecek sütunu için son tarih aralığı (Pzt–Paz takvim haftası). */
export function getFutureDueDateRange(
  preset: FutureDueDatePreset,
  customFrom?: string,
  customTo?: string
): { start: Date; end: Date } | null {
  if (!preset) return null;

  const today = startOfDay(new Date());

  if (preset === "tomorrow") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { start: startOfDay(tomorrow), end: endOfDay(tomorrow) };
  }

  if (preset === "thisWeek") {
    const { end: weekEnd } = getWeekBounds(today);
    const dayAfterToday = new Date(today);
    dayAfterToday.setDate(dayAfterToday.getDate() + 1);
    if (dayAfterToday.getTime() > weekEnd.getTime()) {
      return { start: weekEnd, end: weekEnd };
    }
    return { start: startOfDay(dayAfterToday), end: weekEnd };
  }

  if (preset === "thisMonth") {
    const dayAfterToday = new Date(today);
    dayAfterToday.setDate(dayAfterToday.getDate() + 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: startOfDay(dayAfterToday), end: endOfDay(monthEnd) };
  }

  if (preset === "custom") {
    const from = customFrom ? parseAppDate(customFrom) : null;
    const to = customTo ? parseAppDate(customTo) : null;
    if (!from && !to) return null;
    const start = from ? startOfDay(from) : startOfDay(today);
    const end = to ? endOfDay(to) : endOfDay(new Date(today.getFullYear() + 10, 11, 31));
    if (start.getTime() > end.getTime()) return { start: end, end: start };
    return { start, end };
  }

  return null;
}

export function filterTasksByFutureDueDate(
  tasks: TaskListItem[],
  preset: FutureDueDatePreset,
  customFrom?: string,
  customTo?: string
): TaskListItem[] {
  const range = getFutureDueDateRange(preset, customFrom, customTo);
  if (!range) return tasks;

  return tasks.filter((task) => {
    const due = parseAppDate(task.dueDate);
    if (!due) return false;
    const dueDay = startOfDay(due);
    return dueDay.getTime() >= range.start.getTime() && dueDay.getTime() <= range.end.getTime();
  });
}

export function dueCategory(dueDate: string, status?: string): DueCategory {
  if (status === "TAMAMLANDI") return "LATER";
  const d = parseAppDate(dueDate);
  if (!d) return "LATER";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  if (d.getTime() < today.getTime()) return "OVERDUE";
  if (d.getTime() === today.getTime()) return "TODAY";

  const { end: weekEnd } = getWeekBounds(today);
  if (d.getTime() <= weekEnd.getTime()) return "THIS_WEEK";
  return "LATER";
}

export function formatDueLabel(dueDate: string, status?: string): string {
  const cat = dueCategory(dueDate, status);
  const d = parseAppDate(dueDate);
  if (!d) return "—";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (cat === "OVERDUE") {
    const overdue = Math.abs(diffDays);
    if (overdue === 1) return "1 gün gecikmiş";
    return `${overdue} gün gecikmiş`;
  }
  if (cat === "TODAY") return "Bugün";
  if (diffDays === 1) return "Yarın";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export function dueCategoryBadgeClass(cat: DueCategory): string {
  switch (cat) {
    case "OVERDUE":
      return "bg-red-100 text-red-800";
    case "TODAY":
      return "bg-amber-100 text-amber-800";
    case "THIS_WEEK":
      return "bg-green-100 text-green-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "TAMAMLANDI":
      return "bg-gray-100 text-gray-600";
    case "DEVAM_EDIYOR":
      return "bg-blue-100 text-blue-800";
    case "BEKLEMEDE":
    case "ONAY_BEKLIYOR":
      return "bg-amber-100 text-amber-800";
    case "REDDEDILDI":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function typeBadgeClass(type: string): string {
  switch (type) {
    case "NOT":
      return "bg-yellow-100 text-yellow-900";
    case "FIKIR":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-indigo-100 text-indigo-800";
  }
}

export function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "URGENT":
      return "bg-red-100 text-red-800";
    case "HIGH":
      return "bg-orange-100 text-orange-800";
    case "LOW":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-amber-50 text-amber-800";
  }
}

export function daysAgoText(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return "Bugün güncellendi";
  if (days === 1) return "1 gün önce güncellendi";
  if (days > 0 && days < 30) return `${days} gün önce güncellendi`;
  if (days >= 30) return `${Math.floor(days / 30)} ay önce güncellendi`;
  return "";
}

function dateSortValue(s: string | null | undefined): number {
  if (!s) return Number.MAX_SAFE_INTEGER;
  return new Date(s).getTime();
}

function daySortValue(s: string | null | undefined): number {
  if (!s) return Number.MAX_SAFE_INTEGER;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return Number.MAX_SAFE_INTEGER;
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function sortTaskList(
  tasks: TaskListItem[],
  sortKey: TaskListSortKey,
  sortDir: SortDir
): TaskListItem[] {
  const dir = sortDir === "asc" ? 1 : -1;
  const cmp = (a: TaskListItem, b: TaskListItem): number => {
    switch (sortKey) {
      case "createdAt":
        return (dateSortValue(a.createdAt) - dateSortValue(b.createdAt)) * dir;
      case "status": {
        const order = { YENI: 0, ONAY_BEKLIYOR: 1, DEVAM_EDIYOR: 2, BEKLEMEDE: 3, TAMAMLANDI: 4, REDDEDILDI: 5 };
        return (
          ((order[a.status as keyof typeof order] ?? 99) -
            (order[b.status as keyof typeof order] ?? 99)) *
          dir
        );
      }
      case "title":
        return (a.title ?? "").localeCompare(b.title ?? "", "tr") * dir;
      case "dueDate":
        // Son tarih (gün) -> öncelik (Acil üstte) -> eklenme tarihi (en yeni üstte)
        if (sortDir === "asc") {
          const d = daySortValue(a.dueDate) - daySortValue(b.dueDate);
          if (d !== 0) return d;
          const p = priorityRank(b.priority) - priorityRank(a.priority);
          if (p !== 0) return p;
          return dateSortValue(b.createdAt) - dateSortValue(a.createdAt);
        } else {
          const d = daySortValue(b.dueDate) - daySortValue(a.dueDate);
          if (d !== 0) return d;
          const p = priorityRank(b.priority) - priorityRank(a.priority);
          if (p !== 0) return p;
          return dateSortValue(b.createdAt) - dateSortValue(a.createdAt);
        }
      case "statusChangedAt":
        return (dateSortValue(a.statusChangedAt) - dateSortValue(b.statusChangedAt)) * dir;
      default:
        return 0;
    }
  };
  return [...tasks].sort(cmp);
}

export function getAssigneeLabel(task: TaskListItem): string {
  const assigneeName = formatUserDisplayName(task.assignee?.displayName);
  if (task.project?.ownerId && task.assignee?.id === task.project.ownerId) {
    return `${task.project.name} (${assigneeName})`;
  }
  return assigneeName || "—";
}

export function filterTasksBySearch(tasks: TaskListItem[], query: string): TaskListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter((t) => {
    const haystack = [
      t.title,
      t.description,
      t.assignee?.displayName,
      t.assignee?.email,
      t.createdBy?.displayName,
      t.project?.name,
      STATUS_LABELS[t.status],
      TYPE_LABELS[t.type],
      PRIORITY_LABELS[t.priority],
      t.status,
      t.type,
      t.priority,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function viewLabel(view: string, options: { value: string; label: string }[]): string {
  return options.find((o) => o.value === view)?.label ?? view;
}

/** Son tarihe göre liste sütunu (tamamlananlar ayrı). */
export function dueColumnKey(task: TaskListItem): DueColumnKey | "completed" {
  if (task.status === "TAMAMLANDI") return "completed";
  const cat = dueCategory(task.dueDate, task.status);
  if (cat === "OVERDUE") return "overdue";
  if (cat === "TODAY") return "today";
  return "future";
}

export function groupTasksByDueColumn(tasks: TaskListItem[]): DueColumnGroup {
  const groups: DueColumnGroup = { overdue: [], today: [], future: [], completed: [] };
  for (const task of tasks) {
    const key = dueColumnKey(task);
    groups[key].push(task);
  }
  return groups;
}

