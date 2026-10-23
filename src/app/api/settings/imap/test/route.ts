import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettingsFresh } from "@/lib/authz";
import { getImapConfigFromDb } from "@/lib/imap-config";

export interface DebugStep {
  step: string;
  status: "ok" | "fail";
  message: string;
  detail?: string;
}

export interface ImapFolderInfo {
  path: string;
  name: string;
  messages: number;
  delimiter: string;
}

export async function POST(request: NextRequest) {
  const steps: DebugStep[] = [];
  const add = (step: string, status: "ok" | "fail", message: string, detail?: string) => {
    steps.push({ step, status, message, detail });
  };

  try {
    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json({ error: "IMAP testine sadece Admin erişebilir" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const host = typeof body.host === "string" ? body.host.trim() : "";
    const port = typeof body.port === "number" ? body.port : 993;
    const secure = body.secure !== false;
    const user = typeof body.user === "string" ? body.user.trim() : "";
    let password = typeof body.password === "string" ? body.password : "";
    const rejectUnauthorized = body.rejectUnauthorized !== false;

    add("1. Parametreler", "ok", "İstek alındı", JSON.stringify({ host, port, secure, user, rejectUnauthorized }, null, 2));

    if (!host) {
      add("2. Doğrulama", "fail", "Sunucu (host) boş");
      return NextResponse.json({ success: false, steps, folders: [] });
    }
    if (!user) {
      add("2. Doğrulama", "fail", "Kullanıcı adı boş");
      return NextResponse.json({ success: false, steps, folders: [] });
    }
    add("2. Doğrulama", "ok", "Host, port ve kullanıcı geçerli");

    if (password === "••••••••") {
      const existing = await getImapConfigFromDb();
      password = existing?.password ?? "";
    }

    const { ImapFlow } = await import("imapflow");
    const client = new ImapFlow({
      host,
      port,
      secure,
      auth: { user, pass: password },
      tls: { rejectUnauthorized },
      logger: false,
    });

    try {
      await client.connect();
      add("3. IMAP bağlantısı", "ok", "Sunucuya bağlanıldı, kimlik doğrulama başarılı");

      // Klasör listesini al
      const folders: ImapFolderInfo[] = [];
      try {
        const tree = await client.list();
        for (const item of tree) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const entry = item as any;
          folders.push({
            path: entry.path || entry.name || "",
            name: entry.name || entry.path || "",
            messages: typeof entry.status?.messages === "number" ? entry.status.messages : -1,
            delimiter: entry.delimiter || "/",
          });
        }

        // Her klasör için mesaj sayısını STATUS ile almayı dene
        for (const f of folders) {
          if (f.messages < 0) {
            try {
              const status = await client.status(f.path, { messages: true, unseen: true });
              f.messages = status?.messages ?? 0;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (f as any).unseen = status?.unseen ?? 0;
            } catch {
              f.messages = 0;
            }
          }
        }

        add("4. Klasör listeleme", "ok", `${folders.length} klasör bulundu`, folders.map(f => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const unseen = (f as any).unseen;
          return `${f.path} (${f.messages} mesaj${unseen !== undefined ? `, ${unseen} okunmamış` : ""})`;
        }).join("\n"));
      } catch (listErr) {
        add("4. Klasör listeleme", "fail", `Klasörler listelenemedi: ${(listErr as Error).message}`);
      }

      await client.logout();
      add("5. Bağlantı kapatma", "ok", "Bağlantı başarıyla kapatıldı");
      return NextResponse.json({ success: true, steps, folders });
    } catch (connErr) {
      const err = connErr as Error;
      add("3. IMAP bağlantısı", "fail", err.message || String(connErr), String(connErr));
      try { await client.logout(); } catch { /* ignore */ }
      return NextResponse.json({ success: false, steps, folders: [] });
    }
  } catch (error) {
    console.error("IMAP test failed:", error);
    add("0. Hata", "fail", error instanceof Error ? error.message : "Beklenmeyen hata", String(error));
    return NextResponse.json({ success: false, steps, folders: [] }, { status: 200 });
  }
}
