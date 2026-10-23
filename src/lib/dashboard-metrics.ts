import { prisma } from "@/lib/prisma";
import { ensureInboundEmailRecordTable } from "@/lib/ensure-email-table";
import { getEffectiveGlobalRole, GLOBAL_ROLE, type AuthUser } from "@/lib/authz";

/** Kullanıcının erişebildiği görevler için where koşulu (admin değilse). */
export function taskAccessWhere(sessionId: string, isAdmin: boolean) {
  if (isAdmin) return {};
  return {
    AND: [
      { OR: [{ isPrivate: false }, { assigneeId: sessionId }] },
      {
        OR: [
          { assigneeId: sessionId },
          { createdById: sessionId },
          { collaborators: { some: { userId: sessionId } } },
          { project: { ownerId: sessionId } },
          { project: { members: { some: { userId: sessionId } } } },
          { project: { teams: { some: { members: { some: { userId: sessionId } } } } } },
        ],
      },
    ],
  };
}

/**
 * Kullanıcının gerçekten dahil olduğu projeler (sahip / üye / takım).
 * Admin bypass ve allowAnyoneToAddTasks yok — "Dahil olunan projeler" sayımı için.
 */
export function projectMembershipWhere(sessionId: string) {
  return {
    OR: [
      { ownerId: sessionId },
      { members: { some: { userId: sessionId } } },
      { teams: { some: { members: { some: { userId: sessionId } } } } },
    ],
  };
}

/** Proje erişim where (admin: tümü; değilse üyelik). Arama vb. için. */
export function projectAccessWhere(sessionId: string, isAdmin: boolean) {
  if (isAdmin) return {};
  return projectMembershipWhere(sessionId);
}

export type WidgetCountsPayload = {
  inProgressCount: number;
  assignedCount: number;
  overdueCount: number;
  completedCount: number;
  notesCount: number;
  projectsCount: number;
  pendingApprovalCount: number;
  emailRecordsCount: number;
  unknownRecordsCount: number;
};

/** Dashboard kutucukları ve günlük özet e-postası için aynı sayıları üretir. */
export async function fetchWidgetCounts(
  sessionId: string,
  authUser: Pick<AuthUser, "id" | "email" | "isAdmin" | "globalRole">,
): Promise<WidgetCountsPayload> {
  const isAdmin = !!authUser.isAdmin;
  const accessWhere = taskAccessWhere(sessionId, isAdmin);
  // Kutucuk "Dahil olunan" — admin olsa bile tüm projeler değil, üyelik sayılır.
  const membershipWhere = projectMembershipWhere(sessionId);
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  await ensureInboundEmailRecordTable();

  const [
    inProgressCount,
    assignedCount,
    overdueCount,
    completedCount,
    notesCount,
    projectsCount,
    sentApprovals,
    myPendingCount,
    unknownPendingCount,
  ] = await Promise.all([
    prisma.task.count({
      where: { ...accessWhere, status: "DEVAM_EDIYOR", assigneeId: sessionId },
    }),
    prisma.task.count({
      where: { ...accessWhere, assigneeId: sessionId, status: { not: "TAMAMLANDI" } },
    }),
    prisma.task.count({
      where: {
        ...accessWhere,
        dueDate: { lt: todayStart },
        status: { not: "TAMAMLANDI" },
      },
    }),
    prisma.task.count({
      where: { ...accessWhere, status: "TAMAMLANDI" },
    }),
    prisma.task.count({
      where: { ...accessWhere, type: "NOT", status: { not: "TAMAMLANDI" } },
    }),
    prisma.project.count({ where: membershipWhere }),
    prisma.importPendingApproval.findMany({
      where: { requesterId: sessionId, status: "PENDING" },
      select: { items: true },
    }),
    prisma.inboundEmailRecord.count({
      where: { userId: sessionId, status: "PENDING" },
    }),
    getEffectiveGlobalRole(authUser) === GLOBAL_ROLE.ADMIN
      ? prisma.inboundEmailRecord.count({ where: { userId: null, status: "PENDING" } })
      : Promise.resolve(0),
  ]);

  const pendingApprovalCount = sentApprovals.reduce((sum, a) => {
    try {
      const items = JSON.parse(a.items) as unknown[];
      return sum + (Array.isArray(items) ? items.length : 0);
    } catch {
      return sum;
    }
  }, 0);

  return {
    inProgressCount,
    assignedCount,
    overdueCount,
    completedCount,
    notesCount,
    projectsCount,
    pendingApprovalCount,
    emailRecordsCount: myPendingCount,
    unknownRecordsCount: unknownPendingCount,
  };
}

export type DurationStatsPayload = {
  avgActualDays: number | null;
  avgPlannedDays: number | null;
  completedCount: number;
  pendingCount: number;
  pendingNotesCount: number;
};

/**
 * Ortalama hesabı için bellekte tutulacak en fazla kayıt sayısı. Kayıt
 * sayısı arttıkça tüm tabloyu çekmek yerine en güncel örneklemden ortalama
 * alınır; sayılar (count) ayrı sorgularla tam tutulur.
 */
const DURATION_SAMPLE_SIZE = 500;

/** Dashboard "Süre İstatistikleri" ile aynı hesaplamalar. */
export async function fetchDurationStats(
  sessionId: string,
  isAdmin: boolean,
): Promise<DurationStatsPayload> {
  const accessWhere = taskAccessWhere(sessionId, isAdmin);

  const completedWhere = {
    ...accessWhere,
    status: "TAMAMLANDI",
    completedAt: { not: null },
  };
  const pendingWhere = {
    ...accessWhere,
    status: { not: "TAMAMLANDI" },
    type: "GOREV",
  };

  const [
    completedForDuration,
    pendingForDuration,
    completedCount,
    pendingCount,
    pendingNotesCount,
  ] = await Promise.all([
    prisma.task.findMany({
      where: completedWhere,
      orderBy: { completedAt: "desc" },
      take: DURATION_SAMPLE_SIZE,
      select: { createdAt: true, completedAt: true },
    }),
    prisma.task.findMany({
      where: pendingWhere,
      orderBy: { createdAt: "desc" },
      take: DURATION_SAMPLE_SIZE,
      select: { createdAt: true, dueDate: true },
    }),
    prisma.task.count({ where: completedWhere }),
    prisma.task.count({ where: pendingWhere }),
    prisma.task.count({
      where: {
        ...accessWhere,
        status: { not: "TAMAMLANDI" },
        type: "NOT",
      },
    }),
  ]);

  const avgActualDays =
    completedForDuration.length > 0
      ? completedForDuration.reduce((sum, t) => {
          const ms = (t.completedAt as Date).getTime() - t.createdAt.getTime();
          return sum + ms / (24 * 60 * 60 * 1000);
        }, 0) / completedForDuration.length
      : null;

  const avgPlannedDays =
    pendingForDuration.length > 0
      ? pendingForDuration.reduce((sum, t) => {
          const ms = t.dueDate.getTime() - t.createdAt.getTime();
          return sum + ms / (24 * 60 * 60 * 1000);
        }, 0) / pendingForDuration.length
      : null;

  return {
    avgActualDays,
    avgPlannedDays,
    completedCount,
    pendingCount,
    pendingNotesCount,
  };
}
