# NotBak Proje Planı ve Rol Yetkileri Dokümanı

Bu doküman, NotBak uygulamasının **rol hiyerarşisi**, **yetki kuralları**, **veri modeli**, **API davranışı** ve **proje planını** tek yerde toplar. Tüm kararlar burada ayrıntılı şekilde kayıt altındadır.

---

## 1. Rol Hiyerarşisi (Ağaç)

Yetki seviyesi **yukarıdan aşağıya** azalır (üst rol, alt rollerin kapsadığı alanlarda daha geniş yetkilere sahiptir):

```
Admin
  └── Yönetici
        └── Birim Yöneticisi  [scope: atanmış birim(ler)]
              └── Proje Yöneticisi  [scope: atanmış proje(ler)]
                    └── Ekip Yöneticisi  [scope: atanmış ekip(ler)]
                          └── Ekip Üyesi  [scope: üyesi olduğu ekip(ler)]
                                └── Helper (Yardımcı)  [scope: görev bazlı atama]
```

**Teknik terimler:**
- **RBAC**: Role Based Access Control (rol bazlı yetkilendirme)
- **Scope**: Yetkinin geçerli olduğu kapsam (global / birim / proje / ekip / görev)
- **CRUD**: Create, Read, Update, Delete (oluştur / oku / güncelle / sil)
- **Read-only**: Sadece görüntüleme; değişiklik yapılamaz

---

## 2. Rol Tanımları (Detaylı)

### 2.1 Admin (ADMIN)

| Özellik | Değer |
|--------|--------|
| **Kapsam (scope)** | Global (tüm sistem) |
| **Yetki** | Sistem üzerindeki **tüm işlemler** sınırsız |
| **Ayarlar / Konfig** | Erişebilir (LDAP, kurulum, sistem parametreleri vb.) |
| **Rol atama** | **Sadece Admin**, Admin kullanıcısı ekleyebilir |

**Yapabilecekleri:** Kullanıcı, birim, proje, ekip, görev, not, ayarlar üzerinde tam CRUD. Yeni eklenen tüm özelliklerde sınırsız.

**Yapamayacakları:** Yok.

---

### 2.2 Yönetici (YONETICI)

| Özellik | Değer |
|--------|--------|
| **Kapsam (scope)** | Global (tüm sistem) |
| **Yetki** | **Ayarlar dışında** tüm işlemler sınırsız |
| **Ayarlar / Konfig** | **Erişemez** (sistemin çalışması için gereken parametreler ve ayarlar) |
| **Rol atama** | Admin rolü **veremez**. Verebileceği en yüksek rol **Yönetici** |

**Yapabilecekleri:**
- Birim / ekip / proje tanımı yapabilir; yeni özellikler (ayar olmayan) sınırsız kullanılır.
- Kullanıcı ekleme / çıkarma / güncelleme / aktif-pasif.
- Admin kullanıcılarını **sadece Admin** ekler; Yönetici Admin atayamaz.

**Yapamayacakları:**
- LDAP ayarları, kurulum, veritabanı bağlantısı, ortam parametreleri, güvenlik/oturum/anahtarlar/SMTP gibi **Settings/Config** kategorisindeki tüm ekranlar ve API’ler.

**Sınır:** "Settings boundary" – Yönetici, CONFIG sınıfındaki işlemlere dokunamaz; OPERATIONAL sınıfındaki her şeyi yapabilir.

---

### 2.3 Birim Yöneticisi (BIRIM_YONETICISI)

| Özellik | Değer |
|--------|--------|
| **Kapsam (scope)** | Yönetici/Admin tarafından atanmış **birim(ler)** |
| **Atama** | Hangi birimleri yöneteceği **sadece Yönetici ve Admin** tarafından belirlenir |

**Yapabilecekleri (sadece yetkili olduğu birimlerde):**
- Birime kullanıcı **ekleyebilir / çıkarabilir**.
- Birim içi proje / ekip oluşturma, düzenleme, silme.
- Kendi birimindeki projelere **Proje Yöneticisi** atayabilir.

**Yapamayacakları:**
- Birim tanımı oluşturma / silme (birim katalog yönetimi → Yönetici/Admin).
- Kendi yönettiği birim listesini değiştirme (sadece Yönetici/Admin değiştirir).
- Ayarlar / konfig.

---

### 2.4 Proje Yöneticisi (PROJE_YONETICISI)

| Özellik | Değer |
|--------|--------|
| **Kapsam (scope)** | Atanmış **proje(ler)** (her proje için ayrı atama) |
| **Görünürlük** | Kendi projesini görür; **aynı birimdeki diğer projeleri görmez** |

**Yapabilecekleri:**
- Kendi projesi ve proje ekibini tam yönetir (CRUD).
- **Yedek (read-only) atama:** Başka bir Proje Yöneticisi’ni projede **sadece okuma** olarak atayabilir.
- **Süreli tam yetki:** Aynı yedek atadığı kişiye **belirli bir süre için tam yetki** verebilir.
- **Süre dolunca:** Yetki **otomatik olarak read-only**’e döner.

**Yapamayacakları:** Aynı birimdeki diğer projeleri görme / yönetme.

**Teknik:** `ProjectDelegate` tablosu: `projectId`, `delegateUserId`, `permission` (READ_ONLY | FULL), `fullPermissionExpiresAt`.

---

### 2.5 Ekip Yöneticisi (EKIP_YONETICISI)

| Özellik | Değer |
|--------|--------|
| **Kapsam (scope)** | Atanmış **ekip(ler)** (ve bu ekiplerin bağlı olduğu proje) |

**Yapabilecekleri:**
- Ekip üyelerini yönetir (ekler / çıkarır).
- **Sadece kendi ekip işlerinde** tam CRUD (görev / not).
- **Proje içinde yeni ekip oluşturabilir.**

**Yapamayacakları:** Ekip kapsamı dışındaki projeleri / ekipleri görme ve yönetme.

---

### 2.6 Ekip Üyesi (EKIP_UYESI)

| Özellik | Değer |
|--------|--------|
| **Kapsam (scope)** | Üyesi olduğu **ekip(ler)** |

**Kendi atandığı görevler:**
- **Tam CRUD** (görür, yönetir, günceller, siler).

**Ekibin diğer görev / notları:**
- **Sadece görür (read-only)** ve **yorum yazabilir**; başka hiçbir şey yapamaz.

**Yardımcı (Helper) atama:**
- Kendi görevlerine **yardımcı (helper)** atayabilir.

---

### 2.7 Helper (Yardımcı) – Görev Bazlı

| Özellik | Değer |
|--------|--------|
| **Kapsam (scope)** | Atandığı **görev** (TaskCollaborator) |
| **Yetki** | Görevi **düzenleyemez**; **görür + yorum yazabilir** |

**Teknik:** `TaskCollaborator` ile atanır; yetki **read-only + comment** olarak yorumlanır.

---

## 3. Kullanıcı Yardımcısı (User Assistant) – Dar Model

**Genel kural:** Admin hariç her kullanıcı için **bir yardımcı (assistant)** atanabilir.

### 3.1 Atama (Seçenek C)
- **Kullanıcı (kendisi):** Kendi yardımcısını seçebilir / değiştirebilir / kaldırabilir.
- **Üst roller:**
  - **Yönetici:** Admin hariç herkesin yardımcısını atayabilir.
  - **Birim Yöneticisi:** Sadece yönettiği birim(ler)deki kullanıcıların yardımcısını atayabilir.

### 3.2 Kısıtlar
- **Admin** kullanıcısına yardımcı atanamaz (UI’da kapalı, API’da validate).
- **Yardımcı olarak atanacak kişi:** Admin olamaz; atanan kullanıcıyla **aynı birimde** olmalı (same-unit kuralı).

### 3.3 Yardımcının yetkisi (Dar model)
- Yardımcı **sadece** atandığı kullanıcının **kendi görevlerini** görür.
- Ekibin diğer görevlerini **görmez** (atanan kişinin “ekip görünürlüğü” miras alınmaz).
- Bu görevlerde **yorum yazabilir**; görevi **düzenleyemez / silmez** (read-only + comment).

### 3.4 Veri modeli
- `User.assistantUserId: String?` (nullable) – self-relation: kullanıcının yardımcısı.
- İlişki: `User.assistant`, ters: `User.assistedUsers`.

---

## 4. Yetki Kapsamları (Scope) Özeti

| Rol | Scope türü | Açıklama |
|-----|------------|----------|
| Admin | Global | Tüm sistem |
| Yönetici | Global | Tüm sistem (ayarlar hariç) |
| Birim Yöneticisi | Birim | Atanmış birim(ler) |
| Proje Yöneticisi | Proje | Atanmış proje(ler) + yedek delegasyon |
| Ekip Yöneticisi | Ekip | Atanmış ekip(ler) |
| Ekip Üyesi | Ekip | Üyesi olduğu ekip(ler) |
| Helper (görev) | Görev | Atandığı görev |
| Yardımcı (kullanıcı) | Kullanıcı | Atandığı kullanıcının kendi görevleri |

---

## 5. Veri Modeli (Prisma / Veritabanı)

### 5.1 Mevcut ve Yeni Modeller

- **User**
  - Mevcut: `id`, `email`, `displayName`, `passwordHash`, `ldapDn`, `source`, `isActive`, `isAdmin`, `lastSyncAt`, `createdAt`.
  - Yeni: `globalRole` (ADMIN | YONETICI | null) – isAdmin ile uyum için isAdmin=true ⇒ globalRole=ADMIN kabul edilebilir.
  - Yeni: `assistantUserId` (nullable), ilişki `assistant`, `assistedUsers`.
  - İlişkiler: UnitMember, TeamMember, ProjectMember, ProjectDelegate (delegateUserId), Task, TaskCollaborator, Comment, ownedProjects.

- **Unit**
  - `id`, `name`, `createdAt`.
  - İlişkiler: UnitMember[].

- **UnitMember**
  - `unitId`, `userId`, `role` (BIRIM_YONETICISI | EKIP_UYESI vb.).
  - @@id([unitId, userId]).

- **Team**
  - `id`, `name`, `projectId`, `createdAt`.
  - İlişkiler: Project, TeamMember[].

- **TeamMember**
  - `teamId`, `userId`, `role` (EKIP_YONETICISI | EKIP_UYESI).
  - @@id([teamId, userId]).

- **Project**
  - Mevcut: `id`, `name`, `ownerId`, members, tasks.
  - Yeni: `unitId` (nullable) – projenin bağlı olduğu birim.

- **ProjectMember**
  - Mevcut: `projectId`, `userId`.
  - Yeni: `role` (PROJE_YONETICISI | EKIP_UYESI vb.).

- **ProjectDelegate**
  - `projectId`, `delegateUserId`, `permission` (READ_ONLY | FULL), `fullPermissionExpiresAt` (DateTime?, nullable).
  - Yedek proje yöneticisi; süre dolunca efektif yetki read-only.

- **Task**
  - Mevcut yapı korunur; assignee ve TaskCollaborator ile yetki belirlenir.

- **TaskCollaborator**
  - Mevcut: `taskId`, `userId`.
  - Yeni (opsiyonel): `permission` (READ_ONLY | FULL) – Helper için READ_ONLY, tam yetkili yardımcı için FULL.

- **Notification**
  - `id`, `userId`, `type` (örn. ASSIGNMENT, COLLABORATOR_ADDED, REMINDER), `title`, `body`, `link`, `read`, `createdAt`.
  - Kullanıcıya özel bildirimler: görev atama, ilgili kişi eklenmesi, son tarihi 30 dakika içinde olan görev hatırlatmaları. API: GET/PATCH /api/notifications, okundu işaretleme, tümünü okundu işaretle.

### 5.2 Rol Sabitleri (String)

- Global: `ADMIN`, `YONETICI`
- Birim: `BIRIM_YONETICISI`, `EKIP_UYESI` (birim üyesi)
- Proje: `PROJE_YONETICISI`, `EKIP_UYESI`
- Ekip: `EKIP_YONETICISI`, `EKIP_UYESI`
- Delegasyon: `READ_ONLY`, `FULL`
- TaskCollaborator: `READ_ONLY` (helper), `FULL` (tam yetkili kolaboratör)

---

## 6. API Davranışı (Yetkilendirme Kuralları)

### 6.1 Settings / Config sınırı
- **Path’ler:** `/api/ldap/*`, `/api/setup/*`, `/dashboard/settings/*` (LDAP, kurulum, sistem ayarları).
- **İzin:** Sadece **Admin** (globalRole === ADMIN veya isAdmin === true).
- Yönetici bu path’lere erişemez (403).

### 6.2 Admin atama kuralı
- **Kullanıcı oluşturma/güncelleme** sırasında `globalRole = ADMIN` veya `isAdmin = true` atanacaksa:
  - İstek yapan kullanıcı **mutlaka Admin** olmalı.
  - Aksi halde 403: "Sadece Admin kullanıcıları Admin rolü atayabilir."

### 6.3 Yönetici rol sınırı
- Yönetici, başka kullanıcıya en fazla **Yönetici** rolü atayabilir; **Admin atayamaz**.

### 6.4 Birim / Proje / Ekip scope
- Birim Yöneticisi: Sadece kendisine atanmış birimlerdeki kaynaklara erişir.
- Proje Yöneticisi: Sadece atandığı proje(ler) ve yedek delegasyonla (süreli tam yetki dahil) erişir.
- Ekip Yöneticisi / Ekip Üyesi: Sadece ilgili ekip(ler) ve görevlere erişir.

### 6.5 Yardımcı (Assistant) atama
- Atamayı yapan: ya hedef kullanıcının kendisi ya da Yönetici / Birim Yöneticisi (kapsamında).
- Hedef kullanıcı Admin olamaz.
- Atanacak yardımcı: Admin olamaz; hedef kullanıcıyla **aynı birimde** olmalı.

### 6.6 Görev / Not görünürlüğü
- Ekip Üyesi: Kendi görevleri tam CRUD; ekibin diğer görevleri read-only + yorum.
- Helper (TaskCollaborator, READ_ONLY): Görevi düzenleyemez; görür + yorum yazar.
- Yardımcı (User.assistant): Sadece atandığı kullanıcının kendi görevlerini görür; read-only + yorum.
- **Projesiz veya atayan/ilgili kişi kuralı:** Bir görev/notu yalnızca **sorumlu (assignee)** veya **ilgili kişi (TaskCollaborator)** görebilir; başkalarının kayıtları listelenmez.

### 6.7 Proje görünürlüğü
- **Admin:** Tüm projeleri görür ve yönetir.
- **Diğer kullanıcılar:** Sadece **proje sorumlusu (owner)** olduğu, **proje ekip üyesi (ProjectMember)** olduğu veya proje altındaki bir **ekipte (TeamMember)** üye/yönetici olduğu projeler listelenir ve erişilebilir. Proje listesi (GET /api/projects) ve proje detay (GET /api/projects/[id]) bu kurala göre filtrelenir; yetkisiz erişimde 403 döner.

---

## 7. Proje Planı – Yapılacaklar (Sıradaki Adımlar)

1. **Veri modeli**
   - Prisma şemasına Unit, UnitMember, Team, TeamMember, Project.unitId, ProjectMember.role, ProjectDelegate, User.assistantUserId (ve gerekirse globalRole) eklenmesi.
   - TaskCollaborator’a permission (READ_ONLY | FULL) eklenmesi.
   - Migration oluşturulması ve çalıştırılması.

2. **Yetkilendirme katmanı**
   - `lib/authz.ts`: Rol sabitleri, canAccessSettings, canAssignAdmin, canManageUserAssistant, getEffectiveProjectPermission, getUnitsForUser, getTeamsForUser vb. yardımcılar.
   - API route’larında bu yardımcıların kullanılması.

3. **API güncellemeleri**
   - Kullanıcı: oluşturma/güncelleme/liste → globalRole, assistantUserId, “sadece Admin Admin atar” validasyonu.
   - Projeler: unitId, ProjectMember.role, ProjectDelegate CRUD.
   - Birim/Ekip: Unit, UnitMember, Team, TeamMember CRUD API’leri.
   - Görev/Not: scope’a göre filtreleme ve yetki kontrolü (assignee, helper, ekip üyesi, yardımcı).

4. **UI**
   - Ayarlar sayfaları: Sadece Admin erişebilsin; Yönetici için 403 veya yönlendirme.
   - Kullanıcı yönetimi: Rol atama (globalRole), yardımcı atama (dropdown), birim üyeliği.
   - Birim yönetimi: Birim CRUD, birim üyesi ve Birim Yöneticisi atama.
   - Proje yönetimi: Proje-birim bağlantısı, proje üyesi rolü, yedek proje yöneticisi (read-only + süreli tam yetki) atama ekranı.
   - Ekip yönetimi: Ekip CRUD, ekip üyesi ve Ekip Yöneticisi atama.
   - Görev/not: Ekip üyesi için “diğer görevler read-only + yorum”, Helper için düzenleme gizleme.

5. **Otomasyon**
   - Proje yedeği süre dolunca: Periyodik job veya istek anında `fullPermissionExpiresAt` kontrolü ile efektif yetkinin read-only’e düşmesi.

---

## 8. Yapılanlar (Uygulama Özeti)

Aşağıdaki işlemler uygulandı ve kayıt altına alındı.

- **Doküman:** Bu proje planı ve rol yetkileri dokümanı oluşturuldu; tüm rol tanımları, kurallar, veri modeli ve API davranışı kayıt altına alındı.
- **Prisma şeması:** Unit, UnitMember, Team, TeamMember, Project.unitId, ProjectMember.role, ProjectDelegate, User.assistantUserId ve ilgili ilişkiler eklendi; TaskCollaborator.permission eklendi.
- **Yetkilendirme:** `lib/authz.ts` modülü eklendi; rol sabitleri, ayar erişimi, Admin atama ve yardımcı atama kuralları uygulandı.
- **API:** Kullanıcı oluşturma/güncelleme ve listeleme, globalRole ve assistantUserId ile güncellendi; “sadece Admin Admin atar” kuralı uygulandı.
- **Proje planı:** Son duruma göre güncellendi; sıradaki adımlar ve yapılanlar bu dokümanda belirtildi.
- **Migration:** `prisma/migrations/rol_ve_birim_migration.sql` – SQL Server için manuel migration; sonrasında `npx prisma generate` gerekir.
- **LDAP ayarları:** GET/POST /api/ldap/settings – `canAccessSettings` ile sadece Admin erişir; Yönetici 403 alır.
- **Kullanıcı güncelleme:** PATCH /api/users/[id] – assistantUserId, globalRole, isActive, displayName; yardımcı için aynı birim kontrolü.
- **Proje görünürlüğü:** GET /api/projects listesinde ve GET /api/projects/[id] erişiminde sadece admin tüm projeleri görür; diğer kullanıcılar yalnızca owner / ProjectMember / proje altı ekipte (TeamMember) oldukları projeleri görür; yetkisiz erişimde 403.
- **Proje Ekip/Ayarlar:** Proje detay sayfasında ekip üyeleri **Proje Yöneticisi** veya **Ekip Üyesi** rolüyle eklenebilir/güncellenebilir (POST/PATCH members, role alanı).
- **LDAP giriş:** E-posta ile girişte LDAP kullanıcıları için DN + parola ile bind denenir; LDAP’tan eklenen kullanıcılar varsayılan aktif (`isActive: true`). AD listesinde kullanıcılar "Adı – E-posta – Oturum adı (sAMAccountName)" tek satırda gösterilir.
- **Bildirimler:** Notification modeli; GET/PATCH /api/notifications, okundu ve tümünü okundu işaretleme. Görev atama ve ilgili kişi eklemede bildirim oluşturulur; son tarihi 30 dakika içinde olan görevler için hatırlatma. Arayüzde zil ikonu, liste (yeniden eskiye), kırmızı balon (okunmamış sayı).
- **Görev/not görünürlüğü:** Projesiz veya erişim kapsamı dışındaki kayıtlar sadece **sorumlu** ve **ilgili kişiler** tarafından görülür; liste ve detay API’leri buna göre filtrelenir.
- **Notlar ekranı:** Kanban kaldırıldı; liste (tablo) görünümü. Notlar’da "Yeni" ile varsayılan tip Not, Bana Özel işaretli. Görevler sayfası üst menüde link ile erişilebilir.

---

*Son güncelleme: Rol hiyerarşisi ve proje planı son duruma göre güncellendi; yapılan tüm işlemler Bölüm 8’de ayrıntılı kayıt altına alındı.*
