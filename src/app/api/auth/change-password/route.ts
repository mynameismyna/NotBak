import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionFromHeaders } from "@/lib/auth";

/** Lokal kullanıcı kendi parolasını değiştirir. Başarıda mustChangePassword false yapılır. */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session?.id) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }
    if (session.isLdapUser) {
      return NextResponse.json(
        { error: "LDAP kullanıcıları parolayı buradan değiştiremez. Şirket sisteminiz üzerinden değiştirin." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Mevcut parola ve yeni parola gerekli" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Yeni parola en az 6 karakter olmalı" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, passwordHash: true },
    });
    if (!user?.passwordHash) {
      return NextResponse.json({ error: "Hesap bulunamadı veya parola değiştirilemez" }, { status: 400 });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Mevcut parola hatalı" }, { status: 401 });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, mustChangePassword: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Change password failed:", error);
    return NextResponse.json(
      { error: "Parola değiştirilemedi" },
      { status: 500 }
    );
  }
}
