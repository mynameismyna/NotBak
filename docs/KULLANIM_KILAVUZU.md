# NotBak Kullanım Kılavuzu

Bu kılavuz, NotBak uygulamasının günlük kullanımını adım adım açıklar. Görev, not ve fikir yönetimi, projeler, e-posta entegrasyonu, talepler, takvim ve ayarlar bölümleri anlatılmaktadır.

---

## 1. NotBak Nedir?

**NotBak**, ekiplerin görevleri, notları ve fikirleri tek bir yerde yönetmesini sağlayan bir **görev ve proje yönetim** uygulamasıdır. Özellikler:

- **Görevler:** Başlık, açıklama, **tip** (Görev / Not / Fikir), durum (Yeni, Devam Ediyor, Beklemede, Tamamlandı), öncelik, son tarih, sorumlu kişi ve proje ile oluşturma ve takip. Listede ve takvimde **tipe göre renk** (mor / sarı / mavi) kullanılır.
- **Notlar:** Görev ve notları **Kanban board** (sürükle-bırak kolonlar) görünümünde yönetme; proje filtresi ve **Yeni** butonu ile varsayılan olarak "Not" tipinde, "Bana Özel" işaretli kayıt ekleme.
- **Projeler:** Görevleri projelere bağlama ve proje bazlı filtreleme. Projeleri yalnızca **proje sorumlusu**, **proje ekip üyeleri** veya **proje alt ekiplerinde yer alan kullanıcılar** (ve admin) görebilir. Proje görünürlüğü ve katılım talepleri desteklenir.
- **Excel'den Toplu Yükleme:** Görevler ve notlar sayfasında Excel şablonu indirip, toplu kayıt yükleme. Başka projelere atanan kayıtlar için onay mekanizması.
- **E-posta Entegrasyonu:** IMAP ile gelen e-postalar otomatik olarak sisteme alınır, görev veya nota dönüştürülebilir.
- **Talepler:** Import onay talepleri ve proje katılım talepleri tek bir sayfadan takip edilir.
- **Haftalık takvim:** Ana sayfada haftalık görünümde görevleri görme; mevcut saat satırı otomatik görünür; kartlara **çift tıklayarak** detay açma. Görevler **tip rengine göre** (Görev / Not / Fikir) gösterilir.
- **Yorumlar ve ilgili kişiler:** Görevlere yorum yazma ve birden fazla kişiyi "ilgili kişi" olarak ekleme.
- **Bana Özel:** Görev oluştururken "Bana Özel" işaretlenebilir; bu görevleri yalnızca siz ve yöneticiler görür.
- **Bildirimler:** Sağ üstte **zil ikonu**; size atanan kayıtlar, ilgili kişi eklendiğinde, import onay talepleri, proje katılım talepleri, e-posta kayıtları ve **son tarihi 30 dakika içinde** olan görevler için hatırlatmalar (yeniden eskiye). Kırmızı balonda okunmamış sayı.
- **Günlük E-posta Özeti:** Kullanıcı bazlı günlük özet e-postası; size atanan görevler, bugünkü görevler ve son tamamlanan kayıtlar özetlenir.
- **Birimler ve Ekipler:** Organizasyonel birim yapısı ve proje bazlı ekip yönetimi.

---

## 2. Giriş ve Ana Menü

- Uygulama adresi açıldığında **giriş (login)** ekranı gelir. E-posta ve şifre ile giriş yapın. LDAP/Active Directory kullanıcıları da aynı ekrandan e-posta ve parola ile giriş yapar.
- Giriş sonrası **Dashboard** açılır. Üstte **NotBak** logosu ve menü bağlantıları vardır:

| Menü        | Açıklama |
|-------------|----------|
| **Ana Sayfa** | Haftalık takvim, proje ve "Bana Atanmış Görevler" sayıları, "Tüm Görevler" ve "Notlar" kısayol butonları |
| **Çalışmalarım** (açılır menü) | **Görevler:** Görev/not/fikir listesi (tablo), filtreler, proje filtresi, Excel import, **Yeni** butonu. **Notlar:** Kanban board (sürükle-bırak kolonlar), proje filtresi, Excel import, **Yeni** (varsayılan tip: Not, Bana Özel işaretli). **Projeler:** Proje listesi, yeni proje, katılım talebi, her projede Ekip/Ayarlar |
| **Kayıtlar** (açılır menü) | **Talepler** (import onayları ve proje katılım talepleri; bekleyen sayısı rozetle gösterilir), **Gönderilen Kayıtlar** (e-posta adresinizden gelen e-posta kayıtları; bekleyen sayısı rozetle gösterilir), **Bilinmeyen Kayıtlar** (yalnızca admin; tanınmayan e-posta adreslerinden gelen kayıtlar) |
| **Ayarlar**  | Yalnızca yetkili kullanıcılar görür. Kullanıcılar, birimler, LDAP, IMAP, SMTP, e-posta bilgilendirme, parola değiştirme |

Sağ üstte **Arama**, **Yardım** (Hakkında, Kullanım Kılavuzu, SSS, Sorun Bildir), **Bildirimler (zil ikonu)** ve **Kullanıcı menüsü** (Çıkış, Parola değiştir vb.) bulunur. **Görevler** sayfasına **Çalışmalarım → Görevler** veya Ana Sayfadaki **"Tüm Görevler"** / **"Bana Atanmış Görevler"** kartına tıklayarak ulaşılır.

---

## 3. Ana Sayfa (Dashboard)

Ana sayfada şunlar yer alır:

- **Haftalık takvim:** Haftanın günleri ve o güne son tarihi atanmış görevler. Takvim açıldığında **mevcut saat satırı** otomatik olarak görünür alanın üstünde gelir. Görev kartları **tipine göre renklidir** (Görev: mor, Not: sarı, Fikir: mavi). Bir göreve **çift tıklayınca** görev detay penceresi (modal) açılır.
- **Kartlar:** "Projeler" ve "Bana Atanmış Görevler" sayıları; tıklanınca ilgili sayfaya gider.
- **Butonlar:** "Tüm Görevler" ve "Notlar" sayfalarına kısayol.

---

## 4. Görevler Sayfası

**Erişim:** Üst menüden **Görevler** veya Ana Sayfadaki **"Tüm Görevler"** veya **"Bana Atanmış Görevler"** kartına tıklayarak gidilir (adres: `/dashboard/tasks`).

### 4.1 Liste ve Filtreler

- **Yeni Görev (Yeni butonu):** Sağ üstteki **"Yeni"** butonu ile yeni görev oluşturma penceresi (modal) açılır.
- **Görünüm filtreleri (sekme butonları):**
  - **Tümü:** Tüm görevler
  - **Bana Atanmış:** Size atanmış görevler
  - **Bu Hafta:** Son tarihi bu hafta içinde olan görevler
  - **Bekleyen:** Durumu "Beklemede" olan görevler
  - **Tamamlanan:** Durumu "Tamamlandı" olan görevler
- **Proje filtresi:** Açılır listeden bir proje seçilerek liste yalnızca o projedeki görevlere indirgenir (isteğe bağlı).

### 4.2 Tablo ve Renkler

Listede **tip** (Görev / Not / Fikir) ve diğer bilgiler gösterilir. Satırlar **tipine göre renklidir**: Görev (mor ton), Not (sarı / defter rengi), Fikir (açık mavi). Sütunlar: **Eklenme Tarihi**, **Sorumlu**, **Öncelik**, **Tip**, **Durum**, **Başlık**, **Son Tarih**, **Durum Değişimi**, **Tamamlanma Tarihi**, **İşlem**. Sütun başlıklarına tıklayarak **artan/azalan sıralama** yapılabilir (İşlem hariç). Başlığa veya "Detay"a tıklayınca **görev detay penceresi** açılır.

### 4.3 Yeni Görev Oluşturma

1. **"Yeni"** butonuna tıklayın.
2. Açılan pencerede:
   - **Tip:** Görev, Not veya Fikir (açılır listeden).
   - **Bana Özel:** İşaretlenirse görev yalnızca siz ve yetkili kullanıcılar tarafından görülür (varsayılan işaretli gelebilir).
   - **Başlık**, **Açıklama** (zorunlu).
   - **Öncelik:** Acil, Yüksek, Orta, Düşük.
   - **Son Tarih**.
   - **Sorumlu:** Atanacak kullanıcı.
   - **Proje:** (İsteğe bağlı) Bağlanacak proje.
3. Yeni görevde **Durum** alanı gösterilmez; görev **"Yeni"** durumuyla kaydedilir.
4. **Kaydet** ile görev oluşturulur; liste yenilenir.

### 4.4 Excel'den Toplu Görev Yükleme

Görevler sayfasında Excel ile toplu kayıt yükleme özelliği bulunur:

1. **Şablon İndir:** "Görev şablonu indir" butonuna tıklayarak `.xlsx` formatında şablon dosyasını indirin. Şablon, doğru sütun başlıklarını (Başlık, Açıklama, Öncelik, Son Tarih vb.) içerir.
2. **Şablonu Doldurun:** İndirdiğiniz dosyayı açıp satırları doldurun.
3. **Excel'den Toplu Yükle:** "Excel'den toplu yükle" butonuna tıklayarak doldurulan dosyayı (`.xlsx`, `.xls` veya `.csv`) seçin.
4. **Sonuç:** Yükleme tamamlandığında kaç kayıt oluşturulduğu, kaç talebin onay beklediği ve varsa atlanan satırlar bildirilir.

**Import Onay Mekanizması:** Excel'den yüklenen kayıtlarda, sorumlu kişi projenin üyesi değilse kayıtlar **onay talebi** olarak proje yöneticisine gönderilir. Proje yöneticisi onayladığında kayıtlar oluşturulur ve isteğe bağlı olarak sorumlu kişi projeye üye olarak eklenir. Reddettiğinde kayıtlar projesiz olarak oluşturulur. Bu talepler **Kayıtlar → Talepler** sayfasından takip edilir.

---

## 5. Görev Detay Penceresi (Modal)

Görev listesinde veya haftalık takvimde bir göreve (listede tek tık, takvimde **çift tık**) tıklanınca **görev detay penceresi** açılır. Bu pencerede:

### 5.1 Temel Bilgiler

- Başlık, proje adı, açıklama
- Durum, öncelik, son tarih, sorumlu
- **Kalan gün** (son tarihe göre)
- **Başlatılma:** Görev "Devam Ediyor" yapıldığında kaydedilen tarih (örn. "X gün önce")
- **Tamamlanma tarihi:** Görev "Tamamlandı" yapıldığında kaydedilen tarih

### 5.2 Görevi Başlat / Görevi Tamamla

- **Görevi Başlat** (yeşil): Durumu "Yeni" olan görevde görünür. Tıklanınca durum "Devam Ediyor" olur, başlatılma ve durum değişim tarihi kaydedilir, otomatik bir yorum eklenir ("Bu görev [Ad Soyad] tarafından başlatıldı.").
- **Görevi Tamamla** (kırmızı): Durum "Devam Ediyor" veya "Beklemede" iken görünür. Tıklanınca durum "Tamamlandı" olur ve tamamlanma tarihi kaydedilir.

**Yetki:** Bu butonlar yalnızca **sorumlu** veya **ilgili kişi (ekip üyesi)** için etkindir. Değilseniz butonlar soluk (disabled) görünür ve üzerine gelince açıklama çıkar.

### 5.3 Düzenle ve Sil

- **Düzenle:** Görev bilgilerini (başlık, açıklama, durum, öncelik, son tarih, sorumlu, proje, tip, Bana Özel vb.) değiştirmek için formu açar.
- **Sil:** Görevi siler; onay penceresi çıkar.

### 5.4 İlgili Kişi (Ekip Üyesi)

- **Görüntüleme modunda:** Sadece sorumlu ve diğer ilgili kişilerin listesi görünür.
- **Düzenle modunda:** "İlgili Kişi Ekle" bölümü açılır:
  - Açılır listeden kullanıcıları **çoklu seçim** (checkbox) ile seçebilirsiniz; liste hiyerarşiye göre sıralı gelir.
  - "Seçilenleri Ekle" ile seçilen kullanıcılar ilgili kişi olarak eklenir.
  - Listede "Çıkar" ile bir ilgili kişiyi kaldırabilirsiniz (yetkiniz varsa).

### 5.5 Yorumlar

- **Yorum ekleme:** Metin kutusuna yazıp **Yorum Ekle** butonuna tıklayın.
- **Kısayol:** **Alt+Enter** ile yorumu doğrudan gönderebilirsiniz.
- Yorumlar **en yenisi üstte** listelenir; yazar adı ve tarih/saat gösterilir.

Pencereyi kapatmak için dışarı tıklayabilir veya kapatma (X) butonunu kullanabilirsiniz.

---

## 6. Notlar Sayfası (Kanban Board)

**Menü:** Üst menüden **Çalışmalarım → Notlar** ile gidilir (adres: `/dashboard/board`).

Notlar sayfası **Kanban board** (sürükle-bırak) görünümündedir. Görevler dört kolonda listelenir: **Yeni**, **Devam Ediyor**, **Beklemede**, **Tamamlandı**. Kartlar **tipine göre renklidir** (Görev: mor, Not: sarı, Fikir: mavi).

- **Proje filtresi:** "Tüm Projeler" veya açılır listeden tek bir proje seçerek board yalnızca o projedeki kayıtları gösterir.
- **Yeni:** Sağ üstteki **Yeni** butonu ile yeni kayıt ekleme penceresi açılır. Varsayılan **tip: Not**, **Bana Özel** işaretlidir; başlık, açıklama, öncelik, son tarih, sorumlu ve proje seçilebilir.
- **Sürükle-bırak:** Kartları kolonlar arasında sürükleyerek durum güncelleyebilirsiniz (Yeni → Devam Ediyor → Beklemede → Tamamlandı).
- **Kart tıklama:** Bir karta tıklayınca **görev detay penceresi** (modal) açılır; düzenleme, yorum ve ilgili kişi işlemleri buradan yapılır.
- **Görsel:** Sayfa not defteri temasıyla (cilt ve kağıt görünümü) sunulur.

### 6.1 Excel'den Toplu Not Yükleme

Notlar sayfasında **Excel'den toplu yükle** butonu bulunur. İşleyişi Görevler sayfasındaki ile aynıdır:

1. "Not şablonu indir" ile not tipine uygun şablonu indirin.
2. Şablonu doldurup "Excel'den toplu yükle" ile dosyayı seçin. Onay mekanizması (proje üyesi olmayan sorumlular için) Görevler sayfasındaki gibi geçerlidir.

---

## 7. Projeler Sayfası

- **Görünürlük:** Listede yalnızca **erişim yetkiniz olan projeler** görünür: proje sorumlusu olduğunuz, proje ekip üyesi olduğunuz veya proje altındaki bir ekipte (Team) üye/yönetici olduğunuz projeler. **Admin** tüm projeleri görür.
- Proje listesinde proje adı, sahip, görev sayısı; **Ekip / Ayarlar** ve **Sil** bağlantıları yer alır.
- **Yeni proje:** Formda proje adı ve isteğe bağlı sahip (owner) seçilerek proje oluşturulur.
- **Ekip / Ayarlar:** Bir projeye tıklanınca proje detay sayfası açılır; proje adı ve sorumlu düzenlenebilir, **Ekip** bölümünde üyeler **Proje Yöneticisi** veya **Ekip Üyesi** rolüyle eklenebilir/çıkarılabilir.

### 7.1 Proje Görünürlük Ayarları

Proje detay sayfasında (**Ekip / Ayarlar**) aşağıdaki ayarlar bulunur:

- **Görünürlük:** "Sadece üyeler görsün" (varsayılan) veya "Herkes görsün" seçenekleri. "Herkes görsün" seçildiğinde tüm aktif kullanıcılar projeyi listede görebilir.
- **Herkes görev/not ekleyebilir:** İşaretlendiğinde proje üyesi olmayan kullanıcılar da bu projeye görev veya not ekleyebilir.

### 7.2 Projeye Katılım Talebi

Yeni proje oluştururken girilen isimde bir proje zaten mevcutsa, sistem sizi bilgilendirir ve o projeye **katılım talebi** gönderme seçeneği sunar:

1. Proje oluşturma formunda proje adını yazın.
2. Eğer aynı isimde bir proje varsa, ekranda "Bu isimde bir proje zaten mevcut" uyarısı ve **"Evet, katılım talebi gönder"** butonu görünür.
3. Butona tıklayarak proje yöneticisine katılım talebi gönderirsiniz.
4. Proje yöneticisi talebi **Kayıtlar → Talepler** sayfasından Onayla veya Reddet ile değerlendirir.

---

## 8. Talepler Sayfası

**Erişim:** Üst menüden **Kayıtlar → Talepler** ile gidilir (adres: `/dashboard/talepler`).

Talepler sayfası, iki tür talebi tek yerde yönetmenizi sağlar:

### 8.1 Bana Gelen Talepler

"Bana gelen" sekmesinde, sizin onayınızı bekleyen talepler listelenir:

- **Import Talepleri:** Başka bir kullanıcı Excel'den toplu yükleme yaptığında, projenizde olmayan bir kullanıcıya görev atamışsa, onay talebi size gelir. **"İncele / Onayla"** butonuyla talep detayına gidin. Detay sayfasında:
  - Talep eden kişi, atanacak kişi ve proje bilgileri görülür.
  - Kayıtların listesi (başlık, açıklama, öncelik, son tarih) tablo olarak gösterilir.
  - **"Kullanıcıyı projeye üye olarak ekle"** seçeneği (varsayılan açık). İşaret kaldırılırsa kullanıcıya yalnızca ilgili kayıtlarda görüntüleme ve yorum yetkisi verilir.
  - **Onayla:** Kayıtlar oluşturulur ve kullanıcı isteğe bağlı olarak projeye eklenir.
  - **Reddet (projesiz kaydet):** Kayıtlar projesiz olarak oluşturulur.
- **Proje Katılım Talepleri:** Bir kullanıcı projenize katılmak istediğinde talep burada listelenir. **Onayla** veya **Reddet** butonlarıyla değerlendirin.

### 8.2 Gönderdiğim Talepler

"Gönderdiğim" sekmesinde, sizin gönderdiğiniz talepler ve durumları (Beklemede / Onaylandı / Reddedildi) listelenir. Onaylanan proje katılım taleplerinde "Projeye git" linki görünür.

---

## 9. E-posta ile Görev, Not veya Fikir Ekleme

E-posta kullanarak uygulamaya girmeden görev, not veya fikir ekleyebilirsiniz. Bunun için **notes@example.com** adresine e-posta göndermeniz yeterlidir. E-postanız kısa süre içinde NotBak’e düşer; ardından uygulama içinde tek tıklamayla bunu görev, not veya fikir kaydına dönüştürürsünüz.

### 9.1 E-posta ile Nasıl Kayıt Eklenir?

**Adım 1 – E-posta gönderin**

- Bilgisayar veya telefonunuzdaki e-posta programınızı (Outlook, Gmail, Apple Mail vb.) açın.
- **Alıcı** olarak **notes@example.com** adresini yazın.
- E-postayı **NotBak’te kayıtlı kendi iş e-posta adresinizle** gönderin. Sistem sizi bu adresle tanır; başka bir adres kullanırsanız kaydınız “Bilinmeyen Kayıtlar”a düşer ve yalnızca yöneticiler görebilir.
- **Konu** satırına kaydın başlığını yazın (örneğin: “Toplantı notları”, “Yapılacak: Raporu tamamla”).
- E-posta metninde (gövde) açıklama veya detayları yazın. Bu metin kaydın açıklama alanına aktarılır.

**Adım 2 – E-postanın sisteme düşmesini bekleyin**

- E-postanız **notes@example.com** hesabına ulaştıktan sonra NotBak sistemi belirli aralıklarla gelen kutusunu kontrol eder ve yeni e-postaları alır. Bu işlem birkaç dakika sürebilir.
- E-postanız sisteme girdiğinde sağ üstteki **zil ikonunda** “E-posta Kaydı Bekliyor” bildirimi çıkabilir. Bildirime tıklayarak doğrudan ilgili sayfaya gidebilirsiniz.

**Adım 3 – Kaydı görev, not veya fikir olarak kaydedin**

- Üst menüden **Kayıtlar → Gönderilen Kayıtlar** sayfasına gidin.
- **Bekleyenler** sekmesinde gönderdiğiniz e-postayı bulun. Her kayıtta konu, metin önizlemesi ve tarih görünür.
- **Görev Yap** veya **Not Yap** butonuna tıklayın. Açılan pencerede:
  - **Başlık** ve **açıklama** e-postanızdan otomatik gelir; isterseniz düzenleyebilirsiniz.
  - **Tip** olarak **Görev**, **Not** veya **Fikir** seçin. Görevler mor, notlar sarı, fikirler mavi renkle gösterilir.
  - **Öncelik** (Acil, Yüksek, Normal, Düşük), **son tarih**, **sorumlu kişi** ve **proje** alanlarını doldurun.
- **Kaydet** ile kaydı oluşturun. Artık bu kayıt Görevler veya Notlar sayfasında ve takvimde görünür.

**Kısa özet:** **notes@example.com** adresine konu ve metinle e-posta atın → Uygulamada **Kayıtlar → Gönderilen Kayıtlar**’a gidin → **Görev Yap** veya **Not Yap** ile kaydı oluşturup tipini (Görev / Not / Fikir), önceliği, tarihi ve projeyi seçin.

### 9.2 Gönderilen Kayıtlar Sayfası

**Erişim:** Üst menüden **Kayıtlar → Gönderilen Kayıtlar**.

Bu sayfada **sizin e-posta adresinizle** **notes@example.com** adresine gönderdiğiniz ve sisteme giren tüm e-postalar listelenir.

- **Sekmeler:** Bekleyenler (henüz görev/not yapılmamış), Tümü, Görev, Not, Yoksayılan. İstediğiniz sekmeye tıklayarak listeyi filtreleyebilirsiniz.
- **Her kayıtta** e-postanın konusu, metin önizlemesi, tarihi ve durumu (Bekliyor, Görev, Not, Yoksayıldı) görünür.
- **Bekleyen** bir kayıt için:
  - **Görev Yap:** Pencere açılır; başlık ve açıklama e-postadan gelir. Tip (Görev / Not / Fikir), öncelik, son tarih, sorumlu ve proje seçip kaydedebilirsiniz.
  - **Not Yap:** Aynı pencere açılır; varsayılan olarak not tipindedir, tipi değiştirebilirsiniz.
  - **Yoksay:** Bu e-postayı görev veya not yapmak istemiyorsanız “Yoksayıldı” olarak işaretleyebilirsiniz.
- **Görev veya not yaptığınız** kayıtlarda **Kaydı Görüntüle →** linki çıkar; tıklayınca ilgili görev veya not sayfasına gidersiniz.

### 9.3 Bilinmeyen Kayıtlar (Yalnızca Yöneticiler)

**Erişim:** Üst menüden **Kayıtlar → Bilinmeyen Kayıtlar**. Bu sayfayı yalnızca **yönetici** kullanıcılar görebilir.

NotBak’te kayıtlı olmayan bir e-posta adresinden **notes@example.com** adresine gelen e-postalar burada listelenir. Yöneticiler bu kayıtları inceleyip gerekirse “Görev Yap” veya “Not Yap” ile sisteme ekleyebilir veya “Yoksay” ile işaretleyebilir. Her kayıtta gönderen e-posta adresi ayrıca gösterilir.

---

## 10. Bildirimler (Zil İkonu)

- Sağ üstteki **zil ikonuna** tıklayınca bildirim listesi açılır (yeniden eskiye sıralı).
- **Kırmızı balon:** Okunmamış bildirim ve hatırlatma sayısı gösterilir.
- Bir bildirime tıklayınca ilgili sayfaya gidilir ve bildirim okundu işaretlenir. **Tümünü okundu işaretle** ile tümü kapatılabilir.

### Bildirim Tipleri

| Bildirim Tipi | Açıklama |
|---------------|----------|
| **Görev Atama** | Bir görev size atandığında bildirim gelir. |
| **İlgili Kişi Eklenmesi** | Bir kayda ilgili kişi olarak eklendiğinizde bildirim gelir. |
| **Son Tarih Hatırlatması** | Son tarihi **30 dakika içinde** olan görevler için otomatik hatırlatma oluşur. |
| **Import Onay Talebi** | Birisi Excel'den yükleme yaparken sizin projenizde onay gerektiren bir kayıt oluşturduğunda bildirim gelir. |
| **Proje Katılım Talebi** | Birisi projenize katılmak istediğinde bildirim gelir. |
| **E-posta Kaydı Bekliyor** | E-posta adresinizden gelen bir kayıt sisteme düştüğünde bildirim gelir. |
| **Bilinmeyen E-posta Kaydı** | Tanınmayan bir e-posta adresinden kayıt geldiğinde admin kullanıcılara bildirim gönderilir. |

---

## 11. Ayarlar

**Ayarlar** menüsü, yönetici ve yetkili kullanıcıların uygulamayı yapılandırmasını sağlar. Ayarlar ana sayfasından (/dashboard/settings) ilgili bölümlere gidilir.

### 11.1 Kullanıcı Yönetimi

- **Kullanıcı listesi:** Tüm kullanıcılar tek satırda, küçük punto ile listelenir. Aktif/pasif durumu, rolleri görülür.
- **Manuel kullanıcı ekleme:** Yeni kullanıcı formu ile e-posta, ad ve şifre girerek kullanıcı oluşturabilirsiniz.
- **Active Directory'den ekle:** LDAP yapılandırması varsa, "AD'den Ekle" butonu ile Active Directory kullanıcılarını sisteme çekebilirsiniz. LDAP kullanıcıları listede **Adı – E-posta – Oturum adı (sAMAccountName)** tek satırda gösterilir.
- **Kullanıcı aktivasyonu:** Kullanıcıları aktif/pasif yapabilirsiniz. Pasif kullanıcılar giriş yapamaz.
- **Asistan ilişkisi:** Bir kullanıcıyı başka bir kullanıcının asistanı olarak tanımlayabilirsiniz.

### 11.2 Birim Yönetimi

Birimler, organizasyonel yapınızı (departman, bölüm vb.) temsil eder. Projeler birimlere bağlanabilir.

- **Birim oluşturma:** Birim adı girerek yeni birim oluşturulur.
- **Birim düzenleme:** Birim adını değiştirebilirsiniz.
- **Birim silme:** Birimi silebilirsiniz (onay penceresi çıkar).
- **Üye yönetimi:** Bir birimin "Üyeler" bölümünden:
  - Açılır listeden kullanıcı seçerek üye ekleyebilirsiniz.
  - Her üyeye **Birim Yöneticisi** veya **Ekip Üyesi** rolü atanır.
  - Üye rolünü değiştirebilir veya üyeyi birimden çıkarabilirsiniz.

### 11.3 LDAP Ayarları

LDAP/Active Directory entegrasyonu yapılandırma sayfası:

1. Sunucu bilgilerini girin:
   - **LDAP URL:** `ldap://sunucu:389` veya `ldaps://sunucu:636`
   - **Bind DN:** Admin bağlantı DN (örnek: `CN=admin,DC=example,DC=local`)
   - **Bind Parolası:** Admin parolası
   - **Search Base:** Kullanıcı arama base DN
   - **Kullanıcı Filtresi:** Active Directory için `(sAMAccountName={{username}})`
   - **Grup Filtresi** (opsiyonel): Sadece belirli gruptaki kullanıcıları senkronize etmek için
2. **Bağlantı Testi:** Girilen bilgilerle bağlantı testi yapılır; debug adımları gösterilir.
3. **Kullanıcı Önizleme:** Senkronizasyon öncesi LDAP'tan gelecek kullanıcıları önizleyebilirsiniz.
4. **Şimdi Senkronize Et:** Kullanıcıları LDAP'tan çekin.

LDAP kullanıcıları sisteme **e-posta ve parola** ile giriş yapabilir. Yeni eklenen LDAP kullanıcıları varsayılan olarak **aktif** gelir.

### 11.4 IMAP Ayarları

E-posta ile görev/not oluşturma özelliği için IMAP sunucu yapılandırma sayfası:

1. **Bağlantı bilgileri:**
   - **Sunucu (Host):** IMAP sunucu adresi (örn. `imap.şirket.com`)
   - **Port:** Genelde 993 (SSL) veya 143 (TLS)
   - **Kullanıcı Adı:** E-posta hesabı (örn. `notbak@şirket.com`)
   - **Şifre:** Hesap parolası
   - **SSL/TLS kullan:** İşaretlenirse güvenli bağlantı kullanılır
   - **Sertifika doğrulamasını atla:** Self-signed sertifikalar için
2. **Bağlantıyı Test Et:** Girilen bilgilerle bağlantı testi yapılır. Başarılı olursa debug adımları (bağlantı, kimlik doğrulama, klasör listeleme) ve sunucudaki e-posta klasörleri (mesaj/okunmamış sayılarıyla) gösterilir.
3. **İzlenecek Klasör:** Bağlantı başarılıysa açılır listeden kontrol edilecek klasörü seçin (varsayılan: INBOX).
4. **Kontrol Sıklığı:** Kaç dakikada bir yeni e-postalar kontrol edilsin (1-60 dk).
5. **Kaydet:** Ayarları kaydeder.
6. **Şimdi E-postaları Yokla:** Seçili klasördeki okunmamış e-postaları anında kontrol eder. Sonuç olarak kaç e-posta işlendiği, kaçının eşleştiği, kaçının bilinmeyen olduğu ve varsa hatalar bildirilir.

### 11.5 SMTP Ayarları

E-posta gönderimi (bildirimler, günlük özet, sorun bildirimi vb.) için SMTP sunucu yapılandırma sayfası:

1. **Sunucu bilgileri:** Host, port, kullanıcı adı, parola, güvenli bağlantı ayarları.
2. **Bağlantı Testi:** SMTP sunucusuna bağlantı testi yapılır.
3. **Test E-postası Gönder:** Yapılandırmanın çalıştığını doğrulamak için kendi adresinize test e-postası gönderebilirsiniz.

### 11.6 E-posta Bilgilendirme Ayarları

**Erişim:** Ayarlar → E-posta bilgilendirme (adres: `/dashboard/settings/email-notifications`)

Günlük e-posta özeti tercihlerinizi yönetirsiniz:

- **Günlük e-posta özeti açık/kapalı:** Özelliği açtığınızda her gün belirlediğiniz saatte size atanan görevler, bugünkü görevler ve son tamamlanan kayıtlar tek bir e-postada özetlenerek gönderilir.
- **Gönderim saati:** Açılır listeden saati seçin (06:00, 07:00, 08:00, 09:00, 10:00, 12:00, 18:00 seçenekleri). Saat **sunucu yerel saatine** göredir.
- **Saat karşılaştırması:** Sayfanın alt kısmında sunucu saati ve sizin saatiniz karşılaştırmalı olarak gösterilir. Zaman dilimi farkı varsa bilgilendirme mesajı çıkar.
- **Özeti şimdi gönder:** Günlük özeti anında e-posta adresinize gönderir (test veya manuel kullanım için).

### 11.7 Parola Değiştirme

**Erişim:** Ayarlar → Parola Değiştir veya sağ üst kullanıcı menüsünden (adres: `/dashboard/settings/password`)

Mevcut parolanızı girerek yeni parola belirleyebilirsiniz. LDAP kullanıcıları için parola değiştirme Active Directory üzerinden yapılabilir.

---

## 12. Yardım

Sağ üstteki **Yardım** menüsünden erişilen sayfalar:

| Sayfa | Açıklama |
|-------|----------|
| **Hakkında** | NotBak hakkında kısa bilgi, özellikler özeti ve sürüm bilgisi. |
| **Kullanım Kılavuzu** | Bu kılavuzun uygulama içinden erişilebilen versiyonu. |
| **SSS** | Sıkça sorulan sorular (içerik güncellenmeye devam etmektedir). |
| **Sorun Bildir** | Konu ve açıklama girerek sorun bildirimi gönderilir; e-posta admin kullanıcısına iletilir ve veritabanına kaydedilir. |

---

## 13. Kısayollar ve İpuçları

| Özellik            | Açıklama |
|--------------------|----------|
| **Alt+Enter**      | Görev detay penceresinde yorum kutusundayken yorumu gönderir. |
| **Görev listesi**  | Başlığa veya "Detay"a tıklayarak modal açılır; ayrı sayfaya gitmeden detay görüntülenir. Sütun başlıklarına tıklayarak sıralama yapılır. |
| **Takvim**         | Ana sayfada haftalık görünümde bir görev kartına **çift tıklayarak** detay penceresi açılır. Görevler tip rengine göre (Görev / Not / Fikir) gösterilir. |
| **Bana Özel**      | Yeni görev penceresinde "Bana Özel" işaretlenirse görev sadece siz ve yetkili kullanıcılar tarafından görülür. |
| **Bildirimler**    | Zil ikonundan size atanan kayıtlar, import/katılım talepleri, e-posta kayıtları ve 30 dk içindeki son tarihli görev hatırlatmaları; tıklayınca ilgili sayfaya gidilir. |
| **Proje görünürlüğü** | Sadece proje sorumlusu, proje ekip üyeleri veya proje alt ekiplerinde yer alan kullanıcılar (ve admin) o projeyi listede görür. "Herkes görsün" ayarıyla tüm kullanıcılara açılabilir. |
| **Excel import**   | Görevler ve Notlar sayfalarından şablon indirip toplu yükleme yapabilirsiniz. Uyumsuz kayıtlar için onay sistemi devreye girer. |
| **E-posta kayıtları** | Kayıtlar menüsünden gelen e-postaları görev veya nota dönüştürebilirsiniz. |
| **Günlük özet**    | Ayarlar → E-posta bilgilendirme'den günlük e-posta özetini açarak her sabah görev durumunuzu takip edebilirsiniz. |
| **Proje katılım**  | Yeni proje oluştururken aynı isimde mevcut bir proje varsa doğrudan katılım talebi gönderebilirsiniz. |

---

Bu kılavuz NotBak arayüzündeki metinlere ve mevcut özelliklere göre hazırlanmıştır. Ekranlar güncellenirse kılavuz da buna göre güncellenebilir.
