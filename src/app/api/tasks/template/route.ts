import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";

/** type: NOT | GOREV - Hangi şablon indirilecek */
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
    const type = (searchParams.get("type") || "NOT").toUpperCase();
    const isTask = type === "GOREV";

    // Yeni tasarıma göre Excel şablonu yalnızca başlık ve açıklama içerir.
    const headers = ["Başlık", "Açıklama"];

    const exampleRow = ["Örnek kayıt başlığı", "Bu alana açıklama metnini yazabilirsiniz."];

    const wsData = [headers, exampleRow];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isTask ? "Görevler" : "Notlar");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = "toplu_yukleme_sablonu.xlsx";

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Template download failed:", error);
    return NextResponse.json(
      { error: "Şablon indirilemedi" },
      { status: 500 }
    );
  }
}
