import { NextRequest, NextResponse } from "next/server";
import { formatUserDisplayName } from "@/lib/display-name";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getLdapConfig } from "@/lib/ldap";
import {
  authenticateLdap,
  authenticateLdapByDn,
  authenticateLdapByEmail,
} from "@/lib/ldap-auth";
import { buildSessionCookie } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const config = getSetupConfig();
    if (!config?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const body = await request.json();
    const { username, password } = body;
    const identifier = (username || body.email || "").trim();

    if (!identifier || !password) {
      return NextResponse.json({ error: "Kullanıcı adı/e-posta ve parola gerekli" }, { status: 400 });
    }

    // Brute-force koruması: hedef hesap başına 10 deneme / 5 dk,
    // IP başına 30 deneme / 5 dk.
    const clientIp = getClientIp(request.headers);
    const perAccount = checkRateLimit(`login:acc:${clientIp}:${identifier.toLowerCase()}`, 10, 5 * 60 * 1000);
    const perIp = checkRateLimit(`login:ip:${clientIp}`, 30, 5 * 60 * 1000);
    if (!perAccount.allowed || !perIp.allowed) {
      const retryAfter = Math.max(perAccount.retryAfterSec, perIp.retryAfterSec);
      return NextResponse.json(
        { error: "Çok fazla giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const ldapConfig = getLdapConfig();

    if (ldapConfig) {
      let ldapUser = await authenticateLdap(identifier, password);

      // E-posta ile giriş: sAMAccountName filtresi e-posta ile eşleşmez.
      // 1) AD'de mail/UPN/proxyAddresses ile güncel DN bul + bind
      // 2) Başarısızsa DB'deki ldapDn ile dene (geriye dönük)
      // Başarılı girişte bayat ldapDn otomatik güncellenir.
      if (!ldapUser && identifier.includes("@")) {
        ldapUser = await authenticateLdapByEmail(identifier, password);

        if (!ldapUser) {
          const dbUserByEmail = await prisma.user.findFirst({
            where: { email: identifier, ldapDn: { not: null } },
            select: {
              id: true,
              email: true,
              displayName: true,
              ldapDn: true,
            },
          });
          if (dbUserByEmail?.ldapDn && (await authenticateLdapByDn(dbUserByEmail.ldapDn, password))) {
            ldapUser = {
              dn: dbUserByEmail.ldapDn,
              mail: dbUserByEmail.email,
              displayName: dbUserByEmail.displayName ?? undefined,
            };
          }
        }
      }

      if (ldapUser) {
        const allowedDomain = ldapConfig.preferredEmailDomain?.toLowerCase().replace(/^@/, "");
        if (allowedDomain) {
          const mail = (ldapUser.mail || "").toLowerCase();
          if (!mail.endsWith("@" + allowedDomain)) {
            return NextResponse.json(
              { error: `Sadece @${ldapConfig.preferredEmailDomain} e-posta adresine sahip kullanıcılar giriş yapabilir.` },
              { status: 403 }
            );
          }
        }
        const dbUser = await prisma.user.findFirst({
          where: {
            OR: [{ ldapDn: ldapUser.dn }, { email: ldapUser.mail || identifier }],
          },
          select: {
            id: true,
            email: true,
            displayName: true,
            isAdmin: true,
            globalRole: true,
            isActive: true,
            ldapDn: true,
          },
        });
        if (!dbUser) {
          return NextResponse.json(
            { error: "Kullanıcı bulunamadı. LDAP senkronu yapıldığından emin olun." },
            { status: 403 }
          );
        }
        if (!dbUser.isActive) {
          return NextResponse.json({ error: "Hesabınız aktif değil. Yönetici ile iletişime geçin." }, { status: 403 });
        }

        // AD'de CN/OU değişince DN kayar; girişte güncel DN'i kaydet.
        if (ldapUser.dn && dbUser.ldapDn !== ldapUser.dn) {
          try {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: {
                ldapDn: ldapUser.dn,
                ...(ldapUser.displayName ? { displayName: ldapUser.displayName } : {}),
                lastSyncAt: new Date(),
              },
            });
          } catch (syncErr) {
            console.error("LDAP DN refresh on login failed:", syncErr);
          }
        }

        const sessionUser = {
          id: dbUser.id,
          email: dbUser.email,
          displayName: formatUserDisplayName(dbUser.displayName) || dbUser.displayName,
          isAdmin: dbUser.isAdmin,
          globalRole: dbUser.globalRole ?? undefined,
          isLdapUser: true,
        };
        const cookie = buildSessionCookie(sessionUser);
        if (!cookie) {
          return NextResponse.json(
            { error: "Sunucu oturum yapılandırması eksik (SESSION_SECRET tanımlı değil)." },
            { status: 500 }
          );
        }
        const response = NextResponse.json({ success: true, user: sessionUser });
        response.cookies.set(cookie.name, cookie.value, cookie.options);
        return response;
      }
    }

    const user = await prisma.user.findUnique({
      where: { email: identifier },
      select: { id: true, email: true, displayName: true, isAdmin: true, globalRole: true, passwordHash: true, isActive: true, mustChangePassword: true },
    });

    // Kullanıcı bulunamadı / parolasız hesap / yanlış parola: hepsi aynı
    // mesajı döner (user enumeration engellenir). Hesap durumu yalnızca
    // parola doğrulandıktan sonra açıklanır.
    if (!user?.passwordHash) {
      return NextResponse.json({ error: "Geçersiz kullanıcı adı veya parola" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Geçersiz kullanıcı adı veya parola" }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Hesabınız aktif değil. Yönetici ile iletişime geçin." }, { status: 403 });
    }

    const sessionUser = {
      id: user.id,
      email: user.email,
      displayName: formatUserDisplayName(user.displayName) || user.displayName,
      isAdmin: user.isAdmin,
      globalRole: user.globalRole ?? undefined,
      isLdapUser: false,
    };
    const cookie = buildSessionCookie(sessionUser);
    if (!cookie) {
      return NextResponse.json(
        { error: "Sunucu oturum yapılandırması eksik (SESSION_SECRET tanımlı değil)." },
        { status: 500 }
      );
    }
    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      mustChangePassword: user.mustChangePassword === true,
    });
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json(
      { error: "Giriş başarısız" },
      { status: 500 }
    );
  }
}
