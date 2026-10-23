import { NextRequest, NextResponse } from "next/server";
import { getSetupConfig } from "@/lib/config";
import { pollInboundEmails } from "@/lib/imap-poller";
import { isCronRequestAuthorized } from "@/lib/rate-limit";

/**
 * IMAP e-posta yoklama cron endpoint'i.
 * Windows Görev Zamanlayıcı veya sistem cron ile periyodik olarak çağrılır.
 * Örnek: curl "http://localhost:3000/api/cron/imap-poll?secret=CRON_SECRET"
 *
 * Ayarlardaki pollInterval'e göre (varsayılan 5 dk) Task Scheduler'da sıklık ayarlanmalıdır.
 */
export async function GET(request: NextRequest) {
  try {
    if (!isCronRequestAuthorized(request)) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const result = await pollInboundEmails();
    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("IMAP cron poll failed:", error);
    return NextResponse.json(
      { error: "Yoklama başarısız" },
      { status: 500 }
    );
  }
}
