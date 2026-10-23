import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettingsFresh } from "@/lib/authz";
import { getSmtpConfigFromDb } from "@/lib/smtp-config";

export interface DebugStep {
  step: string;
  status: "ok" | "fail";
  message: string;
  detail?: string;
}

/** Oturum açmış kullanıcının e-postasına deneme postası gönderir; adım adım debug döndürür. */
export async function POST(request: NextRequest) {
  const steps: DebugStep[] = [];
  const add = (step: string, status: "ok" | "fail", message: string, detail?: string) => {
    steps.push({ step, status, message, detail });
  };

  try {
    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json({ error: "Deneme postası göndermek için yetki gerekli" }, { status: 403 });
    }

    const email = session.email?.trim();
    const displayName = session.displayName ?? undefined;
    add("1. Oturum", "ok", "Kullanıcı bilgileri alındı", JSON.stringify({ email, displayName: displayName || "(yok)" }, null, 2));

    if (!email) {
      add("2. E-posta adresi", "fail", "Oturumda e-posta adresi yok", "Deneme postası göndermek için giriş yapan kullanıcının e-postası gerekir.");
      return NextResponse.json({ success: false, steps }, { status: 200 });
    }
    add("2. E-posta adresi", "ok", `Gönderen / alıcı: ${email}`, "");

    const config = await getSmtpConfigFromDb();
    if (!config?.host) {
      add("3. SMTP yapılandırması", "fail", "SMTP ayarları yok veya host boş", "Önce Ayarlar > SMTP Ayarlarından sunucu bilgilerini kaydedin.");
      return NextResponse.json({ success: false, steps }, { status: 200 });
    }
    add(
      "3. SMTP yapılandırması",
      "ok",
      "Yapılandırma okundu",
      JSON.stringify(
        {
          host: config.host,
          port: config.port,
          secure: config.secure,
          rejectUnauthorized: config.rejectUnauthorized,
          not: "Kimlik doğrulama (auth) YOK — relay modu. Sunucu auth istiyorsa 530 hatası alırsınız.",
        },
        null,
        2
      )
    );

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      tls: config.rejectUnauthorized === false ? { rejectUnauthorized: false } : undefined,
    });
    add("4. Transporter", "ok", "SMTP bağlantı nesnesi oluşturuldu (auth yok)", "");

    const fromStr = displayName ? `"${displayName}" <${email}>` : email;
    const subject = "[NotBak] SMTP deneme postası";
    const mailOptions = {
      from: fromStr,
      to: email,
      replyTo: email,
      subject,
      text: "Bu mesaj NotBak SMTP ayarlarını test etmek için gönderilmiştir.",
      html: "<p>Bu mesaj NotBak SMTP ayarlarını test etmek için gönderilmiştir.</p>",
    };
    add("5. Gönderim parametreleri", "ok", "MAIL FROM / TO hazır", JSON.stringify({ from: fromStr, to: email, subject }, null, 2));

    try {
      await transporter.sendMail(mailOptions);
      add("6. Gönderim (sendMail)", "ok", "Deneme postası sunucuya gönderildi.", "Gelen kutunuzu kontrol edin.");
      return NextResponse.json({ success: true, steps }, { status: 200 });
    } catch (sendErr) {
      const err = sendErr as Error;
      const msg = err.message || String(sendErr);
      let detail = String(sendErr);
      if (msg.includes("530") && (msg.includes("not authenticated") || msg.includes("anonymous"))) {
        detail += "\n\n--- Açıklama ---\nBu sunucu anonim (kimlik doğrulamasız) gönderime izin vermiyor.\nŞu an relay modundayız (kullanıcı adı/parola yok).\nÇözüm: SMTP ayarlarına kullanıcı adı ve parola ekleyip sunucuda kimlik doğrulaması kullanmak gerekir.";
      }
      add("6. Gönderim (sendMail)", "fail", msg, detail);
      return NextResponse.json({ success: false, steps }, { status: 200 });
    }
  } catch (error) {
    console.error("SMTP send-test failed:", error);
    add("0. Hata", "fail", error instanceof Error ? error.message : "Beklenmeyen hata", String(error));
    return NextResponse.json({ success: false, steps }, { status: 200 });
  }
}
