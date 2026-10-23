# Yapılandırma

Ayarlar ortam değişkeni, `config/setup.json` ve veritabanındaki `AppSetting` kayıtları arasında dağılır. Örnek dosya `.env.example` dosyasıdır. Gerçek değerler `.env` içine yazılır ve git tarafından yok sayılır.

## Zorunlu

| Değişken | Anlamı |
| --- | --- |
| `DATABASE_URL` | SQL Server bağlantı dizesi. Kurulum sihirbazı yerel hedefe göre yazar. İçinde `placeholder` geçen değer, kurulum bitene kadar yok sayılır. |
| `SETUP_COMPLETE` | `true` ise sihirbaz tamamlanmış sayılır. Örnek dosyada `false` durur. |
| `SESSION_SECRET` | Oturum çerezini imzalayan gizli anahtar. En az 16 karakter ve `change-me-in-production` dışında bir değer olmadan giriş açılmaz. |

## Uygulama adresi

| Değişken | Anlamı |
| --- | --- |
| `APP_URL` | E-posta içindeki bağlantıların kök adresi. Geliştirmede `http://127.0.0.1:3000`. |
| `NEXT_PUBLIC_APP_URL` | İsteğe bağlı. Tarayıcıya da aynı adres verilecekse doldurulur. |

`https://` ile başlayan `APP_URL`, oturum çerezine `Secure` bayrağı ekler. Düz HTTP yerel ağda bu bayrak kapalı kalır.

## E-posta

| Değişken | Anlamı |
| --- | --- |
| `SMTP_HOST` | Giden posta sunucusu. Boşsa ortam değişkeninden gönderim yapılmaz. |
| `SMTP_PORT` | Kapı. Örnek: `587`. |
| `SMTP_USER` | İsteğe bağlı kullanıcı. |
| `SMTP_PASS` | İsteğe bağlı parola. |
| `SMTP_SECURE` | `true` ise bağlantı baştan TLS (şifreli taşıma) olur. |
| `SMTP_REJECT_UNAUTHORIZED` | `false` ise sertifika doğrulaması kapanır. Varsayılan doğrulama açıktır. |
| `MAIL_FROM_EMAIL` | Gönderen adres. Örnek: `noreply@example.com`. |
| `MAIL_FROM_NAME` | Gönderen görünen ad. |

SMTP sunucu kaydı yönetim ekranından da yazılır ve `AppSetting` tablosunda durur. IMAP parolası aynı tabloda düz metin JSON olarak durur. Bu bilinen bir sınırdır. Ayrıntı `docs/GUVENLIK.md` içindedir.

## Zamanlayıcı

| Değişken | Anlamı |
| --- | --- |
| `ENABLE_INTERNAL_CRON` | `false` ise süreç içi günlük özet kapanır. |
| `ENABLE_INTERNAL_IMAP_POLL` | `false` ise süreç içi IMAP yoklaması kapanır. |
| `CRON_SECRET` | Dış tetik için paylaşılan sır. Boşsa `/api/cron/daily-digest` ve `/api/cron/imap-poll` reddeder. |

Dış tetikte sırrı sorgu dizesine koymayın. `Authorization: Bearer` başlığı kullanın. Sorgu dizesi erişim günlüğüne düşebilir.

## LDAP

Değerler örnek şablondur. Kendi dizininizi kurulumdan sonra ayarlar ekranına yazın. Kaynak kodda kurum dizini yoktur.

| Değişken | Anlamı |
| --- | --- |
| `LDAP_URL` | Örnek: `ldap://127.0.0.1:389` |
| `LDAP_BIND_DN` | Arama yapan hesabın ayırt edici adı |
| `LDAP_BIND_PASSWORD` | O hesabın parolası |
| `LDAP_SEARCH_BASE` | Aramanın başladığı dal |
| `LDAP_SEARCH_FILTER` | Kullanıcı süzgeci. Active Directory için `(sAMAccountName=%s)` |
| `LDAP_GROUP_FILTER` | İsteğe bağlı grup süzgeci |

Kayıtlı LDAP ayarı `config/ldap.json` dosyasına yazılır. Bu dosya git'e girmez. Bind parolası düz metindir. Dosyayı yedeklerken parola içerdiğini kabul edin.

## Uzak sıfırlama

`NOTBAK_ALLOW_REMOTE_DB_RESET` yalnızca `true` olduğunda, loopback dışındaki bir hedefte şema sıfırlamasına izin verir. Varsayılan kapalıdır. Geliştirmede açmayın.
