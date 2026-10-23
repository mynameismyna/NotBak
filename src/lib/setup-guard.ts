import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettings } from "@/lib/authz";

/**
 * Setup rotaları (test-connection, check-database, self-check) kurulum
 * tamamlanmadan önce serbesttir; kurulum tamamlandıktan sonra yalnızca
 * Admin oturumuyla çağrılabilir. Aksi halde bu rotalar kimlik doğrulamasız
 * SSRF / credential probing / admin parola sıfırlama için kullanılabilir.
 */
export function isSetupRouteAllowed(cookieHeader: string | null): boolean {
  const config = getSetupConfig();
  if (!config?.setupComplete) return true;
  const session = getSessionFromHeaders(cookieHeader);
  return !!session && canAccessSettings(session);
}
