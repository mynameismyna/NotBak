import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettings } from "@/lib/authz";

export async function GET(request: NextRequest) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";
    const sort = searchParams.get("sort") || "name";

    const where: { isActive?: boolean } = {};
    if (filter === "active") where.isActive = true;
    if (filter === "inactive") where.isActive = false;

    const users = await prisma.user.findMany({
      where,
      orderBy: sort === "hierarchy" ? [{ isAdmin: "desc" }, { displayName: "asc" }] : { displayName: "asc" },
      select: {
        id: true,
        email: true,
        displayName: true,
        isActive: true,
        isAdmin: true,
        globalRole: true,
        ldapDn: true,
        source: true,
        lastSyncAt: true,
        assistantUserId: true,
        assistant: { select: { id: true, email: true, displayName: true } },
        unitMemberships: {
          select: { unitId: true, role: true, unit: { select: { id: true, name: true } } },
        },
      },
    });

    // ldapDn / source / lastSyncAt / yardımcı bilgisi yalnızca Ayarlar >
    // Kullanıcılar sayfasında (Admin) gösterilir; normal kullanıcılara dönen
    // dropdown listesinde bu dizin bilgileri sızdırılmaz.
    const includeDirectoryFields = canAccessSettings(session);

    let result = users.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      isActive: u.isActive,
      isAdmin: u.isAdmin,
      globalRole: u.globalRole ?? null,
      unitMemberships: u.unitMemberships.map((m) => ({ unitId: m.unitId, role: m.role, unit: m.unit })),
      ...(includeDirectoryFields
        ? {
            ldapDn: u.ldapDn,
            source: u.source ?? (u.ldapDn ? "LDAP" : "MANUAL"),
            lastSyncAt: u.lastSyncAt?.toISOString() ?? null,
            assistantUserId: u.assistantUserId ?? null,
            assistant: u.assistant
              ? { id: u.assistant.id, email: u.assistant.email, displayName: u.assistant.displayName }
              : null,
          }
        : {}),
    }));

    if (sort === "hierarchy") {
      const roleOrder = (r: string | null) => (r === "ADMIN" ? 0 : r === "YONETICI" ? 1 : 2);
      result = result.sort((a, b) => {
        if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
        const ra = roleOrder(a.globalRole);
        const rb = roleOrder(b.globalRole);
        if (ra !== rb) return ra - rb;
        const aUnitRole = a.unitMemberships?.[0]?.role === "BIRIM_YONETICISI" ? 0 : 1;
        const bUnitRole = b.unitMemberships?.[0]?.role === "BIRIM_YONETICISI" ? 0 : 1;
        if (aUnitRole !== bUnitRole) return aUnitRole - bUnitRole;
        return (a.displayName || "").localeCompare(b.displayName || "");
      });
    }

    return NextResponse.json({ users: result });
  } catch (error) {
    console.error("Users list failed:", error);
    const rawMessage = error instanceof Error ? error.message : String(error);
    let userMessage = "Kullanıcı listesi alınamadı.";
    if (rawMessage.includes("Login failed for user") || rawMessage.includes("password") || rawMessage.includes("authentication")) {
      userMessage =
        "Veritabanı girişi reddedildi. config/setup.json veya .env içindeki DATABASE_URL (kullanıcı adı ve parola) doğru mu kontrol edin. Parolayı değiştirdiyseniz kurulumu tekrar çalıştırıp yeni parolayı kaydedin.";
    }
    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}
