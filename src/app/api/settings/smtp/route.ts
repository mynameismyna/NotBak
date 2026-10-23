import { NextRequest, NextResponse } from "next/server";
import { getSmtpConfigForApi, saveSmtpConfigToDb } from "@/lib/smtp-config";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettingsFresh } from "@/lib/authz";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json({ error: "SMTP ayarlarına sadece Admin erişebilir" }, { status: 403 });
    }
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const config = await getSmtpConfigForApi();
    return NextResponse.json({ config });
  } catch (error) {
    console.error("SMTP settings get failed:", error);
    return NextResponse.json(
      { error: "SMTP ayarları alınamadı" },
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
      return NextResponse.json({ error: "SMTP ayarlarına sadece Admin erişebilir" }, { status: 403 });
    }
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const body = await request.json();
    const host = typeof body.host === "string" ? body.host.trim() : "";
    const port = typeof body.port === "number" ? body.port : typeof body.port === "string" ? parseInt(body.port, 10) || 587 : 587;
    const secure = body.secure === true || body.secure === "true" || body.secure === "1";
    const rejectUnauthorized = body.rejectUnauthorized === false ? false : true;

    if (!host) {
      return NextResponse.json({ error: "Sunucu (host) zorunludur" }, { status: 400 });
    }

    await saveSmtpConfigToDb({ host, port, secure, rejectUnauthorized });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SMTP settings save failed:", error);
    return NextResponse.json(
      { error: "SMTP ayarları kaydedilemedi" },
      { status: 500 }
    );
  }
}
