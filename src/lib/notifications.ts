import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "TASK_ASSIGNED"
  | "TASK_DELEGATED"
  | "TASK_DEFERRED"
  | "TASK_COLLABORATOR"
  | "REMINDER"
  | "IMPORT_APPROVAL_REQUEST"
  | "PROJECT_JOIN_REQUEST"
  | "EMAIL_RECORD_PENDING"
  | "UNKNOWN_EMAIL_RECORD";

/** Görev atandığında veya ilgili kişi eklendiğinde bildirim oluşturur (atanan/eklenen kişi kendisi değilse). */
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  relatedTaskId?: string | null;
  relatedImportApprovalId?: string | null;
  relatedProjectJoinRequestId?: string | null;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        link: params.link ?? null,
        relatedTaskId: params.relatedTaskId ?? null,
        relatedImportApprovalId: params.relatedImportApprovalId ?? null,
        relatedProjectJoinRequestId: params.relatedProjectJoinRequestId ?? null,
      },
    });
  } catch (e) {
    console.error("Create notification failed:", e);
  }
}
