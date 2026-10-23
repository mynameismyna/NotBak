import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";

/** Talepler sayfası için bekleyen sayılar (badge). */
export async function GET(request: Request) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session?.id) {
      return NextResponse.json({ receivedCount: 0, sentPendingItemCount: 0, sentTotalItemCount: 0 });
    }

    // Bağımsız sorgular paralel çalıştırılır (önceden 5 sorgu seri await'ti).
    const [importCount, joinCount, taskAcceptCount, allSentApprovals] = await Promise.all([
      // Bana gelen bekleyen içe aktarma onayları
      prisma.importPendingApproval.count({
        where: { status: "PENDING", assigneeId: session.id },
      }),
      // Bana gelen bekleyen proje katılım talepleri (proje sahibiyim)
      prisma.projectJoinRequest.count({
        where: { status: "PENDING", project: { ownerId: session.id } },
      }),
      // Bana atanan onay bekleyen görevler (GOREV, ONAY_BEKLIYOR)
      prisma.task.count({
        where: { assigneeId: session.id, type: "GOREV", status: "ONAY_BEKLIYOR" },
      }),
      // Gönderdiğim tüm talepler tek sorguda; PENDING alt kümesi bellekte ayrılır
      prisma.importPendingApproval.findMany({
        where: { requesterId: session.id },
        select: { items: true, status: true },
      }),
    ]);

    const itemCount = (itemsJson: string): number => {
      try {
        const items = JSON.parse(itemsJson) as unknown[];
        return Array.isArray(items) ? items.length : 0;
      } catch {
        return 0;
      }
    };

    // Gönderdiğim onay bekleyen kayıt sayısı (talep eden olarak)
    const sentPendingItemCount = allSentApprovals
      .filter((a) => a.status === "PENDING")
      .reduce((sum, a) => sum + itemCount(a.items), 0);

    // Gönderdiğim toplam kayıt sayısı (tüm talepler: PENDING, APPROVED, REJECTED)
    const sentTotalItemCount = allSentApprovals.reduce((sum, a) => sum + itemCount(a.items), 0);

    return NextResponse.json({
      receivedCount: importCount + joinCount + taskAcceptCount,
      sentPendingItemCount,
      sentTotalItemCount,
    });
  } catch (error) {
    console.error("Talepler counts failed:", error);
    return NextResponse.json({ receivedCount: 0, sentPendingItemCount: 0, sentTotalItemCount: 0 });
  }
}
