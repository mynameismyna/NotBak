import { NextRequest, NextResponse } from "next/server";
import { getImapConfigFromDb, saveImapConfigToDb } from "@/lib/imap-config";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettingsFresh } from "@/lib/authz";
import { restartImapScheduler } from "@/lib/imap-scheduler";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json({ error: "IMAP ayarlarına sadece Admin erişebilir" }, { status: 403 });
    }
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const config = await getImapConfigFromDb();
    if (config) {
      return NextResponse.json({
        config: { ...config, password: config.password ? "••••••••" : "" },
      });
    }
    return NextResponse.json({ config: null });
  } catch (error) {
    console.error("IMAP settings get failed:", error);
    return NextResponse.json(
      { error: "IMAP ayarları alınamadı" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json({ error: "IMAP ayarlarına sadece Admin erişebilir" }, { status: 403 });
    }
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const body = await request.json();
    const host = typeof body.host === "string" ? body.host.trim() : "";
    const port = typeof body.port === "number" ? body.port : 993;
    const secure = body.secure !== false;
    const user = typeof body.user === "string" ? body.user.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const folder = typeof body.folder === "string" ? body.folder.trim() : "INBOX";
    const pollInterval = typeof body.pollInterval === "number" ? body.pollInterval : 5;
    const rejectUnauthorized = body.rejectUnauthorized !== false;

    if (!host) {
      return NextResponse.json({ error: "Sunucu (host) zorunludur" }, { status: 400 });
    }
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı adı zorunludur" }, { status: 400 });
    }

    let finalPassword = password;
    if (password === "••••••••") {
      const existing = await getImapConfigFromDb();
      finalPassword = existing?.password ?? "";
    }

    await saveImapConfigToDb({
      host,
      port,
      secure,
      user,
      password: finalPassword,
      folder,
      pollInterval,
      rejectUnauthorized,
    });

    // Zamanlayıcıyı yeni ayarlarla yeniden başlat
    try {
      await restartImapScheduler();
    } catch {
      // Scheduler hatası kaydetmeyi engellemez
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("IMAP settings save failed:", error);
    return NextResponse.json(
      { error: "IMAP ayarları kaydedilemedi" },
      { status: 500 }
    );
  }
}
