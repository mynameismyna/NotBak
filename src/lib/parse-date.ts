/** API / Prisma tarih alanlarını güvenli şekilde Date'e çevirir. */
export function parseAppDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatAppDate(
  value: unknown,
  options?: Intl.DateTimeFormatOptions,
  locale = "tr-TR"
): string {
  const d = parseAppDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(locale, options);
}

export function formatAppDateTime(value: unknown, locale = "tr-TR"): string {
  const d = parseAppDate(value);
  if (!d) return "—";
  return d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

/** `<input type="date">` için YYYY-MM-DD */
export function toDateInputValue(value: unknown): string {
  const d = parseAppDate(value);
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}
