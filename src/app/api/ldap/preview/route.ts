import { NextRequest, NextResponse } from "next/server";
import { getLdapConfig } from "@/lib/ldap";
import { fetchUsersFromLdap } from "@/lib/ldap-fetch-users";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettingsFresh } from "@/lib/authz";

/**
 * AD/LDAP üzerindeki kullanıcıları listeler (veritabanına yazmaz).
 * Sadece admin. LDAP ayarları kayıtlı olmalı.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json(
        { error: "AD listesi için admin yetkisi gerekli" },
        { status: 403 }
      );
    }

    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const config = getLdapConfig();
    if (!config) {
      return NextResponse.json(
        { error: "LDAP ayarları yok. Önce ayarları kaydedin." },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const noFilter = url.searchParams.get("all") === "1" || url.searchParams.get("noFilter") === "1";
    const debug = url.searchParams.get("debug") === "1";

    const result = await fetchUsersFromLdap(config, {
      noGroupFilter: noFilter,
      collectFirstEntryDebug: debug || noFilter,
      preferredEmailDomain: config.preferredEmailDomain,
    });
    const { users, entriesFound, firstEntryDebug } = result;
    const body: Record<string, unknown> = {
      success: true,
      entriesFound,
      count: users.length,
      users: users.map((u) => ({ email: u.email, displayName: u.displayName, ldapDn: u.ldapDn, samAccountName: u.samAccountName })),
    };
    if (firstEntryDebug) body.firstEntryDebug = firstEntryDebug;
    return NextResponse.json(body);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("LDAP preview failed:", msg);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AD listesi alınamadı",
      },
      { status: 500 }
    );
  }
}
