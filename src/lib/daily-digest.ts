import { prisma } from "@/lib/prisma";
import { formatUserDisplayName } from "@/lib/display-name";
import type { DigestTaskItem, DigestStats } from "@/lib/email";
import {
  taskAccessWhere,
  fetchWidgetCounts,
  fetchDurationStats,
  type WidgetCountsPayload,
  type DurationStatsPayload,
} from "@/lib/dashboard-metrics";
import { getEffectiveGlobalRole, GLOBAL_ROLE } from "@/lib/authz";

/** E-posta özeti ile uyumlu bildirim öğesi (email.DigestNotificationItem ile aynı şekil) */
export type DigestNotificationItem = import("@/lib/email").DigestNotificationItem;

const SECTION_LIMITS = {
  overdue: 10,
  today: 10,
  tomorrow: 5,
  inProgress: 10,
  collaborator: 5,
  completed: 5,
} as const;

function toItem(
  t: {
    id: string;
    title: string;
    status: string;
    priority: string;
    type: string;
    dueDate: Date;
    completedAt: Date | null;
    project?: { name: string } | null;
    assignee?: { displayName: string } | null;
  },
): DigestTaskItem {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    type: t.type,
    dueDate: t.dueDate,
    completedAt: t.completedAt,
    projectName: t.project?.name ?? null,
    assigneeName: formatUserDisplayName(t.assignee?.displayName) || null,
  };
}

const TASK_SELECT = {
  id: true,
  title: true,
  status: true,
  priority: true,
  type: true,
  dueDate: true,
  completedAt: true,
  project: { select: { name: true } },
} as const;

const TASK_SELECT_WITH_ASSIGNEE = {
  ...TASK_SELECT,
  assignee: { select: { displayName: true } },
} as const;

export interface DailyDigestResult {
  overdueTasks: DigestTaskItem[];
  todayTasks: DigestTaskItem[];
  tomorrowTasks: DigestTaskItem[];
  inProgressTasks: DigestTaskItem[];
  collaboratorTasks: DigestTaskItem[];
  lastCompleted: DigestTaskItem[];
  stats: DigestStats;
  /** Okunmamış bildirimler (zil listesi, en fazla 20) */
  unreadNotifications: DigestNotificationItem[];
  /** Dashboard kutucukları ile aynı sayılar (e-posta üst bölümü) */
  widgetCounts: WidgetCountsPayload;
  /** Dashboard "Süre İstatistikleri" ile aynı metrikler (e-posta alt bölümü) */
  durationStats: DurationStatsPayload;
  /** Ana sayfada olduğu gibi: sadece admin bilinmeyen e-posta kutusunu görür */
  showUnknownEmailWidget: boolean;
}

/** Verilen kullanıcı için günlük özet verilerini toplar. */
export async function getDailyDigestDataForUser(userId: string): Promise<DailyDigestResult> {
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, globalRole: true, email: true },
  });
  const isAdmin = !!profile?.isAdmin;
  const accessWhere = taskAccessWhere(userId, isAdmin);
  const authUser = {
    id: userId,
    email: profile?.email ?? "",
    isAdmin: profile?.isAdmin,
    globalRole: profile?.globalRole ?? null,
  };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfTomorrow = new Date(startOfToday.getTime() + 86_400_000);
  const endOfTomorrow = new Date(endOfToday.getTime() + 86_400_000);

  const endOfWeek = new Date(startOfToday);
  const dayOfWeek = endOfWeek.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);
  endOfWeek.setHours(23, 59, 59, 999);

  const notCompleted = { not: "TAMAMLANDI" };

  const [
    widgetCounts,
    durationStats,
    overdueTasks,
    todayTasks,
    tomorrowTasks,
    inProgressTasks,
    collaboratorRows,
    lastCompleted,
    unreadNotifications,
    overdueCount,
    todayCount,
    thisWeekCount,
    totalPendingCount,
  ] = await Promise.all([
    fetchWidgetCounts(userId, authUser),
    fetchDurationStats(userId, isAdmin),
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        dueDate: { lt: startOfToday },
        status: notCompleted,
      },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
      take: SECTION_LIMITS.overdue,
      select: TASK_SELECT,
    }),

    prisma.task.findMany({
      where: {
        assigneeId: userId,
        dueDate: { gte: startOfToday, lte: endOfToday },
        status: notCompleted,
      },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
      take: SECTION_LIMITS.today,
      select: TASK_SELECT,
    }),

    prisma.task.findMany({
      where: {
        assigneeId: userId,
        dueDate: { gte: startOfTomorrow, lte: endOfTomorrow },
        status: notCompleted,
      },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
      take: SECTION_LIMITS.tomorrow,
      select: TASK_SELECT,
    }),

    prisma.task.findMany({
      where: {
        ...accessWhere,
        assigneeId: userId,
        status: "DEVAM_EDIYOR",
      },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
      take: SECTION_LIMITS.inProgress,
      select: TASK_SELECT,
    }),

    prisma.taskCollaborator.findMany({
      where: {
        userId,
        task: { status: notCompleted },
      },
      take: SECTION_LIMITS.collaborator,
      select: {
        task: { select: TASK_SELECT_WITH_ASSIGNEE },
      },
    }),

    prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: "TAMAMLANDI",
      },
      orderBy: { completedAt: "desc" },
      take: SECTION_LIMITS.completed,
      select: TASK_SELECT,
    }),

    prisma.notification.findMany({
      where: { userId, readAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, type: true, title: true, body: true, link: true, createdAt: true },
    }),

    prisma.task.count({
      where: { assigneeId: userId, dueDate: { lt: startOfToday }, status: notCompleted },
    }),
    prisma.task.count({
      where: { assigneeId: userId, dueDate: { gte: startOfToday, lte: endOfToday }, status: notCompleted },
    }),
    prisma.task.count({
      where: { assigneeId: userId, dueDate: { gte: startOfToday, lte: endOfWeek }, status: notCompleted },
    }),
    prisma.task.count({
      where: { assigneeId: userId, status: notCompleted },
    }),
  ]);

  return {
    overdueTasks: overdueTasks.map((t) => toItem(t)),
    todayTasks: todayTasks.map((t) => toItem(t)),
    tomorrowTasks: tomorrowTasks.map((t) => toItem(t)),
    inProgressTasks: inProgressTasks.map((t) => toItem(t)),
    collaboratorTasks: collaboratorRows.map((r) => toItem(r.task)),
    lastCompleted: lastCompleted.map((t) => toItem(t)),
    stats: { overdueCount, todayCount, thisWeekCount, totalPendingCount },
    unreadNotifications: unreadNotifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      createdAt: n.createdAt,
    })),
    widgetCounts,
    durationStats,
    showUnknownEmailWidget: getEffectiveGlobalRole(authUser) === GLOBAL_ROLE.ADMIN,
  };
}
