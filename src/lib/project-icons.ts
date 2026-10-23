import { z } from "zod";

/** Veritabanında saklanan proje ikon anahtarları (private yalnızca Bana Özel kartı için). */
export const PROJECT_ICON_KEYS = [
  "folder",
  "briefcase",
  "database",
  "code",
  "truck",
  "store",
  "users",
  "chart",
  "wrench",
  "globe",
  "shield",
  "package",
  "building",
  "mail",
  "clipboard",
  "layers",
  "cart",
  "target",
] as const;

export type ProjectIconKey = (typeof PROJECT_ICON_KEYS)[number];

export const DEFAULT_PROJECT_ICON_KEY: ProjectIconKey = "folder";

/** Proje oluşturma / düzenleme seçicisinde gösterilen ikonlar. */
export const PROJECT_ICON_PICKER_KEYS: readonly ProjectIconKey[] = PROJECT_ICON_KEYS;

export const PROJECT_ICON_LABELS: Record<ProjectIconKey, string> = {
  folder: "Klasör",
  briefcase: "İş / ofis",
  database: "Veritabanı / ERP",
  code: "Yazılım",
  truck: "Lojistik",
  store: "Mağaza",
  users: "Ekip / İK",
  chart: "Rapor",
  wrench: "Operasyon",
  globe: "Web / entegrasyon",
  shield: "Güvenlik / KKY",
  package: "Depo / stok",
  building: "Kurumsal",
  mail: "İletişim",
  clipboard: "Süreç",
  layers: "Çoklu modül",
  cart: "Satış",
  target: "Hedef / proje",
};

export const projectIconKeySchema = z.enum(PROJECT_ICON_KEYS);

export function isProjectIconKey(value: string): value is ProjectIconKey {
  return (PROJECT_ICON_KEYS as readonly string[]).includes(value);
}

export function normalizeProjectIconKey(value: string | null | undefined): ProjectIconKey {
  if (value && isProjectIconKey(value)) return value;
  return DEFAULT_PROJECT_ICON_KEY;
}
