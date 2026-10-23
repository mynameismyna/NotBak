import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";

let ensured = false;

export async function ensureInboundEmailRecordTable(): Promise<void> {
  if (ensured) return;
  const url = (getSetupConfig()?.databaseUrl ?? process.env.DATABASE_URL ?? "").toLowerCase();

  if (url.startsWith("sqlserver://")) {
    try {
      await prisma.$executeRawUnsafe(`
        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'InboundEmailRecord')
        BEGIN
          CREATE TABLE dbo.InboundEmailRecord (
            id NVARCHAR(50) NOT NULL PRIMARY KEY,
            fromEmail NVARCHAR(320) NOT NULL,
            userId NVARCHAR(50) NULL,
            subject NVARCHAR(1000) NOT NULL,
            bodyText NVARCHAR(MAX) NULL,
            bodyHtml NVARCHAR(MAX) NULL,
            messageId NVARCHAR(500) NULL UNIQUE,
            status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
            convertedTaskId NVARCHAR(50) NULL,
            receivedAt DATETIME2 NOT NULL DEFAULT GETDATE()
          );
        END
      `);
      ensured = true;
    } catch {
      // Tablo zaten var olabilir — varlığını kontrol et
      try {
        await prisma.$executeRawUnsafe(
          `SELECT TOP 0 * FROM dbo.InboundEmailRecord`
        );
        ensured = true;
      } catch {
        // Tablo gerçekten yok ve oluşturulamadı
      }
    }
  } else if (url.startsWith("postgresql://")) {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "InboundEmailRecord" (
          "id" TEXT PRIMARY KEY,
          "fromEmail" VARCHAR(320) NOT NULL,
          "userId" TEXT,
          "subject" VARCHAR(1000) NOT NULL,
          "bodyText" TEXT,
          "bodyHtml" TEXT,
          "messageId" VARCHAR(500) UNIQUE,
          "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
          "convertedTaskId" TEXT,
          "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
        );
      `);
      ensured = true;
    } catch {
      try {
        await prisma.$executeRawUnsafe(
          `SELECT 1 FROM "InboundEmailRecord" LIMIT 0`
        );
        ensured = true;
      } catch {
        // Tablo gerçekten yok ve oluşturulamadı
      }
    }
  }
}
