import { NextResponse } from "next/server";
import { getSetupConfig } from "@/lib/config";
import { prisma } from "@/lib/prisma";

/** Kurulum tamamlanmış mı ve veritabanı tabloları mevcut mu kontrol eder. */
export async function GET() {
  try {
    const config = getSetupConfig();
    if (!config?.setupComplete || !config?.databaseUrl) {
      return NextResponse.json({ setupComplete: false, tablesExist: false });
    }

    try {
      await prisma.user.findFirst({ take: 1, select: { id: true } });
      return NextResponse.json({ setupComplete: true, tablesExist: true });
    } catch {
      return NextResponse.json({ setupComplete: true, tablesExist: false });
    }
  } catch {
    return NextResponse.json({ setupComplete: false, tablesExist: false });
  }
}
