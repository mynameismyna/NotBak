import { resolveBaseUrl } from "@/lib/base-url";
import { prisma } from "@/lib/prisma";

const APP_URL_KEY = "APP_URL";

/**
 * E-postalardaki giriş ve diğer linkler için base URL.
 * Öncelik: (1) Request'ten otomatik (Host/X-Forwarded-Host), (2) Veritabanı (Genel Ayarlar), (3) APP_URL env, (4) diğer fallback.
 */
export async function getBaseUrlForEmails(request?: Request | null): Promise<string> {
  if (request) {
    const fromRequest = resolveBaseUrl(request);
    if (fromRequest) {
      const u = fromRequest.replace(/\/$/, "");
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u);
      if (!isLocalhost) return u;
    }
  }
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: APP_URL_KEY },
    });
    const value = row?.value?.trim();
    if (value) return value.replace(/\/$/, "");
  } catch {
    // AppSetting tablosu yoksa veya okuma hatası
  }
  if (request) {
    const fromRequest = resolveBaseUrl(request);
    if (fromRequest) return fromRequest.replace(/\/$/, "");
  }
  return resolveBaseUrl().replace(/\/$/, "");
}

export { APP_URL_KEY };
