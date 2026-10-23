/**
 * Boş kurulumda şema sıfırlamasının yalnızca loopback hedefe gitmesi için.
 * scripts/assert-loopback-db.mjs içindeki host kuralı ile aynı tutulmalıdır.
 */
export function isLoopbackDbHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

/** Uzak hedefte --force-reset yalnızca açık ortam değişkeni ile izinlidir. */
export function isRemoteSchemaResetAllowed(host: string): boolean {
  if (isLoopbackDbHost(host)) return true;
  return process.env.NOTBAK_ALLOW_REMOTE_DB_RESET === "true";
}
