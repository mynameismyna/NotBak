import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessSettings } from "@/lib/authz";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session || !canAccessSettings(session)) redirect("/dashboard");
  return (
    <div>
      <h1 className="typo-page-title mb-6">Ayarlar</h1>
      <div className="grid gap-4 max-w-2xl sm:grid-cols-2">
        <Link
          href="/dashboard/settings/general"
          className="block rounded-xl shadow-lg p-6 hover:shadow-xl hover:scale-[1.01] transition border-l-4 backdrop-blur"
          style={{
            backgroundColor: "var(--metro-card-bg)",
            borderLeftColor: "var(--metro-tile-notlar)",
          }}
        >
          <h2 className="typo-section-title mb-1">Genel Ayarlar</h2>
          <p className="typo-body">
            Uygulama URL&apos;si. E-postalardaki giriş linki ve diğer bağlantılar bu adrese göre oluşturulur.
          </p>
        </Link>
        <Link
          href="/dashboard/settings/ldap"
          className="block rounded-xl shadow-lg p-6 hover:shadow-xl hover:scale-[1.01] transition border-l-4 backdrop-blur"
          style={{
            backgroundColor: "var(--metro-card-bg)",
            borderLeftColor: "var(--metro-tile-projeler)",
          }}
        >
          <h2 className="typo-section-title mb-1">LDAP Ayarları</h2>
          <p className="typo-body">
            Active Directory bağlantısı, Bind DN, Search Base ve giriş ayarları.
          </p>
        </Link>
        <Link
          href="/dashboard/settings/users"
          className="block rounded-xl shadow-lg p-6 hover:shadow-xl hover:scale-[1.01] transition border-l-4 backdrop-blur"
          style={{
            backgroundColor: "var(--metro-card-bg)",
            borderLeftColor: "var(--metro-tile-gorevler)",
          }}
        >
          <h2 className="typo-section-title mb-1">Kullanıcılar</h2>
          <p className="typo-body">
            Kullanıcı listesi, AD&apos;den ekleme ve manuel kullanıcı ekleme.
          </p>
        </Link>
        <Link
          href="/dashboard/settings/units"
          className="block rounded-xl shadow-lg p-6 hover:shadow-xl hover:scale-[1.01] transition border-l-4 backdrop-blur"
          style={{
            backgroundColor: "var(--metro-card-bg)",
            borderLeftColor: "var(--metro-tile-notlar)",
          }}
        >
          <h2 className="typo-section-title mb-1">Birimler</h2>
          <p className="typo-body">
            Birim tanımları. Kullanıcıları birimlere atayıp birim içi rol verebilirsiniz.
          </p>
        </Link>
        <Link
          href="/dashboard/settings/smtp"
          className="block rounded-xl shadow-lg p-6 hover:shadow-xl hover:scale-[1.01] transition border-l-4 backdrop-blur"
          style={{
            backgroundColor: "var(--metro-card-bg)",
            borderLeftColor: "var(--metro-tile-projeler)",
          }}
        >
          <h2 className="typo-section-title mb-1">SMTP Ayarları</h2>
          <p className="typo-body">
            E-posta gönderimi için sunucu, port, kullanıcı ve güvenlik ayarları. Sorun bildirimi bu ayarları kullanır.
          </p>
        </Link>
        <Link
          href="/dashboard/settings/imap"
          className="block rounded-xl shadow-lg p-6 hover:shadow-xl hover:scale-[1.01] transition border-l-4 backdrop-blur"
          style={{
            backgroundColor: "var(--metro-card-bg)",
            borderLeftColor: "var(--metro-tile-gorevler)",
          }}
        >
          <h2 className="typo-section-title mb-1">IMAP Ayarları</h2>
          <p className="typo-body">
            E-posta ile görev/not oluşturma. Gelen kutusu bağlantısı, kontrol sıklığı ve test.
          </p>
        </Link>
      </div>
    </div>
  );
}
