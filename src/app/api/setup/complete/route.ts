import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { getSetupConfig, saveSetupConfig } from "@/lib/config";
import { isRemoteSchemaResetAllowed } from "@/lib/loopback-host";
import { createPrismaClientWithUrl } from "@/lib/prisma";

function getConnectionString(
  dbType: string,
  host: string,
  port: number,
  database: string,
  user: string,
  password: string,
  encrypt?: boolean
): string {
  if (dbType === "sqlserver") {
    const enc = encrypt !== false ? "encrypt=true" : "encrypt=false";
    return `sqlserver://${host}:${port};database=${database};user=${user};password=${encodeURIComponent(password)};${enc};trustServerCertificate=true`;
  }
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}?sslmode=disable`;
}

function toErrorMessage(error: unknown, dbType?: "postgresql" | "sqlserver"): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("P1011") || msg.includes("TLS") || msg.includes("sertifika") || msg.includes("certificate")) {
      if (dbType === "sqlserver")
        return "Veritabanı TLS/sertifika hatası. SQL Server için kurulum bağlantı dizinine trustServerCertificate=true ekliyor; tekrar deneyin.";
      return "Veritabanı TLS hatası. PostgreSQL için bağlantı dizinine ?sslmode=disable eklenmeli. Lütfen tekrar deneyin.";
    }
    if (msg.includes("ECONNREFUSED") || msg.includes("connect"))
      return "Veritabanına bağlanılamadı. Servisin çalıştığından ve .env içinde DATABASE_URL doğru olduğundan emin olun.";
    if (msg.includes("P1001") || msg.includes("Can't reach"))
      return "Veritabanı sunucusuna ulaşılamıyor. Sunucu çalışıyor mu? Port doğru mu?";
    return msg;
  }
  return "Beklenmeyen hata.";
}

async function createDatabaseIfNotExists(
  dbType: "postgresql" | "sqlserver",
  host: string,
  port: number,
  user: string,
  password: string,
  databaseName: string,
  encrypt?: boolean
): Promise<void> {
  const safeName = databaseName.replace(/[^\w]/g, "").slice(0, 128) || "db_notbak";
  if (dbType === "sqlserver") {
    const sql = await import("mssql");
    const config = {
      server: host,
      port,
      database: "master",
      user,
      password,
      options: { encrypt: encrypt !== false, trustServerCertificate: true },
    };
    const pool = await sql.default.connect(config);
    const escaped = safeName.replace(/'/g, "''");
    const bracketName = safeName.replace(/\]/g, "]]");
    await pool.request().query(`IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'${escaped}') CREATE DATABASE [${bracketName}]`);
    await pool.close();
  } else {
    const { Pool } = await import("pg");
    const pool = new Pool({
      host,
      port,
      database: "postgres",
      user,
      password,
      ssl: false,
    });
    const check = await pool.query("SELECT 1 FROM pg_database WHERE datname = $1", [safeName]);
    if (check.rows.length === 0) {
      await pool.query(`CREATE DATABASE "${safeName}"`);
    }
    await pool.end();
  }
}

export async function POST(request: NextRequest) {
  try {
    const existing = getSetupConfig();
    if (existing?.setupComplete) {
      return NextResponse.json(
        { error: "Kurulum zaten tamamlandı. Yeniden kurulum için NotBak.bat ile 'Yeniden Kurulum' seçeneğini kullanın." },
        { status: 400 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Geçersiz istek gövdesi (JSON bekleniyor)." }, { status: 400 });
    }
    const adminEmail = String(body.adminEmail || "admin@notbak.local");
    const adminPassword = String(body.adminPassword || "");

    const effectiveDbType = body.dbType === "postgresql" ? "postgresql" : "sqlserver";
    const effectivePort = effectiveDbType === "postgresql" ? (Number(body.port) || 5432) : (Number(body.port) || 1433);
    const effectiveUser = effectiveDbType === "postgresql" ? (String(body.user || "postgres")) : (String(body.user || "notbak"));
    const databaseName = (String(body.database || "db_notbak").trim() || "db_notbak").replace(/[^\w]/g, "") || "db_notbak";
    const targetHost = String(body.host || "localhost");
    const tablesAlreadyExist = body.tablesAlreadyExist === true;
    if (!tablesAlreadyExist && !isRemoteSchemaResetAllowed(targetHost)) {
      return NextResponse.json(
        {
          error:
            "Uzak veritabanında şema sıfırlama kapalıdır. Boş kurulum için localhost veya 127.0.0.1 kullanın. Bilinçli uzak sıfırlama yalnızca NOTBAK_ALLOW_REMOTE_DB_RESET=true ile açılır.",
        },
        { status: 400 }
      );
    }

    if (body.databaseExists === false) {
      try {
        await createDatabaseIfNotExists(
          effectiveDbType,
          targetHost,
          effectivePort,
          effectiveUser,
          String(body.password || ""),
          databaseName,
          body.encrypt as boolean | undefined
        );
      } catch (createErr) {
        console.error("Create database failed:", createErr);
        const msg = createErr instanceof Error ? createErr.message : String(createErr);
        return NextResponse.json(
          { error: "Veritabanı oluşturulamadı: " + msg },
          { status: 500 }
        );
      }
    }

    const connectionString = getConnectionString(
      effectiveDbType,
      targetHost,
      effectivePort,
      databaseName,
      effectiveUser,
      String(body.password || ""),
      body.encrypt as boolean | undefined
    );

    // Copy schema based on dbType
    const schemaDir = path.join(process.cwd(), "prisma");
    const schemaFile = effectiveDbType === "postgresql" ? "schema.postgresql.prisma" : "schema.sqlserver.prisma";
    const schemaPath = path.join(schemaDir, schemaFile);
    const mainSchemaPath = path.join(schemaDir, "schema.prisma");
    if (!fs.existsSync(schemaPath))
      return NextResponse.json({ error: `Şema dosyası bulunamadı: ${schemaFile}` }, { status: 500 });
    fs.copyFileSync(schemaPath, mainSchemaPath);

    process.env.DATABASE_URL = connectionString;

    try {
      if (tablesAlreadyExist) {
        // Tablolar zaten var: sadece şemayı senkronize et, mevcut veriyi silme
        execSync("npx prisma db push --accept-data-loss", {
          env: { ...process.env, DATABASE_URL: connectionString },
          cwd: process.cwd(),
          stdio: "pipe",
        });
      } else {
        // Eksik tablolar var veya sıfırdan kurulum: tabloları sıfırdan oluştur
        execSync("npx prisma db push --accept-data-loss --force-reset", {
          env: { ...process.env, DATABASE_URL: connectionString },
          cwd: process.cwd(),
          stdio: "pipe",
        });
      }
    } catch (pushError: unknown) {
      const err = pushError as { message?: string; stderr?: string | Buffer; stdout?: string | Buffer };
      const stderrStr = err.stderr != null ? (Buffer.isBuffer(err.stderr) ? err.stderr.toString() : String(err.stderr)) : String(err.message || "");
      const msg = toErrorMessage(err, effectiveDbType);
      const isTls = stderrStr.includes("P1011") || stderrStr.includes("TLS") || String(err.message || "").includes("P1011");
      const isSchemaConflict = stderrStr.includes("without a default value") || stderrStr.includes("--force-reset");
      let hint = "";
      if (isTls) {
        if (effectiveDbType === "sqlserver")
          hint = " .env içinde DATABASE_URL sonuna ;trustServerCertificate=true ekleyebilirsiniz.";
        else
          hint = " .env içinde DATABASE_URL sonuna ?sslmode=disable ekleyin.";
      } else if (isSchemaConflict) {
        hint = " Kurulum zaten --force-reset kullanıyor; hata devam ediyorsa veritabanında başka bir uygulama kilidi olabilir.";
      }
      const rawError = stderrStr || (err.message ?? String(pushError));
      return NextResponse.json(
        { error: msg + hint, detail: rawError },
        { status: 500 }
      );
    }
    try {
      execSync("npx prisma generate", {
        env: process.env,
        cwd: process.cwd(),
        stdio: "pipe",
      });
    } catch (genError: unknown) {
      const raw = genError instanceof Error ? genError.message + (genError.stack ? "\n" + genError.stack : "") : String(genError);
      return NextResponse.json(
        { error: toErrorMessage(genError), detail: raw },
        { status: 500 }
      );
    }

    // Create admin user (Prisma 7: adapter ile client)
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const client = createPrismaClientWithUrl(connectionString);

    await client.user.upsert({
      where: { email: adminEmail },
      create: {
        email: adminEmail,
        displayName: "Admin",
        passwordHash,
        isActive: true,
        isAdmin: true,
      },
      update: {
        passwordHash,
        isActive: true,
        isAdmin: true,
      },
    });
    await client.$disconnect();

    // Save config and update .env for Prisma
    saveSetupConfig({
      setupComplete: true,
      dbType: effectiveDbType,
      databaseUrl: connectionString,
      adminEmail,
      adminPasswordHash: passwordHash,
    });

    // Write DATABASE_URL and SETUP_COMPLETE to .env for next app restart
    const envPath = path.join(process.cwd(), ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
      envContent = envContent
        .replace(/^DATABASE_URL=.*$/gm, "")
        .replace(/^SETUP_COMPLETE=.*$/gm, "")
        .replace(/\n{3,}/g, "\n\n");
    }
    envContent += `\nDATABASE_URL="${connectionString}"\nSETUP_COMPLETE=true\n`;
    fs.writeFileSync(envPath, envContent.trim() + "\n", "utf-8");

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Setup complete failed:", error);
    const raw = error instanceof Error ? error.message + (error.stack ? "\n" + error.stack : "") : String(error);
    return NextResponse.json(
      { error: toErrorMessage(error), detail: raw },
      { status: 500 }
    );
  }
}
