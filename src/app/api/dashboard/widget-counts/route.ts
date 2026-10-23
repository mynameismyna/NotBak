import { NextResponse } from "next/server";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { fetchWidgetCounts } from "@/lib/dashboard-metrics";

/** Dashboard widget kutuları için tüm sayıları tek istekte döndürür. */
export async function GET(request: Request) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session?.id) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const counts = await fetchWidgetCounts(session.id, {
      id: session.id,
      email: session.email,
      isAdmin: session.isAdmin,
      globalRole: session.globalRole ?? null,
    });

    return NextResponse.json(counts);
  } catch (error) {
    console.error("Widget counts failed:", error);
    return NextResponse.json(
      { error: "Sayılar alınamadı" },
      { status: 500 }
    );
  }
}
