# Yayın doğrulama raporu

Tarih: 2026-10-23. Bu rapor değer içermez. Yalnızca sınıf, komut ve sonuç vardır.

## Kapsam

Dağıtım adayı `NotBak-release` klasörüdür. Kirli hazırlık kopyasına yazılmamıştır. Üretim veritabanı, LDAP, SMTP, IMAP ve Windows hizmeti kullanılmamıştır. Uzak depo eklenmemiştir.

## Komutlar

Aday klasöründe, yer tutucu `DATABASE_URL` ile (loopback, parola alanı `placeholder`):

- `npm install --package-lock-only --ignore-scripts` ve ardından `npm ci`. Prisma istemcisi üretildi. Ağ bağlantısı veritabanına gitmedi.
- `npx prisma validate` üç şema dosyasında da geçerli.
- `npx tsc --noEmit` başarılı.
- `npm run lint` başarılı. 0 hata, 20 uyarı. Uyarılar mevcut effect bağımlılıkları ve `img` kullanımıdır.
- `npm run build` başarılı. Sunucu başlatılmadı.
- `node scripts/assert-loopback-db.mjs --self-test` geçti.
- Belgeleme amaçlı bir uzak adres hem ortam değişkeninde hem geçici `.env` dosyasında denendi. Betik çıkış kodu 1 verdi ve adresi yazdırmadı. Geçici dosya silindi.

## Şema

Aktif şema, SQL Server kopyası ve PostgreSQL kopyası 18 model. Alan kümesi farkı yok. Sağlayıcılar: SQL Server, SQL Server, PostgreSQL. PostgreSQL bu yayında desteklenen kurulum yolu değildir.

## Gizli veri taraması

Aday kaynakta kurumsal dizin belirteci ve kurumsal posta alanı yok. `setup.json`, `ldap.json` ve exe yok. Derleme öncesi oluşturulan yer tutucu `.env` commit öncesi silindi.

Derleme çıktısındaki `sqlserver://` önekleri loopback veya şablon metnidir. `.next` ve `node_modules` git dışındadır.

## Yapılamayan doğrulama

Bu makinede 1433 veya 5432 kapısında dinleyen yerel SQL Server veya PostgreSQL yoktur. Faz 7 yapılmadı: tarayıcıda `/setup`, giriş ve görev oluşturma çalıştırılmadı. Üretim veritabanı bu eksiği kapatmak için kullanılmadı. Yayın kapısı bu nedenle açık kalmaz.

## Bağımlılık

`npm audit` özeti: 42 bulgu (1 düşük, 10 orta, 30 yüksek, 1 kritik). Otomatik düzeltme çalıştırılmadı. `ldapjs` kullanımdan kalkmış paket uyarısı veriyor. Bu sürümde kimlik kodu yeniden yazılmadı. SheetJS kilit bütünlük özeti duruyor. `passport` ve `passport-ldapauth` kaynakta ve kilitte yok.

ESLint 9, Next.js 16 düz yapılandırmasının eş bağımlılığıdır. `next lint` bu sürümde komut olarak yoktur. İki yeni React Hooks kuralı kapalıdır; mevcut effect davranışı değiştirilmedi.

## Bilinen sınırlar

- `src/proxy.ts` çerez imzasını doğrulamaz.
- Kurulum bekçisi, kurulum bittikten sonra çerezdeki role güvenir.
- IMAP parolası veritabanında düz metin JSON olarak durur. LDAP bind parolası `config/ldap.json` içinde düz metin durur. Bu dosya git dışındadır.
- Logo dosyalarının marka dağıtım hakkı koddan anlaşılmaz.
- Lisans seçilmedi. `private: true` durur.

## Sonuç

Kaynak adayı yerel git geçmişine alınabilir. Herkese açık veya uzak yayın **NO-GO**. Sahip, lisans ve logo onayı vermeden push yapılmaz.

Bu makinede kayıtlı bir Git kimliği yoktur. İlk commit, kalıcı `git config` değiştirilmeden tek seferlik bir yer tutucu yazar ile oluşturulmuştur. Yazar adı depoya yazılan bir kişi kimliği değildir.
