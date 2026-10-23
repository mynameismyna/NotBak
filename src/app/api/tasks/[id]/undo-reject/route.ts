import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";

/**
 * Reddeden kişi (assignee) reddi geri alır; görev tekrar üstlenilir (status = YENI).
 * Sadece status=REDDEDILDI ve type=GOREV iken çalışır.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(_request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, assigneeId: true, type: true, status: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }

    if (task.assigneeId !== session.id) {
      return NextResponse.json(
        { error: "Reddi yalnızca görevin sorumlusu geri alabilir" },
        { status: 403 }
      );
    }

    if (task.type !== "GOREV" || task.status !== "REDDEDILDI") {
      return NextResponse.json(
        { error: "Bu kayıt reddedilmiş bir görev değil" },
        { status: 400 }
      );
    }

    await prisma.task.update({
      where: { id },
      data: { status: "YENI" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Task undo-reject failed:", error);
    return NextResponse.json(
      { error: "İşlem başarısız" },
      { status: 500 }
    );
  }
}
