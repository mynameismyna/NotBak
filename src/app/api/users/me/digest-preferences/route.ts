import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";

/** "8:30" → "08:30" (HH:mm). Geçersiz veya boş için "08:00" döner. */
function normalizeDigestTime(s: string | null): string {
  if (!s || typeof s !== "string") return "08:00";
  const trimmed = s.trim();
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) return "08:00";
  const [h, m] = trimmed.split(":").map((x) => parseInt(x, 10));
  const hour = Math.min(23, Math.max(0, isNaN(h) ? 8 : h));
  const minute = Math.min(59, Math.max(0, isNaN(m) ? 0 : m));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Günlük e-posta özeti tercihlerini döner (oturum açmış kullanıcı). */
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

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { dailyDigestEnabled: true, dailyDigestTime: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    return NextResponse.json({
      dailyDigestEnabled: user.dailyDigestEnabled ?? true,
      dailyDigestTime: normalizeDigestTime(user.dailyDigestTime),
    });
  } catch (error) {
    console.error("Digest preferences GET failed:", error);
    return NextResponse.json(
      { error: "Tercihler alınamadı" },
      { status: 500 }
    );
  }
}

/** Günlük e-posta özeti tercihlerini günceller (sadece kendi hesabı). */
export async function PATCH(request: NextRequest) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }
    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const enabled = body.dailyDigestEnabled;
    const time = body.dailyDigestTime;

    const data: { dailyDigestEnabled?: boolean; dailyDigestTime?: string | null } = {};
    if (typeof enabled === "boolean") data.dailyDigestEnabled = enabled;
    if (typeof time === "string") {
      const trimmed = time.trim();
      if (trimmed === "") {
        data.dailyDigestTime = null;
      } else if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
        data.dailyDigestTime = normalizeDigestTime(trimmed);
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.id },
      data,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Digest preferences PATCH failed:", error);
    return NextResponse.json(
      { error: "Tercihler güncellenemedi" },
      { status: 500 }
    );
  }
}
