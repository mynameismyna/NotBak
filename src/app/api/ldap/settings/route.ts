import { NextRequest, NextResponse } from "next/server";
import { getLdapConfig, saveLdapConfig } from "@/lib/ldap";
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
      return NextResponse.json({ error: "Bu ayarlara sadece Admin erişebilir" }, { status: 403 });
    }
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const config = getLdapConfig();
    if (!config) {
      return NextResponse.json({ config: null });
    }

    return NextResponse.json({
      config: {
        url: config.url,
        bindDn: config.bindDn,
        searchBase: config.searchBase,
        searchFilter: config.searchFilter,
        groupFilter: config.groupFilter,
        preferredEmailDomain: config.preferredEmailDomain,
      },
    });
  } catch (error) {
    console.error("LDAP settings get failed:", error);
    return NextResponse.json(
      { error: "Ayarlar alınamadı" },
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
      return NextResponse.json({ error: "LDAP ayarlarına sadece Admin erişebilir" }, { status: 403 });
    }
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const body = await request.json();
    const { url, bindDn, bindPassword, searchBase, searchFilter, groupFilter, preferredEmailDomain } = body;
    const existing = getLdapConfig();

    saveLdapConfig({
      url: url || "ldap://localhost",
      bindDn: bindDn || "",
      bindPassword: bindPassword !== undefined && bindPassword !== "" ? bindPassword : (existing?.bindPassword ?? ""),
      searchBase: searchBase || "",
      searchFilter: searchFilter || "(sAMAccountName={{username}})",
      groupFilter: groupFilter || undefined,
      preferredEmailDomain: preferredEmailDomain?.trim() || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LDAP settings save failed:", error);
    return NextResponse.json(
      { error: "Ayarlar kaydedilemedi" },
      { status: 500 }
    );
  }
}
