import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

export interface SetupConfig {
  setupComplete: boolean;
  dbType?: "postgresql" | "sqlserver";
  databaseUrl?: string;
  adminEmail?: string;
  adminPasswordHash?: string;
}

const CONFIG_PATH = path.join(process.cwd(), "config", "setup.json");

/**
 * setup.json kurulumdan sonra neredeyse hiç değişmez. Her istekte (ve her
 * prisma erişiminde) senkron disk okuması yapmamak için bellekte cache'lenir.
 * saveSetupConfig çağrıldığında cache anında geçersiz kılınır; ek güvenlik
 * için kısa bir TTL ile dış değişiklikler de kısa sürede yansır.
 */
const CONFIG_CACHE_TTL_MS = 5000;
let cachedConfig: SetupConfig | null = null;
let cachedConfigExists = false;
let cachedAt = 0;

export function invalidateSetupConfigCache(): void {
  cachedAt = 0;
  cachedConfig = null;
  cachedConfigExists = false;
}

export function getSetupConfig(): SetupConfig | null {
  const now = Date.now();
  if (cachedAt !== 0 && now - cachedAt < CONFIG_CACHE_TTL_MS) {
    return cachedConfigExists ? cachedConfig : null;
  }
  try {
    if (existsSync(CONFIG_PATH)) {
      const data = readFileSync(CONFIG_PATH, "utf-8");
      cachedConfig = JSON.parse(data) as SetupConfig;
      cachedConfigExists = true;
      cachedAt = now;
      return cachedConfig;
    }
    cachedConfig = null;
    cachedConfigExists = false;
    cachedAt = now;
  } catch {
    // ignore — cache'i güncelleme, bir sonraki çağrıda tekrar denenir
  }
  return null;
}

export function isSetupComplete(): boolean {
  const config = getSetupConfig();
  return config?.setupComplete ?? false;
}

export function saveSetupConfig(config: SetupConfig): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!existsSync(dir)) {
    const fs = require("fs");
    fs.mkdirSync(dir, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  invalidateSetupConfigCache();
}
