/** Yerel takvim günü için YYYY-MM-DD (date input ile uyumlu). */
export function toYmdLocal(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

/**
 * Son tarih seçiminde: bugün ve öncesi seçilemez → `input type="date"` için `min`.
 * İlk seçilebilir gün yarın (yerel saat dilimi).
 */
export function tomorrowYmdLocal(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return toYmdLocal(d);
}
