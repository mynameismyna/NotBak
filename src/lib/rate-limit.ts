/**
 * Basit bellek-içi rate limiter (sabit pencere). Tek process'li standalone
 * dağıtım için yeterlidir; çok instance'lı dağıtımda paylaşımlı store
 * (ör. Redis) gerekir.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function cleanup(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Reddedildiyse kaç saniye sonra tekrar denenebilir. */
  retryAfterSec: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanup(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** Proxy arkasında gerçek istemci IP'sini bulmaya çalışır. */
export function getClientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") || "unknown";
}

/**
 * Cron endpoint'leri için secret doğrulaması. Secret, `Authorization: Bearer`
 * header'ı (önerilen; access log'lara sızmaz) veya `?secret=` query
 * parametresiyle gönderilebilir. CRON_SECRET tanımlı değilse fail-closed.
 */
export function isCronRequestAuthorized(request: { headers: Headers; nextUrl: { searchParams: URLSearchParams } }): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) return false;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ") && authHeader.slice(7).trim() === expectedSecret) return true;
  return request.nextUrl.searchParams.get("secret") === expectedSecret;
}
