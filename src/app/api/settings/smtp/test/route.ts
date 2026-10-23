import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettingsFresh } from "@/lib/authz";

export interface DebugStep {
  step: string;
  status: "ok" | "fail";
  message: string;
  detail?: string;
}

/**
 * SMTP bağlantısını test eder; adım adım debug çıktısı döndürür.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json({ error: "SMTP testine sadece Admin erişebilir" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const host = typeof body.host === "string" ? body.host.trim() : "";
    const port = typeof body.port === "number" ? body.port : typeof body.port === "string" ? parseInt(body.port, 10) || 587 : 587;
    const secure = body.secure === true || body.secure === "true" || body.secure === "1";
    const rejectUnauthorized = body.rejectUnauthorized === false ? false : true;

    const steps: DebugStep[] = [];
    const add = (step: string, status: "ok" | "fail", message: string, detail?: string) => {
      steps.push({ step, status, message, detail });
    };

    add("1. Parametreler", "ok", "İstek alındı", JSON.stringify({ host, port, secure, rejectUnauthorized }, null, 2));

    if (!host) {
      add("2. Doğrulama", "fail", "Sunucu (host) boş", "SMTP ayarlarında sunucu adresini girin.");
      return NextResponse.json({ success: false, steps });
    }

    add("2. Doğrulama", "ok", "Host ve port geçerli", "");

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      tls: rejectUnauthorized === false ? { rejectUnauthorized: false } : undefined,
      // Auth yok: relay modu
    });

    try {
      await transporter.verify();
      add("3. SMTP bağlantısı (verify)", "ok", "Sunucuya bağlanıldı, SMTP el sıkışması başarılı", "");
      return NextResponse.json({ success: true, steps });
    } catch (verifyErr) {
      const err = verifyErr as Error;
      const msg = err.message || String(verifyErr);
      add("3. SMTP bağlantısı (verify)", "fail", msg, String(verifyErr));
      return NextResponse.json({ success: false, steps });
    }
  } catch (error) {
    console.error("SMTP test failed:", error);
    return NextResponse.json(
      {
        success: false,
        steps: [
          {
            step: "0. Hata",
            status: "fail" as const,
            message: error instanceof Error ? error.message : "Beklenmeyen hata",
            detail: String(error),
          },
        ],
      },
      { status: 200 }
    );
  }
}
