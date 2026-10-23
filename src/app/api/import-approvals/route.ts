import { NextRequest, NextResponse } from "next/server";
import { jsonWithDisplayNames } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter"); // "received" | "sent"

    if (filter === "sent") {
      const approvals = await prisma.importPendingApproval.findMany({
        where: { requesterId: session.id },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      });
      const withDetails = approvals.map((a) => {
        const items = JSON.parse(a.items) as Array<{ title: string }>;
        return {
          id: a.id,
          type: "import",
          projectId: a.project.id,
          projectName: a.project.name,
          itemCount: items.length,
          status: a.status,
          createdAt: a.createdAt,
          resolvedAt: a.resolvedAt,
        };
      });
      return jsonWithDisplayNames({ approvals: withDetails });
    }

    const approvals = await prisma.importPendingApproval.findMany({
      where: {
        status: "PENDING",
        ...(session.isAdmin ? {} : { project: { ownerId: session.id } }),
      },
      // requester/assignee tek sorguda join'lenir (önceden kayıt başına 2 ayrı
      // sorgu atılıyordu → N+1).
      include: {
        project: { select: { id: true, name: true } },
        requester: { select: { displayName: true, email: true } },
        assignee: { select: { displayName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const withDetails = approvals.map((a) => {
      const items = JSON.parse(a.items) as Array<{ title: string }>;
      return {
        id: a.id,
        type: "import",
        projectId: a.project.id,
        projectName: a.project.name,
        requester: a.requester ? { displayName: a.requester.displayName, email: a.requester.email } : null,
        assignee: a.assignee ? { displayName: a.assignee.displayName, email: a.assignee.email } : null,
        itemCount: items.length,
        createdAt: a.createdAt,
      };
    });

    return jsonWithDisplayNames({ approvals: withDetails });
  } catch (error) {
    console.error("Import approvals list failed:", error);
    return NextResponse.json(
      { error: "Talepler alınamadı" },
      { status: 500 }
    );
  }
}
