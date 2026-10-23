import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { getEffectiveGlobalRole, GLOBAL_ROLE } from "@/lib/authz";
import { ensureInboundEmailRecordTable } from "@/lib/ensure-email-table";

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

    await ensureInboundEmailRecordTable();

    const myPendingCount = await prisma.inboundEmailRecord.count({
      where: { userId: session.id, status: "PENDING" },
    });

    let unknownPendingCount = 0;
    if (getEffectiveGlobalRole(session) === GLOBAL_ROLE.ADMIN) {
      unknownPendingCount = await prisma.inboundEmailRecord.count({
        where: { userId: null, status: "PENDING" },
      });
    }

    return NextResponse.json({ myPendingCount, unknownPendingCount });
  } catch (error) {
    console.error("Email records counts failed:", error);
    return NextResponse.json(
      { error: "Sayılar alınamadı" },
      { status: 500 }
    );
  }
}
