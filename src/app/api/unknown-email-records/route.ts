import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { getEffectiveGlobalRole, GLOBAL_ROLE } from "@/lib/authz";
import { ensureInboundEmailRecordTable } from "@/lib/ensure-email-table";
import { cleanBodyText } from "@/lib/html-to-text";

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

    if (getEffectiveGlobalRole(session) !== GLOBAL_ROLE.ADMIN) {
      return NextResponse.json({ error: "Bu sayfaya sadece Admin erişebilir" }, { status: 403 });
    }

    await ensureInboundEmailRecordTable();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    const where: Record<string, unknown> = { userId: null };
    if (statusFilter) {
      where.status = statusFilter;
    }

    const records = await prisma.inboundEmailRecord.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: 100,
      // bodyHtml (NVarChar(Max)) listede kullanılmaz; tam satır çekmek
      // listeleme yanıtını gereksiz büyütüyordu.
      select: {
        id: true,
        fromEmail: true,
        subject: true,
        bodyText: true,
        status: true,
        receivedAt: true,
        convertedTaskId: true,
      },
    });

    // Liste yalnızca 2 satırlık önizleme gösterir; tam metin convert
    // akışında DB'den okunur.
    const cleaned = records.map((r) => ({
      ...r,
      bodyText: cleanBodyText(r.bodyText).slice(0, 500),
    }));

    return NextResponse.json({ records: cleaned });
  } catch (error) {
    console.error("Unknown email records list failed:", error);
    return NextResponse.json(
      { error: "Kayıtlar alınamadı" },
      { status: 500 }
    );
  }
}
