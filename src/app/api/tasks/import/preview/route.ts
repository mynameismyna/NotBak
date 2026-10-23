import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { parseExcelRow } from "@/lib/import-utils";
import type { TaskType, TaskStatus, Priority } from "@/types";

const MAX_ROWS = 500;
/** 500 satırlık makul bir Excel için fazlasıyla yeterli; bellek tüketimi DoS'unu engeller. */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const typeParam = (formData.get("type") as string) || "NOT";
    const type = (typeParam.toUpperCase() === "GOREV" ? "GOREV" : "NOT") as TaskType;
    const isTask = type === "GOREV";

    if (!file) {
      return NextResponse.json({ error: "Dosya gerekli" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Dosya boyutu en fazla ${MAX_FILE_SIZE / (1024 * 1024)} MB olabilir` },
        { status: 400 }
      );
    }

    const fileName = (file.name || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
      return NextResponse.json(
        { error: "Yalnızca .xlsx, .xls veya .csv dosyaları yüklenebilir" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `En fazla ${MAX_ROWS} satır yüklenebilir` },
        { status: 400 }
      );
    }

    const previewRows = [];

    for (let i = 0; i < rows.length; i++) {
      const parsed = parseExcelRow(rows[i], type, isTask);
      if (!parsed) continue;

      const status = (parsed.status || "YENI") as TaskStatus;
      const priority = parsed.priority as Priority;

      previewRows.push({
        index: i,
        title: parsed.title,
        description: parsed.description,
        type: parsed.type,
        isPrivate: parsed.isPrivate ?? false,
        priority,
        dueDate: parsed.dueDate,
        status,
        assigneeId: session.id,
        projectId: null as string | null,
      });
    }

    return NextResponse.json({
      rows: previewRows,
      currentUser: {
        id: session.id,
        displayName: session.displayName,
        email: session.email,
      },
    });
  } catch (error) {
    console.error("Import preview failed:", error);
    return NextResponse.json(
      { error: "Önizleme oluşturulamadı" },
      { status: 500 }
    );
  }
}

