# Veritabanı

## Kaynak şema

Doğrulanmış motor SQL Server'dır. Şemanın kaynağı `prisma/schema.prisma` dosyasıdır.

Kurulum sihirbazı, seçilen motora göre şu kopyalardan birini `schema.prisma` üzerine yazar:

- `prisma/schema.sqlserver.prisma` — aktif şema ile aynı model ve alan kümesi
- `prisma/schema.postgresql.prisma` — aynı alanların PostgreSQL tür karşılığı

PostgreSQL kopyası bu yayında desteklenen kurulum yolu değildir. Dosya, alanların geri kalmaması için hizalanmıştır. Yeni kurulumda SQL Server seçin.

## Boş kurulum

Başka bir SQL dosyası çalıştırmayın. Bu pakette artımlı yama SQL'i yoktur. Canlı veritabanına uygulanmış eski yamalar bu kaynağın kurulum adımı değildir.

Boş kurulumun tek yolu `/setup` sihirbazıdır:

1. Hedef `localhost` veya `127.0.0.1` olur.
2. Veritabanı yoksa sihirbaz, kullanıcının verdiği adla boş bir veritabanı açabilir.
3. Tablolar Prisma `db push` ile oluşturulur. Prisma, şemayı veritabanına uygulayan araçtır.
4. Tablolar yoksa komut `--force-reset` içerir. Bu, hedef veritabanındaki nesneleri silip şemayı yeniden kurar.
5. Hedef loopback değilse bu sıfırlama yapılmaz. `NOTBAK_ALLOW_REMOTE_DB_RESET=true` bu kilidi açar. Geliştirme kopyasında açmayın.

Sihirbaz bittiğinde `config/setup.json` bağlantı dizesini ve yönetici parola özetini tutar. `.env` içinde `SETUP_COMPLETE=true` yazılır. İki dosya da git dışındadır.

## Veri

Bu paket örnek kişi, görev veya müşteri kaydı içermez. Sentetik gösteri verisi de yoktur. İlk yöneticiyi sihirbaz sorar. Gerçek kurum kaydı yüklemeyin.

## Modeller

`User`, `Unit`, `UnitMember`, `Project`, `ProjectMember`, `ProjectDelegate`, `Team`, `TeamMember`, `Task`, `TaskCollaborator`, `Comment`, `TaskAssignmentHistory`, `ProblemReport`, `Notification`, `ImportPendingApproval`, `ProjectJoinRequest`, `InboundEmailRecord`, `AppSetting`.

Roller ve durumlar SQL Server'da enum olmadığı için metin olarak saklanır. Örneğin `ADMIN`, `YONETICI`, `EKIP_UYESI`.
