import { NextRequest, NextResponse } from "next/server";
import { resolveBaseUrl } from "@/lib/base-url";
import { runDailyDigest } from "@/lib/daily-digest-cron";
import { isCronRequestAuthorized } from "@/lib/rate-limit";

/**
 * Günlük e-posta özeti cron endpoint'i.
 * Harici tetikleme (Windows Görev Zamanlayıcı, cron) için: GET ?secret=CRON_SECRET
 * Self-host'ta uygulama ayrıca her saat başı dahili zamanlayıcı ile bu işlemi tetikler.
 */
export async function GET(request: NextRequest) {
  try {
    if (!isCronRequestAuthorized(request)) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const baseUrl = resolveBaseUrl(request);
    const result = await runDailyDigest({ baseUrl });

    if (!result.ok) {
      const status = result.error === "Kurulum tamamlanmamış" ? 400 : 500;
      return NextResponse.json(
        { error: result.error || "Günlük özet gönderilemedi" },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      sent: result.sent,
      totalEligible: result.totalEligible,
      currentTime: result.currentTime,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Daily digest cron failed:", error);
    return NextResponse.json(
      { error: "Günlük özet gönderilemedi" },
      { status: 500 }
    );
  }
}
