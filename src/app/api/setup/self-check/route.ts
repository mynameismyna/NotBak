import { NextRequest, NextResponse } from "next/server";
import { isSetupRouteAllowed } from "@/lib/setup-guard";
import { getSetupConfig, saveSetupConfig } from "@/lib/config";
import { createPrismaClientWithUrl, parseSqlServerUrl } from "@/lib/prisma";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";

const REQUIRED_TABLES = [
  "User", "Unit", "UnitMember", "Project", "ProjectMember", "ProjectDelegate",
  "Team", "TeamMember", "Task", "TaskCollaborator", "Comment", "ProblemReport",
  "Notification", "ImportPendingApproval", "ProjectJoinRequest",
  "InboundEmailRecord", "AppSetting",
];

interface CheckResult {
  id: string;
  label: string;
  status: "pass" | "fail";
  message: string;
  fixable: boolean;
  detail?: string;
}

async function getMissingTables(databaseUrl: string): Promise<string[]> {
  if (databaseUrl.toLowerCase().startsWith("sqlserver://")) {
    const config = parseSqlServerUrl(databaseUrl);
    const sql = await import("mssql");
    const pool = await sql.default.connect(config);
    const tableList = REQUIRED_TABLES.map(t => `'${t}'`).join(", ");
    const result = await pool.request().query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' AND TABLE_NAME IN (${tableList})`
    );
    const existing = (result.recordset || []).map((r: { TABLE_NAME: string }) => r.TABLE_NAME);
    await pool.close();
    return REQUIRED_TABLES.filter(t => !existing.includes(t));
  }

  const url = new URL(databaseUrl);
  const { Pool } = await import("pg");
  const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.replace(/^\//, ""),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: false,
  });
  const allCases = REQUIRED_TABLES.flatMap(t => [`'${t}'`, `'${t.toLowerCase()}'`]);
  const tableList = [...new Set(allCases)].join(", ");
  const result = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN (${tableList})`
  );
  const existing = result.rows.map((r: Record<string, string>) => r.tablename?.toLowerCase());
  await pool.end();
  return REQUIRED_TABLES.filter(t => !existing.includes(t.toLowerCase()));
}

export async function POST(request: NextRequest) {
  try {
    if (!isSetupRouteAllowed(request.headers.get("cookie"))) {
      return NextResponse.json({ error: "Bu işlem için admin yetkisi gerekli" }, { status: 403 });
    }
    const body = await request.json().catch(() => ({})) as { autoFix?: boolean };
    const autoFix = body.autoFix === true;
    const checks: CheckResult[] = [];
    const envPath = path.join(process.cwd(), ".env");
    let client: ReturnType<typeof createPrismaClientWithUrl> | null = null;

    try {
      // ---- 1. Yapılandırma dosyası (config/setup.json) ----
      let config = getSetupConfig();
      let configOk = config?.setupComplete === true && !!config?.databaseUrl;

      if (!configOk && autoFix) {
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, "utf-8");
          const dbUrlMatch = envContent.match(/^DATABASE_URL="?([^"\n]+)"?$/m);
          if (dbUrlMatch) {
            const dbUrl = dbUrlMatch[1];
            const dbType = dbUrl.startsWith("sqlserver://") ? "sqlserver" : "postgresql";
            saveSetupConfig({
              setupComplete: true,
              dbType: dbType as "postgresql" | "sqlserver",
              databaseUrl: dbUrl,
              adminEmail: config?.adminEmail || "admin@notbak.local",
              adminPasswordHash: config?.adminPasswordHash,
            });
            config = getSetupConfig();
            configOk = config?.setupComplete === true && !!config?.databaseUrl;
          }
        }
      }

      checks.push({
        id: "config",
        label: "Yapılandırma Dosyası",
        status: configOk ? "pass" : "fail",
        message: configOk
          ? "config/setup.json geçerli"
          : config ? "setupComplete veya databaseUrl eksik" : "config/setup.json bulunamadı",
        fixable: !configOk,
      });

      // ---- 2. Ortam değişkenleri (.env) ----
      let envOk = false;
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, "utf-8");
        const hasDbUrl = /^DATABASE_URL=.+$/m.test(envContent);
        const hasSetupComplete = /^SETUP_COMPLETE=.*true/m.test(envContent);
        envOk = hasDbUrl && hasSetupComplete;

        if (!envOk && autoFix && config?.databaseUrl) {
          envContent = envContent
            .replace(/^DATABASE_URL=.*$/gm, "")
            .replace(/^SETUP_COMPLETE=.*$/gm, "")
            .replace(/\n{3,}/g, "\n\n");
          envContent += `\nDATABASE_URL="${config.databaseUrl}"\nSETUP_COMPLETE=true\n`;
          fs.writeFileSync(envPath, envContent.trim() + "\n", "utf-8");
          process.env.DATABASE_URL = config.databaseUrl;
          envOk = true;
        }
      } else if (autoFix && config?.databaseUrl) {
        fs.writeFileSync(envPath, `DATABASE_URL="${config.databaseUrl}"\nSETUP_COMPLETE=true\n`, "utf-8");
        process.env.DATABASE_URL = config.databaseUrl;
        envOk = true;
      }

      checks.push({
        id: "env",
        label: "Ortam Değişkenleri (.env)",
        status: envOk ? "pass" : "fail",
        message: envOk
          ? "DATABASE_URL ve SETUP_COMPLETE mevcut"
          : !fs.existsSync(envPath) ? ".env dosyası bulunamadı" : "DATABASE_URL veya SETUP_COMPLETE eksik",
        fixable: !envOk,
      });

      // ---- 3. Veritabanı bağlantısı ----
      const databaseUrl = config?.databaseUrl;
      let connOk = false;

      if (databaseUrl) {
        try {
          client = createPrismaClientWithUrl(databaseUrl);
          await client.$queryRawUnsafe("SELECT 1 AS ok");
          connOk = true;
          checks.push({
            id: "dbconn",
            label: "Veritabanı Bağlantısı",
            status: "pass",
            message: "Veritabanına başarıyla bağlanıldı",
            fixable: false,
          });
        } catch (err) {
          checks.push({
            id: "dbconn",
            label: "Veritabanı Bağlantısı",
            status: "fail",
            message: err instanceof Error ? err.message : "Bağlantı başarısız",
            fixable: false,
            detail: err instanceof Error ? err.stack : undefined,
          });
          if (client) { try { await client.$disconnect(); } catch {} client = null; }
        }
      } else {
        checks.push({
          id: "dbconn",
          label: "Veritabanı Bağlantısı",
          status: "fail",
          message: "Veritabanı URL'i tanımlı değil",
          fixable: false,
        });
      }

      // ---- 4. Tablo varlık kontrolü ----
      let tablesOk = false;

      if (connOk && databaseUrl) {
        try {
          let missing = await getMissingTables(databaseUrl);

          if (missing.length > 0 && autoFix) {
            try {
              execSync("npx prisma db push --accept-data-loss", {
                env: { ...process.env, DATABASE_URL: databaseUrl },
                cwd: process.cwd(),
                stdio: "pipe",
              });
              if (client) { try { await client.$disconnect(); } catch {} }
              client = createPrismaClientWithUrl(databaseUrl);
              missing = await getMissingTables(databaseUrl);
            } catch {
              // prisma db push başarısız, orijinal eksik tabloları raporla
            }
          }

          tablesOk = missing.length === 0;
          checks.push({
            id: "tables",
            label: `Veritabanı Tabloları (${REQUIRED_TABLES.length})`,
            status: tablesOk ? "pass" : "fail",
            message: tablesOk
              ? `Tüm ${REQUIRED_TABLES.length} tablo mevcut`
              : `${missing.length} tablo eksik: ${missing.join(", ")}`,
            fixable: !tablesOk,
            detail: tablesOk ? undefined : missing.join(", "),
          });
        } catch (err) {
          checks.push({
            id: "tables",
            label: `Veritabanı Tabloları (${REQUIRED_TABLES.length})`,
            status: "fail",
            message: err instanceof Error ? err.message : "Tablo kontrolü başarısız",
            fixable: true,
            detail: err instanceof Error ? err.stack : undefined,
          });
        }
      } else {
        checks.push({
          id: "tables",
          label: `Veritabanı Tabloları (${REQUIRED_TABLES.length})`,
          status: "fail",
          message: "Veritabanı bağlantısı olmadığı için kontrol edilemedi",
          fixable: false,
        });
      }

      // ---- 5. Admin kullanıcı ----
      if (connOk && tablesOk && client) {
        try {
          const admin = await client.user.findFirst({
            where: { isAdmin: true, isActive: true },
            select: { id: true, email: true },
          });

          if (admin) {
            checks.push({
              id: "admin",
              label: "Admin Kullanıcı",
              status: "pass",
              message: `Admin mevcut: ${admin.email}`,
              fixable: false,
            });
          } else if (autoFix && config?.adminEmail && config?.adminPasswordHash) {
            await client.user.upsert({
              where: { email: config.adminEmail },
              create: {
                email: config.adminEmail,
                displayName: "Admin",
                passwordHash: config.adminPasswordHash,
                isActive: true,
                isAdmin: true,
              },
              update: {
                passwordHash: config.adminPasswordHash,
                isActive: true,
                isAdmin: true,
              },
            });
            checks.push({
              id: "admin",
              label: "Admin Kullanıcı",
              status: "pass",
              message: `Admin oluşturuldu: ${config.adminEmail}`,
              fixable: false,
            });
          } else {
            checks.push({
              id: "admin",
              label: "Admin Kullanıcı",
              status: "fail",
              message: "Aktif admin kullanıcı bulunamadı",
              fixable: !!config?.adminEmail,
            });
          }
        } catch (err) {
          checks.push({
            id: "admin",
            label: "Admin Kullanıcı",
            status: "fail",
            message: err instanceof Error ? err.message : "Admin kontrolü başarısız",
            fixable: true,
            detail: err instanceof Error ? err.stack : undefined,
          });
        }
      } else {
        checks.push({
          id: "admin",
          label: "Admin Kullanıcı",
          status: "fail",
          message: tablesOk ? "Bağlantı gerekli" : "Tablolar eksik olduğu için kontrol edilemedi",
          fixable: false,
        });
      }

      // ---- 6. Prisma client işlevselliği ----
      if (connOk && tablesOk && client) {
        try {
          const count = await client.user.count();
          checks.push({
            id: "prisma",
            label: "Prisma Client",
            status: "pass",
            message: `Prisma client çalışıyor (${count} kullanıcı kayıtlı)`,
            fixable: false,
          });
        } catch (err) {
          if (autoFix && databaseUrl) {
            try {
              execSync("npx prisma generate", {
                env: { ...process.env, DATABASE_URL: databaseUrl },
                cwd: process.cwd(),
                stdio: "pipe",
              });
              if (client) { try { await client.$disconnect(); } catch {} }
              const newClient = createPrismaClientWithUrl(databaseUrl);
              const count = await newClient.user.count();
              await newClient.$disconnect();
              client = null;
              checks.push({
                id: "prisma",
                label: "Prisma Client",
                status: "pass",
                message: `Düzeltildi — Prisma client çalışıyor (${count} kullanıcı)`,
                fixable: false,
              });
            } catch (fixErr) {
              checks.push({
                id: "prisma",
                label: "Prisma Client",
                status: "fail",
                message: fixErr instanceof Error ? fixErr.message : "Prisma düzeltilemedi",
                fixable: true,
              });
            }
          } else {
            checks.push({
              id: "prisma",
              label: "Prisma Client",
              status: "fail",
              message: err instanceof Error ? err.message : "Prisma client başarısız",
              fixable: true,
            });
          }
        }
      } else {
        checks.push({
          id: "prisma",
          label: "Prisma Client",
          status: "fail",
          message: "Önceki kontroller başarısız olduğu için çalıştırılamadı",
          fixable: false,
        });
      }
    } finally {
      if (client) { try { await client.$disconnect(); } catch {} }
    }

    const allPassed = checks.every(c => c.status === "pass");
    return NextResponse.json({ checks, allPassed });
  } catch (error) {
    console.error("Self-check failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Self-check başarısız", checks: [], allPassed: false },
      { status: 500 }
    );
  }
}
