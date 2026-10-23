import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  /** false ise TLS sertifika doğrulaması atlanır (dahili/özel CA için). Varsayılan true. */
  rejectUnauthorized: boolean;
}

const SMTP_KEY = "smtp";

function getDatabaseUrl(): string {
  const env = process.env.DATABASE_URL;
  if (env && !env.includes("placeholder")) return env;
  return getSetupConfig()?.databaseUrl ?? "";
}

/** AppSetting tablosu yoksa oluşturur. Migration elle çalıştırılmamışsa kaydetme/okuma öncesi gerekir. */
async function ensureAppSettingTable(): Promise<void> {
  try {
    const url = getDatabaseUrl().toLowerCase();
    if (url.startsWith("postgresql://")) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AppSetting" (
          "id" TEXT PRIMARY KEY,
          "key" TEXT NOT NULL UNIQUE,
          "value" TEXT NOT NULL
        );
      `);
      return;
    }
    if (url.startsWith("sqlserver://")) {
      await prisma.$executeRawUnsafe(`
        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'AppSetting')
        BEGIN
          CREATE TABLE dbo.AppSetting (
            id NVARCHAR(50) NOT NULL PRIMARY KEY,
            [key] NVARCHAR(100) NOT NULL UNIQUE,
            value NVARCHAR(MAX) NOT NULL
          );
        END
      `);
      return;
    }
  } catch {
    // Tablo zaten var veya farklı DB; devam et
  }
}

export async function getSmtpConfigFromDb(): Promise<SmtpConfig | null> {
  try {
    await ensureAppSettingTable();
    const row = await prisma.appSetting.findUnique({
      where: { key: SMTP_KEY },
    });
    if (!row?.value) return null;
    const parsed = JSON.parse(row.value) as Record<string, unknown>;
    const host = typeof parsed.host === "string" ? parsed.host.trim() : "";
    if (!host) return null;
    const port = typeof parsed.port === "number" ? parsed.port : typeof parsed.port === "string" ? parseInt(parsed.port, 10) || 587 : 587;
    const secure = parsed.secure === true || parsed.secure === "true" || parsed.secure === "1";
    const rejectUnauthorized = parsed.rejectUnauthorized === false ? false : true;
    return { host, port, secure, rejectUnauthorized };
  } catch {
    return null;
  }
}

export async function saveSmtpConfigToDb(config: {
  host: string;
  port: number;
  secure: boolean;
  rejectUnauthorized?: boolean;
}): Promise<void> {
  await ensureAppSettingTable();
  const rejectUnauthorized = config.rejectUnauthorized === false ? false : true;
  const value = JSON.stringify({
    host: config.host.trim(),
    port: config.port || 587,
    secure: config.secure,
    rejectUnauthorized,
  });
  await prisma.appSetting.upsert({
    where: { key: SMTP_KEY },
    create: { id: `smtp-${Date.now()}`, key: SMTP_KEY, value },
    update: { value },
  });
}

/** API yanıtı için. */
export async function getSmtpConfigForApi(): Promise<SmtpConfig | null> {
  return getSmtpConfigFromDb();
}
