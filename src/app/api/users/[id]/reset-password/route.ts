import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { GLOBAL_ROLE } from "@/lib/authz";
import { sendWelcomeMailLocal } from "@/lib/email";

function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** Admin/Yönetici: Lokal kullanıcının parolasını sıfırlar; geçici parola üretir, mail gönderir, mustChangePassword true yapar. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      return NextResponse.json(
        { error: "Parola sıfırlama için Admin veya Yönetici yetkisi gerekli" },
        { status: 403 }
      );
    }

    const { id: userId } = await params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, ldapDn: true, source: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }
    if (user.ldapDn) {
      return NextResponse.json(
        { error: "LDAP kullanıcılarının parolası buradan sıfırlanamaz. AD üzerinden yönetilir." },
        { status: 400 }
      );
    }
    if (user.source === "MASTER") {
      return NextResponse.json(
        { error: "Kurulum (Master) kullanıcısının parolası buradan sıfırlanamaz." },
        { status: 400 }
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true },
    });

    const mailResult = await sendWelcomeMailLocal({
      toEmail: user.email,
      toName: user.displayName,
      temporaryPassword,
      request,
    });
    if (!mailResult.ok) {
      console.error("Reset password welcome email failed:", user.email, mailResult.error);
    }

    return NextResponse.json({
      success: true,
      message: "Parola sıfırlandı. Kullanıcıya geçici parola e-posta ile gönderildi; ilk girişte değiştirmesi gerekecek.",
    });
  } catch (error) {
    console.error("Reset password failed:", error);
    return NextResponse.json(
      { error: "Parola sıfırlanamadı" },
      { status: 500 }
    );
  }
}
