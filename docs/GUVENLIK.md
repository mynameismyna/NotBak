# Güvenlik

Bu belge kaynak paketinin sınırlarını anlatır. Açık kaynak lisansı seçilmemiştir. Herkese açık yayın, sahip onayı olmadan yapılmaz.

## Sırlar

Şunlar depoya girmez: `.env`, `config/setup.json`, `config/ldap.json`, `config/*.txt` (`.example` hariç), `logs/`, derleme çıktısı, exe, `node_modules`, `.next`.

`SESSION_SECRET` oturum çerezini HMAC ile imzalar. HMAC, paylaşılan sır ile bütünlük doğrulayan özet yöntemidir. Örnek değer veya 16 karakterden kısa değer kabul edilmez. Giriş bu durumda kapalı kalır.

`CRON_SECRET` boşsa zamanlanmış uçlar reddeder. Sırrı adres çubuğunda taşımayın.

Başlatma betikleri, `DATABASE_URL` veya `config/setup.json` içindeki veritabanı adresi loopback değilse süreci açmaz. Adres ve parola ekrana yazılmaz.

## Kurulum kilidi

Tabloların sıfırdan kurulması `--force-reset` kullanır. Bu, hedefteki nesneleri siler. Loopback dışındaki adreste komut çalışmaz. Bilinçli istisna yalnızca `NOTBAK_ALLOW_REMOTE_DB_RESET=true` iledir.

Tabloların zaten var olduğu seçenekte sihirbaz `--accept-data-loss` ile şema farkını basabilir. Bu da veri şeklini değiştirir. Onu da yalnızca yeni ve boş bir yerel veritabanında kullanın.

## Kimlik ve yetki

Panel sayfaları imzalı oturumu doğrular. Ayarlar ve LDAP işlemleri veritabanındaki güncel yönetici kaydına bakar.

Yardım kılavuzu API'si (`/api/help/manual`) oturumsuz içerik döndürmez. Panel içindeki sayfa zaten oturum ister.

## Bilinen sınırlar

Bu sürümde yeniden yazılmayan davranışlar:

- `src/proxy.ts` yalnızca çerezin varlığına bakar. İmza doğrulaması panel düzeninde ve API uçlarındadır. Proxy tek başına yetki kanıtı değildir.
- Kurulum tamamlandıktan sonra kurulum uçlarının bekçisi, çerezdeki role güvenir. O anki veritabanı rolünü yeniden okumaz.
- IMAP parolası `AppSetting` tablosunda düz metin JSON olarak durur. LDAP bind parolası `config/ldap.json` içinde düz metindir.
- Günlük özet ve IMAP yoklayıcı, süreç açıkken kendi zamanlayıcısı ile çalışır. Ayrı bir iş kuyruğu yoktur.

## Üçüncü taraflar

Uygulama Next.js, React, Prisma, ldapjs, Nodemailer, ImapFlow ve SheetJS kullanır. SheetJS Apache-2.0 lisanslıdır ve npm kilit dosyasında CDN adresi ile bütünlük özeti birlikte durur.

NSSM exe'si bu pakette yoktur.

`public/` altındaki logo dosyalarının marka olarak dağıtılıp dağıtılamayacağı koddan anlaşılmaz. Herkese açık yayın öncesi sahip onayı gerekir. Onay yoksa logolar paketten çıkarılır.
