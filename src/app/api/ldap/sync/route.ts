import { NextRequest, NextResponse } from "next/server";
import { getLdapConfig } from "@/lib/ldap";
import { fetchUsersFromLdap } from "@/lib/ldap-fetch-users";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettingsFresh } from "@/lib/authz";

async function syncLdapUsers(): Promise<{ added: number; updated: number; entriesFound?: number }> {
  const config = getLdapConfig();
  if (!config) {
    throw new Error("LDAP yapılandırması bulunamadı");
  }

  const { users, entriesFound } = await fetchUsersFromLdap(config, {
    preferredEmailDomain: config.preferredEmailDomain,
  });

  let added = 0;
  let updated = 0;

  for (const u of users) {
    // Önce DN, yoksa e-posta ile eşle (AD'de CN/OU değişince DN kayar).
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ ldapDn: u.ldapDn }, { email: u.email }],
      },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          email: u.email,
          displayName: u.displayName,
          ldapDn: u.ldapDn,
          lastSyncAt: new Date(),
        },
      });
      updated++;
    } else {
      await prisma.user.create({
        data: {
          email: u.email,
          displayName: u.displayName,
          ldapDn: u.ldapDn,
          isActive: false,
        },
      });
      added++;
    }
  }

  return { added, updated, entriesFound };
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json({ error: "LDAP senkron için admin yetkisi gerekli" }, { status: 403 });
    }
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const result = await syncLdapUsers();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("LDAP sync failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "LDAP senkron başarısız",
      },
      { status: 500 }
    );
  }
}
