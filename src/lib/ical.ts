/**
 * iCalendar (RFC 5545) .ics içeriği üretir.
 * Görev/not son tarihine göre tek günlük (all-day) etkinlik oluşturur.
 */

function escapeIcalText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export interface IcalTaskInput {
  id: string;
  title: string;
  description?: string;
  dueDate: Date | string;
}

/**
 * Görev/not için .ics (iCalendar) metni döndürür.
 * Son tarih (dueDate) gününde all-day etkinlik oluşturulur.
 */
export function buildIcsForTask(input: IcalTaskInput): string {
  const due = typeof input.dueDate === "string" ? new Date(input.dueDate) : input.dueDate;
  const y = due.getFullYear();
  const m = String(due.getMonth() + 1).padStart(2, "0");
  const d = String(due.getDate()).padStart(2, "0");
  const dateStr = `${y}${m}${d}`;
  const nextDay = new Date(due);
  nextDay.setDate(nextDay.getDate() + 1);
  const endDateStr = `${nextDay.getFullYear()}${String(nextDay.getMonth() + 1).padStart(2, "0")}${String(nextDay.getDate()).padStart(2, "0")}`;
  const summary = escapeIcalText(input.title.slice(0, 500));
  const description = input.description
    ? escapeIcalText(input.description.slice(0, 2000))
    : "";
  const uid = `task-${input.id}@notbak`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NotBak//Görev//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatIcalUtc(new Date())}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${endDateStr}`,
    `SUMMARY:${summary}`,
  ];
  if (description) {
    lines.push(`DESCRIPTION:${description}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

function formatIcalUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}
