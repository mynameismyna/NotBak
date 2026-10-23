import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAssignRole, GLOBAL_ROLE, UNIT_ROLE } from "@/lib/authz";
import { sendWelcomeMailLocal } from "@/lib/email";

/** Rastgele geçici parola üretir (12 karakter, harf + rakam). */
function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** Manuel kullanıcı oluştur. Sistem geçici parola üretir, hoş geldiniz maili gönderir. İlk girişte parola değiştirme zorunlu. */
export async function POST(request: NextRequest) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session?.id) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }
    const actorRole = session.isAdmin ? GLOBAL_ROLE.ADMIN : (session.globalRole as string) ?? null;
    if (actorRole !== GLOBAL_ROLE.ADMIN && actorRole !== GLOBAL_ROLE.YONETICI) {
      return NextResponse.json({ error: "Manuel kullanıcı eklemek için Admin veya Yönetici yetkisi gerekli" }, { status: 403 });
    }

    const body = await request.json();
    const {
      email,
      displayName,
      isAdmin,
      isActive,
      globalRole: bodyGlobalRole,
      assistantUserId: bodyAssistantId,
      unitMemberships: bodyUnitMemberships,
    } = body;

    const emailTrim = (email || "").trim();
    const displayNameTrim = (displayName || "").trim();
    const wantAdmin = !!isAdmin || (bodyGlobalRole === GLOBAL_ROLE.ADMIN);
    const wantGlobalRole = bodyGlobalRole === GLOBAL_ROLE.YONETICI ? GLOBAL_ROLE.YONETICI : (wantAdmin ? GLOBAL_ROLE.ADMIN : null);
    const assistantUserId = typeof bodyAssistantId === "string" && bodyAssistantId.trim() ? bodyAssistantId.trim() : null;

    if (!emailTrim) {
      return NextResponse.json({ error: "E-posta gerekli" }, { status: 400 });
    }
    if (!displayNameTrim) {
      return NextResponse.json({ error: "Görünen ad gerekli" }, { status: 400 });
    }

    if (!canAssignRole(session, wantGlobalRole, wantAdmin)) {
      return NextResponse.json({ error: "Sadece Admin kullanıcıları Admin rolü atayabilir. Yönetici en fazla Yönetici rolü atayabilir." }, { status: 403 });
    }

    if (wantAdmin && assistantUserId) {
      return NextResponse.json({ error: "Admin kullanıcıya yardımcı atanamaz" }, { status: 400 });
    }
    if (assistantUserId) {
      const assistantUser = await prisma.user.findUnique({
        where: { id: assistantUserId },
        select: { id: true, isAdmin: true, globalRole: true },
      });
      if (!assistantUser) {
        return NextResponse.json({ error: "Yardımcı olarak seçilen kullanıcı bulunamadı" }, { status: 400 });
      }
      if (assistantUser.isAdmin || assistantUser.globalRole === GLOBAL_ROLE.ADMIN) {
        return NextResponse.json({ error: "Admin kullanıcı yardımcı olarak atanamaz" }, { status: 400 });
      }
    }

    const existing = await prisma.user.findUnique({
      where: { email: emailTrim },
    });
    if (existing) {
      return NextResponse.json({ error: "Bu e-posta adresi zaten kayıtlı" }, { status: 409 });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const user = await prisma.user.create({
      data: {
        email: emailTrim,
        displayName: displayNameTrim,
        passwordHash,
        ldapDn: null,
        source: "MANUAL",
        mustChangePassword: true,
        isActive: isActive !== false,
        isAdmin: wantAdmin,
        globalRole: wantGlobalRole,
        assistantUserId: assistantUserId || undefined,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        isActive: true,
        isAdmin: true,
        globalRole: true,
        assistantUserId: true,
        assistant: { select: { id: true, email: true, displayName: true } },
      },
    });

    const unitMemberships = Array.isArray(bodyUnitMemberships)
      ? bodyUnitMemberships.filter(
          (m: unknown): m is { unitId: string; role: string } =>
            typeof m === "object" &&
            m !== null &&
            typeof (m as { unitId?: unknown }).unitId === "string" &&
            typeof (m as { role?: unknown }).role === "string"
        )
      : [];
    for (const m of unitMemberships) {
      const role = m.role === UNIT_ROLE.BIRIM_YONETICISI ? UNIT_ROLE.BIRIM_YONETICISI : UNIT_ROLE.EKIP_UYESI;
      const unitExists = await prisma.unit.findUnique({ where: { id: m.unitId }, select: { id: true } });
      if (unitExists) {
        await prisma.unitMember.create({
          data: { unitId: m.unitId, userId: user.id, role },
        });
      }
    }

    const mailResult = await sendWelcomeMailLocal({
      toEmail: user.email,
      toName: user.displayName,
      temporaryPassword,
      request,
    });
    if (!mailResult.ok) {
      console.error("Welcome email failed for new user:", user.email, mailResult.error);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        isActive: user.isActive,
        isAdmin: user.isAdmin,
        globalRole: user.globalRole ?? null,
        assistantUserId: user.assistantUserId ?? null,
        assistant: user.assistant ? { id: user.assistant.id, email: user.assistant.email, displayName: user.assistant.displayName } : null,
      },
    });
  } catch (error) {
    console.error("Manual user create failed:", error);
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Login failed for user") || msg.includes("password authentication failed")) {
      return NextResponse.json(
        {
          error:
            "Veritabanına bağlanılamıyor (kullanıcı adı/parola hatası). " +
            "config/setup.json veya .env içindeki DATABASE_URL bilgilerini kontrol edin; kurulumu doğru bilgilerle yeniden yapın.",
        },
        { status: 503 }
      );
    }
    if (msg.includes("Unique constraint failed") && msg.includes("dbo.User")) {
      return NextResponse.json(
        {
          error:
            "Veritabanında User tablosunda eski bir unique kısıt var (ldapDn). " +
            "prisma/drop-ldapdn-unique.sql dosyasını SQL Server'da çalıştırın, ardından tekrar deneyin.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Kullanıcı oluşturulamadı" },
      { status: 500 }
    );
  }
}
