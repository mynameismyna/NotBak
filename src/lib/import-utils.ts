import type { TaskType, TaskStatus } from "@/types";

const PRIORITY_MAP: Record<string, string> = {
  acil: "URGENT",
  yüksek: "HIGH",
  orta: "MEDIUM",
  düşük: "LOW",
  URGENT: "URGENT",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

const STATUS_MAP: Record<string, string> = {
  yeni: "YENI",
  "devam ediyor": "DEVAM_EDIYOR",
  beklemede: "BEKLEMEDE",
  tamamlandı: "TAMAMLANDI",
  tamamlandi: "TAMAMLANDI",
  YENI: "YENI",
  DEVAM_EDIYOR: "DEVAM_EDIYOR",
  BEKLEMEDE: "BEKLEMEDE",
  TAMAMLANDI: "TAMAMLANDI",
};

export function parsePriority(val: unknown): string {
  if (!val || typeof val !== "string") return "MEDIUM";
  const key = String(val).trim().toLowerCase();
  return PRIORITY_MAP[key] ?? "MEDIUM";
}

export function parseStatus(val: unknown): string {
  if (!val || typeof val !== "string") return "YENI";
  const key = String(val).trim().toLowerCase();
  return STATUS_MAP[key] ?? "YENI";
}

/** Geçerli tarih aralığı: 2000-01-01 ile 2100-12-31 */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

export function parseDate(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  let d: Date;
  if (val instanceof Date) {
    d = val;
  } else if (typeof val === "number") {
    if (val < 1 || val > 1000000) return null;
    const excelEpoch = new Date(1899, 11, 30);
    d = new Date(excelEpoch.getTime() + val * 86400 * 1000);
  } else {
    const s = String(val).trim();
    if (!s) return null;
    d = new Date(s);
  }
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  return d.toISOString().slice(0, 10);
}

export function parseBool(val: unknown): boolean {
  if (val === true || val === "true" || val === "evet" || val === "Evet" || val === "EVET" || val === "1") return true;
  return false;
}

export interface ParsedRow {
  title: string;
  description: string;
  priority: string;
  dueDate: string;
  status?: string;
  assigneeEmail: string;
  projectName: string;
  isPrivate: boolean;
  type: TaskType;
}

/** Excel satırından ParsedRow çıkarır. type NOT için status yok. */
export function parseExcelRow(
  row: Record<string, unknown>,
  type: TaskType,
  isTask: boolean
): ParsedRow | null {
  const title = String(row["Başlık"] ?? row["baslik"] ?? "").trim();
  const description = String(row["Açıklama"] ?? row["aciklama"] ?? "").trim();
  if (!title || !description) return null;

  const dueDate = parseDate(row["Son Tarih"] ?? row["sonTarih"] ?? row["Son Tarih"]);
  const today = new Date().toISOString().slice(0, 10);
  const finalDueDate = dueDate || today;

  const assigneeEmail = String(row["Sorumlu E-posta"] ?? row["sorumluEposta"] ?? "").trim();
  const projectName = String(row["Proje Adı"] ?? row["projeAdi"] ?? "").trim();
  const isPrivate = parseBool(row["Bana Özel"] ?? row["banaOzel"] ?? false);

  const priority = parsePriority(row["Öncelik"] ?? row["oncelik"]);
  const status = isTask ? parseStatus(row["Durum"] ?? row["durum"]) : "YENI";

  return {
    title,
    description,
    priority: priority as "URGENT" | "HIGH" | "MEDIUM" | "LOW",
    dueDate: finalDueDate,
    ...(isTask ? { status: status as TaskStatus } : {}),
    assigneeEmail,
    projectName,
    isPrivate,
    type,
  };
}
