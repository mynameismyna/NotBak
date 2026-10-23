/**
 * Başlatma betikleri için veritabanı hedef kontrolü.
 * Bağlantı açmaz. Adres veya parola yazdırmaz.
 * src/lib/loopback-host.ts içindeki loopback kuralı ile aynı tutulmalıdır.
 */
import fs from "fs";
import path from "path";

function isLoopbackDbHost(host) {
  const normalized = String(host || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function hostsFromUrl(url) {
  if (!url) return [];
  const trimmed = String(url).trim().replace(/^["']|["']$/g, "");
  if (!trimmed || /placeholder|__setup_required__/i.test(trimmed)) return [];
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("sqlserver://")) {
    const hostPort = trimmed.slice("sqlserver://".length).split(";")[0];
    return [hostPort.split(":")[0]];
  }
  if (lower.startsWith("postgresql://") || lower.startsWith("postgres://")) {
    try {
      return [new URL(trimmed).hostname];
    } catch {
      return ["unparsed"];
    }
  }
  return ["unparsed"];
}

function collectHosts(root) {
  const hosts = [];
  if (process.env.DATABASE_URL) hosts.push(...hostsFromUrl(process.env.DATABASE_URL));

  const envPath = path.join(root, ".env");
  if (fs.existsSync(envPath)) {
    const text = fs.readFileSync(envPath, "utf8");
    const match = text.match(/^DATABASE_URL\s*=\s*(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^\s#\r\n]+))/m);
    const value = match ? match[1] || match[2] || match[3] || "" : "";
    hosts.push(...hostsFromUrl(value));
  }

  const setupPath = path.join(root, "config", "setup.json");
  if (fs.existsSync(setupPath)) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(setupPath, "utf8"));
    } catch {
      console.error("[NotBak] config/setup.json okunamadı. Başlatma durduruldu.");
      process.exit(1);
    }
    if (parsed && parsed.databaseUrl) hosts.push(...hostsFromUrl(parsed.databaseUrl));
  }
  return hosts;
}

function remoteResetAllowed(host, flag) {
  if (isLoopbackDbHost(host)) return true;
  return flag === "true";
}

function runSelfTest() {
  const hosts = [
    ["localhost", true],
    ["127.0.0.1", true],
    ["::1", true],
    ["LOCALHOST", true],
    ["[::1]", true],
    ["203.0.113.10", false],
    ["db.example", false],
  ];
  const failures = [];
  for (const [host, expected] of hosts) {
    if (isLoopbackDbHost(host) !== expected) failures.push("host " + host);
  }
  if (remoteResetAllowed("127.0.0.1", undefined) !== true) failures.push("loopback reset");
  if (remoteResetAllowed("203.0.113.10", undefined) !== false) failures.push("remote reset closed");
  if (remoteResetAllowed("203.0.113.10", "true") !== true) failures.push("remote reset override");
  if (remoteResetAllowed("203.0.113.10", "false") !== false) failures.push("remote reset false flag");
  if (failures.length > 0) {
    console.error("[NotBak] Loopback self-test failed: " + failures.length);
    process.exit(1);
  }
  console.log("[NotBak] Loopback self-test passed");
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  const bad = collectHosts(process.cwd()).filter((host) => !isLoopbackDbHost(host));
  if (bad.length > 0) {
    console.error("[NotBak] Veritabanı adresi loopback değil. Başlatma durduruldu.");
    console.error("Yerel kurulum için localhost veya 127.0.0.1 kullanın. Bu paket üretim adresine bağlanmaz.");
    process.exit(1);
  }
}
