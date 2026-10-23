import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettingsFresh } from "@/lib/authz";
import { getLdapConfig } from "@/lib/ldap";

export interface DebugStep {
  step: string;
  status: "ok" | "fail";
  message: string;
  detail?: string;
}

/**
 * LDAP bağlantısını adım adım test eder; her adımın sonucunu döndürür (debug).
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json({ error: "Admin yetkisi gerekli" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const saved = getLdapConfig();
    let url = body.url || saved?.url || "ldap://localhost";
    let bindDn = body.bindDn ?? saved?.bindDn ?? "";
    let bindPassword = body.bindPassword ?? saved?.bindPassword ?? "";
    let searchBase = body.searchBase ?? saved?.searchBase ?? "";

    const steps: DebugStep[] = [];
    const add = (step: string, status: "ok" | "fail", message: string, detail?: string) => {
      steps.push({ step, status, message, detail });
    };

    add("1. Parametreler", "ok", "İstek alındı", JSON.stringify({
      url,
      bindDn: bindDn ? `${bindDn.substring(0, 20)}...` : "(boş)",
      bindPasswordKullanildi: !!bindPassword,
      searchBase,
    }, null, 2));

    if (!bindDn?.trim()) {
      add("2. Bind DN", "fail", "Bind DN boş", "LDAP ayarlarında Bind DN girin.");
      return NextResponse.json({ success: false, steps });
    }
    if (!bindPassword) {
      add("2. Bind parolası", "fail", "Parola yok", "Parolayı girin veya önce Kaydet ile kaydedin.");
      return NextResponse.json({ success: false, steps });
    }
    if (!searchBase?.trim()) {
      add("2. Search Base", "fail", "Search Base boş", "LDAP ayarlarında Search Base girin.");
      return NextResponse.json({ success: false, steps });
    }

    const ldap = await import("ldapjs");
    const client = ldap.createClient({ url: String(url) });

    client.on("error", (err: Error) => {
      add("3. Bağlantı (event)", "fail", err.message || "LDAP client error", String(err));
    });

    return new Promise<NextResponse>((resolve) => {
      const finish = (success: boolean) => {
        try {
          client.unbind?.((_: Error) => {});
        } catch {
          // ignore
        }
        try {
          client.destroy?.();
        } catch {
          // ignore
        }
        resolve(NextResponse.json({ success, steps }));
      };

      add("2. TCP bağlantısı", "ok", `Sunucuya bağlanılıyor: ${url}`, "");

      client.bind(bindDn, bindPassword, (bindErr: Error | null) => {
        if (bindErr) {
          const msg = bindErr.message || String(bindErr);
          add("3. Bind (kimlik doğrulama)", "fail", msg, String(bindErr));
          finish(false);
          return;
        }
        add("3. Bind (kimlik doğrulama)", "ok", "Bind başarılı", "");

        const opts = {
          filter: "(objectClass=user)",
          scope: "base" as const,
          attributes: ["1.1"],
          sizeLimit: 1,
        };
        client.search(searchBase, opts, (searchErr: Error | null, res: { on: (e: string, fn: (a: unknown) => void) => void } | undefined) => {
          if (searchErr) {
            const msg = searchErr.message || String(searchErr);
            add("4. Arama (search)", "fail", msg, String(searchErr));
            finish(false);
            return;
          }
          if (!res) {
            add("4. Arama (search)", "fail", "Yanıt yok", "");
            finish(false);
            return;
          }
          res.on("searchEntry", () => {
            // base scope ile 0 veya 1 entry gelebilir
          });
          res.on("error", (e: unknown) => {
            add("4. Arama (search)", "fail", e instanceof Error ? e.message : String(e), String(e));
          });
          res.on("end", () => {
            add("4. Arama (search)", "ok", "Arama tamamlandı", "Search Base erişilebilir.");
            finish(true);
          });
        });
      });
    });
  } catch (error) {
    console.error("LDAP test-debug failed:", error);
    return NextResponse.json(
      {
        success: false,
        steps: [
          {
            step: "0. Hata",
            status: "fail" as const,
            message: error instanceof Error ? error.message : "Beklenmeyen hata",
            detail: String(error),
          },
        ],
      },
      { status: 200 }
    );
  }
}
