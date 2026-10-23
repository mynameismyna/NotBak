import { ABOUT_DESCRIPTION, ABOUT_FEATURES, APP_VERSION } from "@/lib/help-content";

export default function AboutPage() {
  return (
    <>
      <h1 className="typo-page-title mb-4">Hakkında</h1>
      <div className="space-y-4 max-w-3xl">
        {/* Başlık ve Tanım */}
        <div
          className="rounded-xl shadow-lg p-6 backdrop-blur"
          style={{ backgroundColor: "var(--metro-card-bg)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <h2 className="typo-section-title">NotBak</h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {APP_VERSION}
            </span>
          </div>
          <p className="text-gray-700 text-sm leading-relaxed">{ABOUT_DESCRIPTION}</p>
        </div>

        {/* Özellikler */}
        <div
          className="rounded-xl shadow-lg p-6 backdrop-blur"
          style={{ backgroundColor: "var(--metro-card-bg)" }}
        >
          <h3 className="typo-subsection-title mb-3">Özellikler</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {ABOUT_FEATURES.map(([title, desc]) => (
              <div key={title} className="py-1.5">
                <span className="text-gray-800 text-xs font-medium">{title}</span>
                <p className="text-gray-500 text-xs leading-snug mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Teknoloji */}
        <div
          className="rounded-xl shadow-lg p-6 backdrop-blur"
          style={{ backgroundColor: "var(--metro-card-bg)" }}
        >
          <h3 className="typo-subsection-title mb-3">Teknoloji Altyapısı</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              ["Frontend", "Next.js, React, Tailwind CSS"],
              ["Backend", "Next.js API Routes"],
              ["Veritabanı", "SQL Server / PostgreSQL"],
              ["ORM", "Prisma"],
              ["Kimlik Doğrulama", "LDAP, bcryptjs"],
              ["E-posta", "Nodemailer, ImapFlow"],
            ].map(([label, tech]) => (
              <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-gray-400 block">{label}</span>
                <span className="text-gray-700 font-medium">{tech}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alt bilgi */}
        <div
          className="rounded-xl shadow-lg p-4 backdrop-blur"
          style={{ backgroundColor: "var(--metro-card-bg)" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-500">
            <span>Self-hosted intranet uygulaması &middot; Windows tek tuşla kurulum desteği</span>
            <span>Lisans: MIT</span>
          </div>
        </div>
      </div>
    </>
  );
}
