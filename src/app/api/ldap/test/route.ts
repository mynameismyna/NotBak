import { NextRequest, NextResponse } from "next/server";
import LdapAuth from "ldapauth-fork";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettingsFresh } from "@/lib/authz";
import { getLdapConfig } from "@/lib/ldap";

function normalizeSearchFilter(filter: string): string {
  return filter.replace(/%s/g, "{{username}}");
}

function friendlyBindError(msg: string): string {
  if (
    /successful bind must be completed|bind must be completed|invalid credentials|80090308|data 52e|data 775/i.test(
      msg
    )
  ) {
    return "Bind başarısız: Bind DN veya parola hatalı. Parolayı girin; daha önce kaydettiyseniz boş bırakıp önce Kaydet'e basın, sonra Test edin.";
  }
  return msg;
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json({ error: "LDAP test için admin yetkisi gerekli" }, { status: 403 });
    }
    const body = await request.json();
    let { url, bindDn, bindPassword, searchBase, searchFilter } = body;

    if (!bindPassword && (bindDn || searchBase)) {
      const saved = getLdapConfig();
      if (saved?.bindPassword) bindPassword = saved.bindPassword;
    }
    if (!bindPassword?.trim()) {
      return NextResponse.json(
        {
          error:
            "Bağlantı testi için Bind parolası gerekli. Parolayı girin veya önce ayarları Kaydet ile kaydedin.",
        },
        { status: 400 }
      );
    }

    return new Promise<NextResponse>((resolve) => {
      const ldap = new LdapAuth({
        url: url || "ldap://localhost",
        bindDN: bindDn || "",
        bindCredentials: bindPassword || "",
        searchBase: searchBase || "",
        searchFilter: normalizeSearchFilter(searchFilter || "(sAMAccountName={{username}})"),
      });

      ldap.on("error", (err: Error) => {
        ldap.close();
        const raw = err.message || String(err);
        resolve(
          NextResponse.json(
            {
              error: friendlyBindError(raw),
              errorRaw: raw,
            },
            { status: 400 }
          )
        );
      });

      ldap.authenticate("__connection_test_user__", "x", (err: Error | string | null) => {
        ldap.close();
        if (err) {
          const raw = err instanceof Error ? err.message : String(err);
          resolve(
            NextResponse.json(
              {
                error: friendlyBindError(raw) || "LDAP bağlantı hatası",
                errorRaw: raw,
              },
              { status: 400 }
            )
          );
        } else {
          resolve(NextResponse.json({ success: true }));
        }
      });
    });
  } catch (error) {
    console.error("LDAP test failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "LDAP test başarısız",
      },
      { status: 500 }
    );
  }
}
