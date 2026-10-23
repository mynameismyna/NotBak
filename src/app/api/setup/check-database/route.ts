import { NextRequest, NextResponse } from "next/server";
import { isSetupRouteAllowed } from "@/lib/setup-guard";

const REQUIRED_TABLES = [
  "User", "Unit", "UnitMember", "Project", "ProjectMember", "ProjectDelegate",
  "Team", "TeamMember", "Task", "TaskCollaborator", "Comment", "ProblemReport",
  "Notification", "ImportPendingApproval", "ProjectJoinRequest",
  "InboundEmailRecord", "AppSetting",
];

async function sqlServerDatabaseExists(
  host: string,
  port: number,
  user: string,
  password: string,
  encrypt: boolean,
  databaseName: string
): Promise<boolean> {
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
  const escaped = databaseName.replace(/'/g, "''");
  const result = await pool.request().query(`SELECT 1 AS ok FROM sys.databases WHERE name = N'${escaped}'`);
  const exists = (result.recordset || []).length > 0;
  await pool.close();
  return exists;
}

async function checkSqlServerTables(
  host: string,
  port: number,
  database: string,
  user: string,
  password: string,
  encrypt: boolean
): Promise<string[]> {
  const sql = await import("mssql");
  const config = {
    server: host,
    port,
    database,
    user,
    password,
    options: { encrypt: encrypt !== false, trustServerCertificate: true },
  };
  const pool = await sql.default.connect(config);
  const tableList = REQUIRED_TABLES.map((t) => `'${t}'`).join(", ");
  const result = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE' 
    AND TABLE_NAME IN (${tableList})
  `);
  const existing = (result.recordset || []).map((r: { TABLE_NAME: string }) => r.TABLE_NAME);
  await pool.close();
  return REQUIRED_TABLES.filter((t) => !existing.includes(t));
}

async function postgresDatabaseExists(
  host: string,
  port: number,
  user: string,
  password: string,
  databaseName: string
): Promise<boolean> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    host,
    port,
    database: "postgres",
    user,
    password,
    ssl: false,
  });
  const result = await pool.query("SELECT 1 AS ok FROM pg_database WHERE datname = $1", [databaseName]);
  const exists = result.rows.length > 0;
  await pool.end();
  return exists;
}

async function checkPostgresTables(
  host: string,
  port: number,
  database: string,
  user: string,
  password: string
): Promise<string[]> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    host,
    port,
    database,
    user,
    password,
    ssl: false,
  });
  const allCases = REQUIRED_TABLES.flatMap((t) => [`'${t}'`, `'${t.toLowerCase()}'`]);
  const tableList = [...new Set(allCases)].join(", ");
  const result = await pool.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN (${tableList})
  `);
  const existing = result.rows.map((r) => r.tablename?.toLowerCase());
  await pool.end();
  return REQUIRED_TABLES.filter((t) => !existing.includes(t.toLowerCase()));
}

export async function POST(request: NextRequest) {
  try {
    if (!isSetupRouteAllowed(request.headers.get("cookie"))) {
      return NextResponse.json({ error: "Bu işlem için admin yetkisi gerekli" }, { status: 403 });
    }
    const body = await request.json();
    const { dbType, host, port, database, user, password, encrypt } = body;
    const dbName = (database || "db_notbak").trim() || "db_notbak";
    const h = host || "localhost";
    const p = dbType === "sqlserver" ? (Number(port) || 1433) : (Number(port) || 5432);
    const u = dbType === "sqlserver" ? (user || "notbak") : (user || "postgres");
    const pass = password || "";

    let databaseExists: boolean;
    if (dbType === "sqlserver") {
      databaseExists = await sqlServerDatabaseExists(h, p, u, pass, encrypt !== false, dbName);
    } else {
      databaseExists = await postgresDatabaseExists(h, p, u, pass, dbName);
    }

    if (!databaseExists) {
      return NextResponse.json({
        databaseExists: false,
        tablesMissing: [...REQUIRED_TABLES],
      });
    }

    let tablesMissing: string[];
    if (dbType === "sqlserver") {
      tablesMissing = await checkSqlServerTables(h, p, dbName, u, pass, encrypt !== false);
    } else {
      tablesMissing = await checkPostgresTables(h, p, dbName, u, pass);
    }

    return NextResponse.json({ databaseExists: true, tablesMissing });
  } catch (error) {
    console.error("Check database failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Veritabanı kontrolü başarısız",
      },
      { status: 400 }
    );
  }
}
