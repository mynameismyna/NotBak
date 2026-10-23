import Link from "next/link";
import { getSession } from "@/lib/auth";
import PasswordChangeForm from "./PasswordChangeForm";

export default async function PasswordSettingsPage() {
  const session = await getSession();

  if (session?.isLdapUser) {
    return (
      <div>
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-white/90 hover:text-white">
            ← Ana Sayfa
          </Link>
        </div>
        <h1 className="typo-page-title-on-card mb-4">Parola değiştir</h1>
        <div
          className="rounded-xl shadow-lg p-6 max-w-md backdrop-blur"
          style={{ backgroundColor: "var(--metro-card-bg)" }}
        >
          <p className="text-gray-700 text-sm leading-relaxed">
            Hesabınız Active Directory (LDAP) ile yönetilmektedir. Şirket e-postanız ve bilgisayarınızda oturum açarken kullandığınız parola ile giriş yapabilirsiniz. Parola değişikliği kurumsal IT politikası gereği şirket sisteminiz üzerinden yapılır.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-white/90 hover:text-white">
          ← Ana Sayfa
        </Link>
      </div>
      <h1 className="typo-page-title-on-card mb-4">Parola değiştir</h1>
      <div
        className="rounded-xl shadow-lg p-6 max-w-md backdrop-blur"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <p className="text-gray-600 text-sm mb-4">
          İlk girişte geçici parolanızı değiştirmeniz gerekiyorsa veya parolanızı güncellemek istiyorsanız aşağıdaki alanları doldurun.
        </p>
        <PasswordChangeForm />
      </div>
    </div>
  );
}
