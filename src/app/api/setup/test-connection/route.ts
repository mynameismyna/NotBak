import { NextRequest, NextResponse } from "next/server";
import { isSetupRouteAllowed } from "@/lib/setup-guard";

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
    return `sqlserver://${host}:${port};database=${database};user=${user};password=${encodeURIComponent(password)};${enc}`;
  }
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}?sslmode=disable`;
}

function toErrorPayload(error: unknown): { error: string; detail?: string } {
  const err = error as { code?: string; message?: string; port?: number; errors?: Array<{ port?: number }> };
  let message = "Bağlantı testi başarısız";
  if (error && typeof error === "object" && "code" in error) {
    const isPort5432 = err.port === 5432 || err.errors?.some((e) => e.port === 5432);
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
      if (isPort5432) {
        message =
          "PostgreSQL'e bağlanılamadı. Servis çalışmıyor olabilir. " +
          "Windows: services.msc ile 'postgresql' servisini başlatın. " +
          "Docker: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=notbak postgres:16";
      } else {
        const isPort1433 = err.port === 1433 || err.errors?.some((e) => e.port === 1433);
        message = isPort1433
          ? "Port 1433 SQL Server içindir. Adım 1'de PostgreSQL seçin, port 5432 kullanın."
          : "Sunucu çalışmıyor veya port yanlış (PostgreSQL: 5432, SQL Server: 1433).";
      }
    } else if (err.message?.includes("password") || err.message?.includes("authentication")) {
      message = "Kullanıcı adı veya parola hatalı. PostgreSQL'de postgres kullanıcısının parolasını kontrol edin.";
    } else if (err.message?.includes("does not exist") || err.message?.includes("database")) {
      message = "Veritabanı bulunamadı. Önce PostgreSQL'de 'notbak' veritabanını oluşturun: CREATE DATABASE notbak;";
    } else if (error instanceof Error) {
      message = error.message;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }
  const detail = error instanceof Error ? error.stack : String(error);
  return { error: message, detail };
}

export async function POST(request: NextRequest) {
  try {
    if (!isSetupRouteAllowed(request.headers.get("cookie"))) {
      return NextResponse.json({ error: "Bu işlem için admin yetkisi gerekli" }, { status: 403 });
    }
    return await handleTestConnection(request);
  } catch (outer: unknown) {
    console.error("test-connection unhandled:", outer);
    const msg = outer instanceof Error ? outer.message : String(outer);
    const detail = outer instanceof Error ? (outer.stack || "") : "";
    return NextResponse.json(
      { error: "Sunucu hatası. " + msg, detail },
      { status: 500 }
    );
  }
}

async function handleTestConnection(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (parseErr) {
    console.error("test-connection: JSON parse failed", parseErr);
    return NextResponse.json(
      { error: "Geçersiz istek gövdesi (JSON bekleniyor).", detail: parseErr instanceof Error ? parseErr.message : String(parseErr) },
      { status: 400 }
    );
  }

  const { host, port, database, user, password, encrypt } = body;
  const effectiveDbType = body.dbType === "postgresql" ? "postgresql" : "sqlserver";
  const effectivePort = effectiveDbType === "postgresql" ? (Number(port) || 5432) : (Number(port) || 1433);
  const effectiveUser = effectiveDbType === "postgresql" ? (String(user || "postgres")) : (String(user || "notbak"));

  const connectionString = getConnectionString(
    effectiveDbType,
    String(host || "localhost"),
    effectivePort,
    String(database || "notbak"),
    effectiveUser,
    String(password || ""),
    encrypt as boolean | undefined
  );

  try {
    if (effectiveDbType === "sqlserver") {
      const { default: sql } = await import("mssql");
      const config = {
        server: String(host || "localhost"),
        port: effectivePort,
        database: String(database || "notbak"),
        user: effectiveUser,
        password: String(password || ""),
        options: {
          encrypt: encrypt !== false,
          trustServerCertificate: true,
        },
      };
      const pool = await sql.connect(config);
      await pool.close();
    } else {
      const { Pool } = await import("pg");
      const pool = new Pool({
        connectionString,
        ssl: false,
      });
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      await pool.end();
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Connection test failed:", error);
    const { error: message, detail } = toErrorPayload(error);
    return NextResponse.json({ error: message, detail }, { status: 400 });
  }
}
