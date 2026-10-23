import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

export interface LdapConfig {
  url: string;
  bindDn: string;
  bindPassword: string;
  searchBase: string;
  searchFilter: string;
  groupFilter?: string;
  /** Exchange: proxyAddresses içinden bu domain ile biten e-posta kullanılır (örn. "example.com") */
  preferredEmailDomain?: string;
}

const LDAP_CONFIG_PATH = path.join(process.cwd(), "config", "ldap.json");

export function getLdapConfig(): LdapConfig | null {
  try {
    if (existsSync(LDAP_CONFIG_PATH)) {
      const data = readFileSync(LDAP_CONFIG_PATH, "utf-8");
      return JSON.parse(data) as LdapConfig;
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveLdapConfig(config: LdapConfig): void {
  const dir = path.dirname(LDAP_CONFIG_PATH);
  if (!existsSync(dir)) {
    const fs = require("fs");
    fs.mkdirSync(dir, { recursive: true });
  }
  writeFileSync(LDAP_CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}
