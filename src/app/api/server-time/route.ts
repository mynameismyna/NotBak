import { NextResponse } from "next/server";

/** Sunucunun yerel saatini ve UTC sapmasını döner (e-posta özeti sayfasında kullanıcı saati ile karşılaştırmak için). */
export async function GET() {
  const now = new Date();
  const offsetMin = -now.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offsetMin) / 60);
  const offsetMins = Math.abs(offsetMin) % 60;
  const sign = offsetMin >= 0 ? "+" : "-";
  const offsetLabel = `UTC${sign}${offsetHours}${offsetMins ? `:${String(offsetMins).padStart(2, "0")}` : ""}`;
  const serverTimeLabel = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  return NextResponse.json({
    serverTimeIso: now.toISOString(),
    serverTimeLabel,
    serverOffsetMinutes: offsetMin,
    serverOffsetLabel: offsetLabel,
  });
}
