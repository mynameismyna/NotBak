# Kurulum

Bu belge boş bir geliştirme kurulumunu anlatır. Canlı sisteme bağlanmayın. Mevcut bir üretim veritabanına şema basmayın.

## Terimler

- **Loopback:** Yalnızca bu bilgisayar. `localhost` ve `127.0.0.1` bu sınıftadır.
- **Kurulum sihirbazı:** İlk açılışta `/setup` adresindeki ekran. Veritabanını ve ilk yöneticiyi oluşturur.
- **Ortam değişkeni:** İşletim sisteminin sürece verdiği ayar. Uygulama bunları `.env` dosyasından okur.

## Gerekenler

- Node.js 20 veya üstü ve npm
- Bu makinede dinleyen SQL Server. Varsayılan kapı 1433'tür.
- İsteğe bağlı: LDAP dizini, SMTP gönderimi, IMAP gelen kutusu. Bunlar olmadan çekirdek görev takibi çalışır.

PostgreSQL şema dosyası model olarak hizalanmıştır. Bu yayında desteklenen kurulum motoru SQL Server'dır. Docker kullanılmaz.

## Adımlar

1. Bağımlılıkları kilide göre kurun. `postinstall` adımı Prisma istemcisini üretir. Prisma, veritabanı şemasından kod üreten araçtır. Bu adım veritabanına bağlanmaz.

```bash
npm ci
```

`.npmrc` içinde `legacy-peer-deps=true` durur. ESLint 9, Next.js 16 düz yapılandırması ile `npm run lint` komutunu çalıştırır. İki yeni React Hooks kuralı bu sürümde kapalıdır; mevcut effect kodunun davranışı değiştirilmez.

2. `.env.example` dosyasını `.env` olarak kopyalayın.

3. `SESSION_SECRET` değerini değiştirin. Örnek değer `change-me-in-production` bırakılırsa giriş bilinçli olarak kapalıdır.

```bash
openssl rand -base64 32
```

4. Geliştirme sunucusunu başlatın.

```bash
npm run dev
```

5. `http://127.0.0.1:3000/setup` adresini açın.

6. Veritabanı türü olarak SQL Server, adres olarak `127.0.0.1` seçin. Veritabanı adı boş bir ad olsun. Sihirbaz yoksa veritabanını oluşturmayı teklif eder, sonra tabloları basar.

7. İlk yönetici e-postasını ve parolasını bu kurulum için yeni seçin. Gerçek kişi verisi kullanmayın.

8. `/login` üzerinden girin.

`NotBak.bat` aynı akışı menüden açar. Seçenek 1 üretim hizmeti başlatmaz. Seçenek 2 ve 3, veritabanı adresi loopback değilse sunucuyu açmaz.

## Windows başlatıcı

Kaynak `tools/NotBakLauncher` altındadır. Exe üretmek için .NET 8 SDK gerekir:

```bat
scripts\build-launcher.bat
```

Çıktı `launcher-build\` ve kökteki `NotBak-GUI.exe` dosyasıdır. İkisi de git'e girmez.

Windows hizmeti için NSSM (Non-Sucking Service Manager) isteğe bağlı harici araçtır. Bu pakette `nssm.exe` yoktur. Hizmet kurulumu bu kaynak yayınının parçası değildir.

## Şirket logosu

Giriş ekranı `public/company-logo.png` arar. Kuran kurum logosunu bu adla `public/` içine koyar. Dosya depoya girmez. Yoksa "Şirket logosu" yazısı görünür. Ayrıntı `public/SIRKET_LOGOSU.md`.

## Yapılmaması gerekenler

- `.env`, `config/setup.json` ve `config/ldap.json` dosyalarını depoya eklemeyin.
- Başka bir makinenin SQL Server adresini sihirbaza yazmayın. Uzak hedefte şema sıfırlama varsayılan olarak kapalıdır.
- LDAP, SMTP veya IMAP sınama düğmelerini, karşınızdaki sunucunun sizin geliştirme hedefin olduğundan emin olmadan kullanmayın.
