import { NextResponse } from "next/server";

/**
 * LDAP / AD görünen adı: "{İsim} {Soyisim} | {Şirket Adı}".
 * Arayüzde yalnızca "|" öncesi gösterilir; "|" yoksa metin olduğu gibi kalır.
 */
export function formatUserDisplayName(name: string | null | undefined): string {
  if (name == null) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  const pipeIndex = trimmed.indexOf("|");
  if (pipeIndex === -1) return trimmed;
  const before = trimmed.slice(0, pipeIndex).trim();
  return before || trimmed;
}

/** API yanıtındaki tüm `displayName` alanlarını görüntüleme için kısaltır. */
export function formatDisplayNamesInPayload<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (data instanceof Date) return data;
  if (Array.isArray(data)) {
    return data.map((item) => formatDisplayNamesInPayload(item)) as T;
  }
  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (key === "displayName" && typeof value === "string") {
        out[key] = formatUserDisplayName(value);
      } else {
        out[key] = formatDisplayNamesInPayload(value);
      }
    }
    return out as T;
  }
  return data;
}

export function jsonWithDisplayNames<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(formatDisplayNamesInPayload(body), init);
}
