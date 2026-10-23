import Link from "next/link";
import { redirect } from "next/navigation";
import { UserMenu } from "@/components/UserMenu";
import { HelpMenu } from "@/components/HelpMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { NavDropdown, NavDropdownItem } from "@/components/NavDropdown";
import { KayitlarDropdown } from "@/components/KayitlarDropdown";
import { DashboardLogo } from "@/components/DashboardLogo";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ToastProvider } from "@/components/ToastProvider";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import { caveat } from "@/lib/fonts";
import { getSession } from "@/lib/auth";
import { canAccessSettings } from "@/lib/authz";
import { isSetupComplete } from "@/lib/config";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSetupComplete()) {
    redirect("/setup");
  }
  const session = await getSession();
  // Geçerli (imzalı) oturum yoksa panel hiç render edilmeden login'e yönlendir.
  // Bu, kimliksiz/sahte/eski-imzasız cookie ile sayfa içeriğinin görünmesini engeller.
  if (!session) {
    redirect("/login");
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--notbak-bg-gradient)" }}
    >
      <nav
        className="relative z-30 border-b border-white/20 px-4 py-2.5 shadow-lg"
        style={{ backgroundColor: "var(--metro-nav-bg)", backdropFilter: "blur(8px)" }}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-3 shrink-0">
              <DashboardLogo />
              <span className={`${caveat.className} font-bold text-xl text-gray-800`}>
                NotBak
              </span>
            </Link>
            <div className="flex gap-1 items-center">
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-md text-gray-700 hover:bg-black/5 font-medium transition"
              >
                Ana Sayfa
              </Link>
              <NavDropdown
                label="Çalışmalarım"
                activePaths={[
                  "/dashboard/projects",
                  "/dashboard/tum-kayitlar",
                ]}
              >
                <NavDropdownItem href="/dashboard/tum-kayitlar">Tüm Kayıtlar</NavDropdownItem>
                <NavDropdownItem href="/dashboard/projects">Projeler</NavDropdownItem>
              </NavDropdown>
              {session && (
                <KayitlarDropdown isAdmin={canAccessSettings(session)} />
              )}
              {session && canAccessSettings(session) && (
                <Link
                  href="/dashboard/settings"
                  className="px-4 py-2 rounded-md text-gray-700 hover:bg-black/5 font-medium transition"
                >
                  Ayarlar
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {session && <GlobalSearch />}
            <HelpMenu />
            {session ? (
              <>
                <NotificationBell />
                <UserMenu user={{ displayName: session.displayName, email: session.email, canChangePassword: !session.isLdapUser }} />
              </>
            ) : (
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-black/5 transition"
            >
              Giriş yap
            </Link>
            )}
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto p-6">
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </main>
    </div>
  );
}
