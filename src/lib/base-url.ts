import os from "os";

/**
 * Uygulamanın dışarıdan erişilebilir base URL'ini belirler.
 *
 * Öncelik sırası:
 *  1. APP_URL / NEXT_PUBLIC_APP_URL env değişkeni (yönetici tarafından elle ayarlanmışsa)
 *  2. VERCEL_URL env değişkeni
 *  3. clientOrigin — tarayıcıdaki `window.location.origin` (frontend POST body ile gönderir)
 *  4. Request header'larından (Host / X-Forwarded-Host) türetme
 *  5. Sunucunun LAN IP adresi + PORT (env veya varsayilan 3001)
 *  6. http://localhost:PORT (son çare)
 */
export function resolveBaseUrl(request?: Request | null, clientOrigin?: string): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (clientOrigin) {
    try {
      const url = new URL(clientOrigin);
      return url.origin;
    } catch { /* geçersiz origin gönderildiyse atla */ }
  }

  if (request) {
    const fromHeaders = resolveFromHeaders(request);
    if (fromHeaders) return fromHeaders;
  }

  const port = process.env.PORT || "3001";
  const lanIp = getLocalNetworkIp();
  if (lanIp) return `http://${lanIp}:${port}`;

  return `http://localhost:${port}`;
}

function resolveFromHeaders(request: Request): string | null {
  const fwdHost = request.headers.get("x-forwarded-host");
  const fwdProto = request.headers.get("x-forwarded-proto") || "http";
  if (fwdHost) return `${fwdProto}://${fwdHost.split(",")[0].trim()}`;

  const host = request.headers.get("host");
  if (host && host !== "localhost" && !host.startsWith("localhost:")) {
    const proto = host.includes("443") ? "https" : "http";
    return `${proto}://${host}`;
  }

  try {
    const url = new URL(request.url);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return url.origin;
    }
  } catch { /* ignore */ }

  return null;
}

function getLocalNetworkIp(): string | null {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch { /* os modülü kullanılamadıysa sessizce geç */ }
  return null;
}
