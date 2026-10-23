# NotBak

Ekip görev, not ve fikir takibi. Kendi sunucunuzda çalışır. Kimlik doğrulama yerel parola veya LDAP / Active Directory ile yapılır. LDAP, dizin hizmetinde kullanıcı aramayı anlatan protokoldür. Active Directory, kurumlarda sık kullanılan dizin uygulamasıdır.

Bu paket bir kaynak dağıtımıdır. Lisans seçilmemiştir. `package.json` içindeki `private: true` durur. Uzak depoya gönderme, sahip onayı olmadan yapılmaz.

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

## Lisans

Lisans belirlenmedi. Bu kaynağın herkese açık dağıtımı, sahip onayı olmadan yapılmaz. Üçüncü taraf paketlerin lisansları kendi depolarındadır. SheetJS (`xlsx`) Apache-2.0 lisanslıdır ve kilit dosyasında bütünlük özeti ile sabitlenmiştir.
