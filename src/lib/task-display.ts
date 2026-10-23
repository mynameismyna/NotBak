/**
 * Proje adı seçilmemiş kayıtlar için gösterim: "[Proje Adı (opsiyonel)]" → "Proje adı"
 */
const PROJECT_PLACEHOLDER_REGEX = /\[Proje\s*Adı\s*\(opsiyonel\)\]\s*/gi;
const DESCRIPTION_PLACEHOLDER_REGEX = /\[Proje:\s*Proje\s*Adı\s*\(opsiyonel\)\s*-\s*sistemde bulunamadı\]/gi;

export function normalizeTaskTitleForDisplay(title: string | null | undefined): string {
  if (title == null || title === "") return "";
  return title.replace(PROJECT_PLACEHOLDER_REGEX, "Proje adı ").trim();
}

export function normalizeTaskDescriptionForDisplay(description: string | null | undefined): string {
  if (description == null || description === "") return "";
  return description.replace(DESCRIPTION_PLACEHOLDER_REGEX, "[Proje: Proje adı - sistemde bulunamadı]");
}
