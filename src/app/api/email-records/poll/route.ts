import { NextRequest, NextResponse } from "next/server";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettings } from "@/lib/authz";
import { pollInboundEmails } from "@/lib/imap-poller";

let lastPollTime = 0;
const MIN_POLL_INTERVAL_MS = 30_000;

export async function POST(request: NextRequest) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }
    if (!canAccessSettings(session)) {
      return NextResponse.json({ error: "E-posta yoklamasını sadece Admin tetikleyebilir" }, { status: 403 });
    }

    const now = Date.now();
    if (now - lastPollTime < MIN_POLL_INTERVAL_MS) {
      return NextResponse.json({
        error: "Son yoklamadan bu yana en az 30 saniye beklenmeli.",
        retryAfterMs: MIN_POLL_INTERVAL_MS - (now - lastPollTime),
      }, { status: 429 });
    }
    lastPollTime = now;

    const result = await pollInboundEmails();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Email poll failed:", error);
    return NextResponse.json(
      { error: "Yoklama başarısız" },
      { status: 500 }
    );
  }
}
