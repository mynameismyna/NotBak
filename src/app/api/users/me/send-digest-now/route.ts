import { NextResponse } from "next/server";
import { formatUserDisplayName } from "@/lib/display-name";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { getDailyDigestDataForUser } from "@/lib/daily-digest";
import { sendDailyDigestMail } from "@/lib/email";
import { resolveBaseUrl } from "@/lib/base-url";

/** Oturum açmış kullanıcıya günlük e-posta özetini hemen gönderir (manuel test / şimdi gönder). */
export async function POST(request: Request) {
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
      select: { id: true, email: true, displayName: true, dailyDigestEnabled: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    if (!user.dailyDigestEnabled) {
      return NextResponse.json(
        { error: "Günlük özet e-postası bu hesap için devre dışı." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const clientOrigin = typeof body?.origin === "string" ? body.origin : undefined;
    const baseUrl = resolveBaseUrl(request, clientOrigin);

    const digestData = await getDailyDigestDataForUser(user.id);
    const result = await sendDailyDigestMail({
      toEmail: user.email,
      toName: formatUserDisplayName(user.displayName) || user.displayName,
      ...digestData,
      baseUrl: baseUrl || undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "E-posta gönderilemedi." },
        { status: 500 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastDigestSentAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "Özet e-postası gönderildi." });
  } catch (error) {
    console.error("Send digest now failed:", error);
    return NextResponse.json(
      { error: "Özet gönderilemedi" },
      { status: 500 }
    );
  }
}
