import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAccessSettings } from "@/lib/authz";

/** GET: Mevcut oturum bilgisi (client tarafında yetki kontrolü için). */
export async function GET() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get("notbak-user");
  const session = getSessionFromHeaders(cookie ? `notbak-user=${cookie.value}` : null);
  if (!session) {
    return NextResponse.json({ user: null, canAccessSettings: false });
  }
  return NextResponse.json({
    user: { id: session.id, email: session.email, displayName: session.displayName, isAdmin: session.isAdmin, globalRole: session.globalRole },
    canAccessSettings: canAccessSettings(session),
  });
}
