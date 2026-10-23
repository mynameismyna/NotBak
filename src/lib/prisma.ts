import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaUrl: string | undefined;
};

/** Kurulum tamamsa config/setup.json öncelikli (sunucu yeniden başlamadan güncel URL kullanılır). */
function getDatabaseUrl(): string {
  try {
    const { getSetupConfig } = require("./config");
    const config = getSetupConfig();
    if (config?.setupComplete && config?.databaseUrl) return config.databaseUrl;
  } catch {
    // ignore
  }
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && !envUrl.includes("placeholder") && !envUrl.includes("__setup_required__")) return envUrl;
  // Kurulum yapılmamışken gerçek sunucuya düşmemek için geçersiz URL döndür (bağlantı hemen hata verir)
  return "postgresql://__setup_required__:x@127.0.0.1:1/__none__";
}

/** sqlserver://host:port;database=x;user=y;password=z;... formatını PrismaMssql config'e çevirir */
export function parseSqlServerUrl(url: string): {
  server: string;
  port: number;
  database: string;
  user: string;
  password: string;
  options: { encrypt: boolean; trustServerCertificate: boolean };
} {
  const u = url.replace(/^sqlserver:\/\//i, "");
  const [hostPart, ...rest] = u.split(";");
  const [server, portStr] = hostPart.split(":");
  const port = portStr ? parseInt(portStr, 10) || 1433 : 1433;
  const params: Record<string, string> = {};
  for (const pair of rest) {
    const eq = pair.indexOf("=");
    if (eq > 0) {
      const key = pair.slice(0, eq).trim().toLowerCase();
      let val = pair.slice(eq + 1).trim();
      if (val.startsWith("{") && val.endsWith("}")) val = val.slice(1, -1);
      params[key] = decodeURIComponent(val);
    }
  }
  return {
    server: server || "localhost",
    port,
    database: params.database || params["initial catalog"] || "notbak",
    user: params.user || params.username || params.uid || params.userid || "notbak",
    password: params.password || params.pwd || "",
    options: {
      encrypt: params.encrypt !== "false",
      trustServerCertificate: params.trustservercertificate === "true" || params.trustservercertificate === "yes",
    },
  };
}

/** Verilen veritabanı URL'i ile yeni bir PrismaClient oluşturur (ör. kurulum tamamlama). sqlserver:// ve postgresql:// desteklenir. */
export function createPrismaClientWithUrl(url: string): PrismaClient {
  if (url.toLowerCase().startsWith("sqlserver://")) {
    const config = parseSqlServerUrl(url);
    const adapter = new PrismaMssql(config);
    return new PrismaClient({ adapter, log: ["error"] });
  }
  if (url.toLowerCase().startsWith("postgresql://")) {
    const adapter = new PrismaPg({ connectionString: url });
    return new PrismaClient({ adapter, log: ["error"] });
  }
  throw new Error("createPrismaClientWithUrl yalnızca sqlserver:// veya postgresql:// URL'leri destekler.");
}

function createPrismaClient(url: string): PrismaClient {
  if (url.startsWith("postgresql://")) {
    const adapter = new PrismaPg({ connectionString: url });
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }
  const config = parseSqlServerUrl(url);
  const adapter = new PrismaMssql(config);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** URL değiştiyse (örn. kurulum sonrası) yeni client döner; aksi halde önbelleği kullanır. */
function getPrisma(): PrismaClient {
  const url = getDatabaseUrl();
  if (globalForPrisma.prismaUrl !== url) {
    if (globalForPrisma.prisma) {
      try {
        void globalForPrisma.prisma.$disconnect();
      } catch {
        // ignore
      }
    }
    globalForPrisma.prismaUrl = url;
    globalForPrisma.prisma = createPrismaClient(url);
  }
  return globalForPrisma.prisma!;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
