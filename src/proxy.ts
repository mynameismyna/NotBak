import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/setup", "/login", "/api/setup", "/api/auth/login"];
const authPaths = ["/dashboard", "/api/tasks", "/api/projects", "/api/comments", "/api/users", "/api/ldap", "/api/units"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  return publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function requiresAuth(pathname: string): boolean {
  return authPaths.some((p) => pathname.startsWith(p));
}

// proxy: Next.js 16'da eski middleware ile aynı API'yi kullanır,
// sadece dosya ve fonksiyon adı değişmiştir.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAuth = request.cookies.has("notbak-user");

  if (requiresAuth(pathname) && !hasAuth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Not: "/login iken cookie varsa /dashboard'a yönlendir" davranışı kaldırıldı.
  // proxy yalnızca cookie varlığına bakar, imzasını doğrulayamaz; geçersiz/eski
  // bir cookie ile dashboard layout'unun login'e yönlendirmesi sonsuz döngü
  // yaratırdı. Geçerli oturumda /login'e gidilirse sayfa normal görüntülenir.

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

