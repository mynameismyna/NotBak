# NotBak

Ekip görev, not ve fikir takibi. Kendi sunucunuzda çalışır. Kimlik doğrulama yerel parola veya LDAP / Active Directory ile yapılır. LDAP, dizin hizmetinde kullanıcı aramayı anlatan protokoldür. Active Directory, kurumlarda sık kullanılan dizin uygulamasıdır.

Kaynak kodu Burak Türk'e aittir ve MIT lisansı ile dağıtılır. Ayrıntı [LICENSE](LICENSE) dosyasındadır. `package.json` içindeki `private: true`, paketin npm kayıt defterine yanlışlıkla yayınlanmasını engeller. GitHub'da kaynak olarak durmasını engellemez.

## Bu sürümde kurulum

Desteklenen veritabanı motoru SQL Server'dır. Boş veritabanı, kurulum sihirbazı ile yalnızca bu bilgisayardaki (loopback: `localhost` veya `127.0.0.1`) bir örneğe açılır.

Docker bu sürümde kurulum yolu değildir. `Dockerfile` ve `docker-compose.yml` sağlayıcıları uyuşmadığı için desteklenmez.

Ayrıntı:

- [docs/KURULUM.md](docs/KURULUM.md)
- [docs/YAPILANDIRMA.md](docs/YAPILANDIRMA.md)
- [docs/VERITABANI.md](docs/VERITABANI.md)
- [docs/GUVENLIK.md](docs/GUVENLIK.md)
- [docs/KULLANIM_KILAVUZU.md](docs/KULLANIM_KILAVUZU.md)
- [docs/PROJE_PLANI_VE_ROL_YETKILERI.md](docs/PROJE_PLANI_VE_ROL_YETKILERI.md)

## Hızlı başlangıç

Gerekenler: Node.js 20 veya üstü, bu makinede çalışan bir SQL Server örneği.

```bash
npm ci
```

Kurulum, depodaki `.npmrc` ile `legacy-peer-deps` kullanır. Lint komutu ESLint 9 ve Next.js düz yapılandırmasını kullanır.

`.env.example` dosyasını `.env` yapın. `SESSION_SECRET` değerini `openssl rand -base64 32` çıktısı ile değiştirin. Örnek değerle giriş kapalı kalır.

```bash
npm run dev
```

Tarayıcıda `http://127.0.0.1:3000/setup` adresini açın. Veritabanı adresi olarak `127.0.0.1` verin. Sihirbaz tabloları oluşturur ve ilk yöneticiyi ister.

Windows menüsü: `NotBak.bat`. Üretim hizmetini başlatan seçenek bu pakette yoktur.

## Ne korunur

Görev, not ve fikir kayıtları; pano; projeler, birimler ve ekipler; bildirimler; Excel içe aktarma; IMAP ile gelen posta; SMTP ile günlük özet; LDAP kullanıcı eşitleme; imzalı oturum çerezi.

Kurumunuza ait dizin adresi, posta kutusu ve veritabanı bilgisi kaynakta yoktur. Bunları yalnızca kendi `.env` dosyanıza veya kurulum ekranına yazın. Bu dosyalar git'e girmez.

## Şirket logosu

Giriş ekranı `public/company-logo.png` dosyasını arar. Bu dosya depoda yoktur. Kuran kurum kendi logosunu bu adla `public/` klasörüne koyar. Dosya yoksa ekranda "Şirket logosu" yazısı görünür. Ayrıntı [public/SIRKET_LOGOSU.md](public/SIRKET_LOGOSU.md).

NotBak işaretleri depoda kalır: `public/notbak_logo.png` ve `public/notbak_logo_old.png`.

## Lisans

MIT. İzin verici bir lisanstır: kodu kullanabilir, değiştirebilir ve kendi sunucunuzda, kurum içinde de çalıştırabilirsiniz. Dağıtırken lisans metnini ve telif satırını korursunuz. GPL veya AGPL gibi türevleri açığa çıkarma zorunluluğu yoktur. Kurum içi kurulum için bu yüzden MIT seçildi.

Üçüncü taraf paketlerin lisansları kendilerine aittir. SheetJS (`xlsx`) Apache-2.0 lisanslıdır ve kilit dosyasında bütünlük özeti ile sabitlenmiştir.
