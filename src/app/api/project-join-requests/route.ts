import { NextRequest, NextResponse } from "next/server";
import { jsonWithDisplayNames } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";

/** Gönderdiğim talepler: requesterId = session.id */
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
    const filter = searchParams.get("filter"); // "sent" | "received"

    if (filter === "sent") {
      const joinRequests = await prisma.projectJoinRequest.findMany({
        where: { requesterId: session.id },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return jsonWithDisplayNames({
        joinRequests: joinRequests.map((j) => ({
          id: j.id,
          projectId: j.projectId,
          projectName: j.project.name,
          status: j.status,
          createdAt: j.createdAt,
          resolvedAt: j.resolvedAt,
        })),
      });
    }

    if (filter === "received") {
      const joinRequests = await prisma.projectJoinRequest.findMany({
        where: {
          status: "PENDING",
          project: { ownerId: session.id },
        },
        // requester tek sorguda join'lenir (önceden kayıt başına ayrı sorgu → N+1).
        include: {
          project: { select: { id: true, name: true } },
          requester: { select: { displayName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      const withRequester = joinRequests.map((j) => ({
        id: j.id,
        projectId: j.projectId,
        projectName: j.project.name,
        requester: j.requester
          ? { displayName: j.requester.displayName, email: j.requester.email }
          : null,
        status: j.status,
        createdAt: j.createdAt,
      }));
      return jsonWithDisplayNames({ joinRequests: withRequester });
    }

    return NextResponse.json({ error: "filter gerekli (sent | received)" }, { status: 400 });
  } catch (error) {
    console.error("Join requests list failed:", error);
    return NextResponse.json(
      { error: "Talepler alınamadı" },
      { status: 500 }
    );
  }
}
