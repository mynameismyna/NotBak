import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getSessionFromHeaders } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = getSessionFromHeaders(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
  }

  try {
    const filePath = path.join(process.cwd(), "docs", "KULLANIM_KILAVUZU.md");
    const content = await readFile(filePath, "utf-8");
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ content: "Kullanım kılavuzu dosyası bulunamadı." });
  }
}
