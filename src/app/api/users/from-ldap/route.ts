import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettingsFresh } from "@/lib/authz";
import { sendWelcomeMailLdap } from "@/lib/email";

/** Seçilen AD/LDAP kullanıcılarını veritabanına ekler. Sadece admin. */
export async function POST(request: NextRequest) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json(
        { error: "AD kullanıcısı eklemek için admin yetkisi gerekli" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const users = Array.isArray(body.users) ? body.users : [];
    if (users.length === 0) {
      return NextResponse.json({ error: "En az bir kullanıcı seçin" }, { status: 400 });
    }

    let added = 0;
    let skipped = 0;

    for (const u of users) {
      const email = (u.email || "").trim();
      const displayName = (u.displayName || "").trim();
      const ldapDn = (u.ldapDn || "").trim();
      if (!email || !ldapDn) {
        skipped++;
        continue;
      }

      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ ldapDn }, { email }],
        },
      });
      if (existing) {
        // Aynı e-posta/DN varsa atlama; DN değişmişse güncelle (AD rename).
        const needsDnRefresh = existing.ldapDn !== ldapDn;
        const needsNameRefresh = displayName && existing.displayName !== displayName;
        if (needsDnRefresh || needsNameRefresh) {
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              ldapDn,
              ...(displayName ? { displayName } : {}),
              source: existing.source || "LDAP",
              lastSyncAt: new Date(),
            },
          });
          added++;
        } else {
          skipped++;
        }
        continue;
      }

      await prisma.user.create({
        data: {
          email,
          displayName: displayName || email,
          ldapDn,
          passwordHash: null,
          source: "LDAP",
          isActive: true,
          isAdmin: false,
        },
      });
      const mailResult = await sendWelcomeMailLdap({
        toEmail: email,
        toName: displayName || email,
        request,
      });
      if (!mailResult.ok) {
        console.error("Welcome email failed for LDAP user:", email, mailResult.error);
      }
      added++;
    }

    return NextResponse.json({ success: true, added, skipped });
  } catch (error) {
    console.error("Users from-ldap failed:", error);
    const msg = error instanceof Error ? error.message : "";
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
      { error: "Kullanıcılar eklenemedi" },
      { status: 500 }
    );
  }
}
