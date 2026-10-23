import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

export interface SessionUser {
  id: string;
  email: string;
  displayName?: string;
  isAdmin?: boolean;
  globalRole?: string | null;
  /** LDAP ile giriş yapan kullanıcılar parola değiştiremez. */
  isLdapUser?: boolean;
  /** Oturumun geçerlilik sonu (epoch saniye). İmzalı payload'ın parçasıdır;
   * tarayıcı maxAge'inden bağımsız olarak sunucu tarafında da doğrulanır. */
  exp?: number;
}

const COOKIE_NAME = "notbak-user";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 gün

type CookieOptions = {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  maxAge: number;
  path: string;
};

/**
 * Oturum imzalama anahtarı. SESSION_SECRET tanımlı değilse veya örnek değer
 * bırakılmışsa null döner; bu durumda oturum imzalama/doğrulama yapılmaz
 * (fail-closed: kimse giriş yapamaz, sahte cookie kabul edilmez).
 */
function getSessionSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16 || s === "change-me-in-production") return null;
  return s;
}

/** HTTPS dağıtımda cookie `secure` olur; HTTP (LAN) dağıtımda kapalı kalır. */
function isHttpsDeployment(): boolean {
  return (process.env.APP_URL || "").toLowerCase().startsWith("https://");
}

/**
 * Oturum verisini imzalar: "base64url(payload).base64url(HMAC-SHA256)".
 * İçerik gizli değil (kullanıcının kendi kimliği) ama bütünlüğü korunur;
 * tek karakter değiştirilse bile imza tutmaz → yetki yükseltme engellenir.
 */
export function signSessionValue(payloadJson: string): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;
  const payloadB64 = Buffer.from(payloadJson, "utf-8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

/** İmzalı değeri doğrular ve payload JSON'ını döndürür; geçersizse null. */
export function verifySessionValue(value: string): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;
  const dot = value.indexOf(".");
  if (dot <= 0 || dot >= value.length - 1) return null;
  const payloadB64 = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    return Buffer.from(payloadB64, "base64url").toString("utf-8");
  } catch {
    return null;
  }
}

function parseSessionUser(json: string): SessionUser | null {
  try {
    const parsed = JSON.parse(json) as SessionUser;
    if (!parsed?.id || !parsed?.email) return null;
    // exp olmayan (eski format) veya süresi dolmuş oturumlar geçersizdir;
    // çalınan bir cookie SESSION_SECRET değişmeden de zamanla ölür.
    if (typeof parsed.exp !== "number" || parsed.exp * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    // ignore
  }
  return null;
}

/**
 * Login route'unun cookie'yi güvenli şekilde set etmesi için imzalı değeri ve
 * seçenekleri üretir. SESSION_SECRET yoksa null (login engellenmeli).
 */
export function buildSessionCookie(
  user: SessionUser
): { name: string; value: string; options: CookieOptions } | null {
  const payload: SessionUser = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE,
  };
  const value = signSessionValue(JSON.stringify(payload));
  if (!value) return null;
  return {
    name: COOKIE_NAME,
    value,
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttpsDeployment(),
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    },
  };
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  const json = verifySessionValue(cookie.value);
  if (!json) return null;
  return parseSessionUser(json);
}

/** Server-side: get session from request headers (for API routes) */
export function getSessionFromHeaders(cookieHeader: string | null): SessionUser | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/notbak-user=([^;]+)/);
  if (!match) return null;
  let raw: string;
  try {
    raw = decodeURIComponent(match[1]);
  } catch {
    raw = match[1];
  }
  const json = verifySessionValue(raw);
  if (!json) return null;
  return parseSessionUser(json);
}
