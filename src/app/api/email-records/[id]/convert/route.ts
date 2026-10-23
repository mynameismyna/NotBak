import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { getEffectiveGlobalRole, GLOBAL_ROLE } from "@/lib/authz";
import { ensureInboundEmailRecordTable } from "@/lib/ensure-email-table";
import { cleanBodyText } from "@/lib/html-to-text";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    await ensureInboundEmailRecordTable();

    const record = await prisma.inboundEmailRecord.findUnique({
      where: { id },
    });
    if (!record) {
      return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
    }

    const isAdmin = getEffectiveGlobalRole(session) === GLOBAL_ROLE.ADMIN;
    if (record.userId && record.userId !== session.id && !isAdmin) {
      return NextResponse.json({ error: "Bu kayda erişim yetkiniz yok" }, { status: 403 });
    }
    if (!record.userId && !isAdmin) {
      return NextResponse.json({ error: "Bilinmeyen kayıtlara sadece Admin erişebilir" }, { status: 403 });
    }

    const body = await request.json();
    const action = body.action as string;

    if (action === "restore") {
      if (record.status !== "IGNORED") {
        return NextResponse.json({ error: "Sadece yoksayılmış kayıtlar geri alınabilir" }, { status: 400 });
      }
      await prisma.inboundEmailRecord.update({
        where: { id },
        data: { status: "PENDING", convertedTaskId: null },
      });
      return NextResponse.json({ success: true, action: "restored" });
    }

    if (record.status !== "PENDING") {
      return NextResponse.json({ error: "Bu kayıt zaten işlenmiş" }, { status: 400 });
    }

    if (action === "ignore") {
      await prisma.inboundEmailRecord.update({
        where: { id },
        data: { status: "IGNORED" },
      });
      return NextResponse.json({ success: true, action: "ignored" });
    }

    if (action === "task" || action === "note") {
      const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : record.subject;
      const rawDesc = typeof body.description === "string" && body.description.trim() ? body.description.trim() : record.bodyText || "";
      const description = cleanBodyText(rawDesc);
      const type = action === "note" ? "NOT" : (body.type || "GOREV");
      const priority = body.priority || "MEDIUM";
      const dueDate = body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const assigneeId = body.assigneeId || session.id;
      const projectId = body.projectId || null;

      const task = await prisma.task.create({
        data: {
          title,
          description,
          type,
          status: "YENI",
          priority,
          dueDate,
          assigneeId,
          createdById: session.id,
          projectId,
        },
      });

      await prisma.inboundEmailRecord.update({
        where: { id },
        data: {
          status: action === "note" ? "CONVERTED_NOTE" : "CONVERTED_TASK",
          convertedTaskId: task.id,
        },
      });

      return NextResponse.json({ success: true, action, taskId: task.id });
    }

    return NextResponse.json({ error: "Geçersiz aksiyon. 'task', 'note', 'ignore' veya 'restore' olmalı." }, { status: 400 });
  } catch (error) {
    console.error("Email record convert failed:", error);
    return NextResponse.json(
      { error: "İşlem başarısız" },
      { status: 500 }
    );
  }
}
