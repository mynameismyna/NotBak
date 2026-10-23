/** Uygulama sürümü (Yardım → Hakkında ve ilgili sayfalar). */
export const APP_VERSION = "V.0.9 (Beta)";

export const ABOUT_DESCRIPTION =
  "Ekiplerin görevleri, notları ve fikirleri tek bir yerde yönetmesini sağlayan, şirket içi ağda (intranet) çalışan self-hosted görev ve proje yönetim sistemi. Active Directory / LDAP entegrasyonu ile kurumsal ortamlara uyumludur. IMAP ile gelen e-postaları göreve dönüştürme, Excel toplu içe aktarma ve günlük e-posta özeti özellikleri sunar.";

export const ABOUT_FEATURES: [title: string, description: string][] = [
  [
    "Görev Yönetimi",
    "Görev, Not ve Fikir tipleri; öncelik seviyeleri; Bana Özel; iş akışı (Yeni → Devam → Beklemede → Tamamlandı)",
  ],
  [
    "Kanban Board",
    "Notlar sayfasında sürükle-bırak kolonlar ile görsel yönetim",
  ],
  [
    "Proje ve Ekip Yapısı",
    "Çoklu proje, Proje Yöneticisi / Ekip Üyesi rolleri, yetkilendirme (Delegate), katılım talepleri",
  ],
  [
    "Birim Yönetimi",
    "Organizasyon birimleri (Birim Yöneticisi, Ekip Üyesi) ve projelere bağlama",
  ],
  [
    "Bildirimler",
    "Görev atama, ilgili kişi, son tarih hatırlatması (30 dk), import onayı, proje katılımı, e-posta kaydı",
  ],
  [
    "Yorumlar ve İşbirliği",
    "Görev altı yorumlar; ilgili kişi ekleme (READ_ONLY veya FULL yetki)",
  ],
  [
    "E-posta Entegrasyonu",
    "IMAP ile otomatik e-posta okuma; Gönderilen/Bilinmeyen kayıtlar; göreve/nota dönüştürme",
  ],
  [
    "Excel İçe Aktarma",
    "Toplu görev/not aktarımı (XLSX), şablon indirme, proje üyesi olmayanlar için onay mekanizması",
  ],
  [
    "Günlük E-posta Özeti",
    "Kullanıcı bazlı aç/kapa ve gönderim saati seçimi (06:00–18:00); geciken, bugün, yarın, tamamlanan özeti",
  ],
  [
    "LDAP / Active Directory",
    "Kimlik doğrulama, kullanıcı senkronizasyonu, grup filtresi, bağlantı testi",
  ],
  [
    "Haftalık Takvim",
    "Ana sayfada haftalık özet banner ve takvim görünümü; tip rengine göre kartlar",
  ],
  [
    "Talepler",
    "Kayıtlar menüsü: İçe aktarma onayları ve proje katılım talepleri (Bana gelen / Gönderdiğim)",
  ],
  [
    "Yardım",
    "Kullanım Kılavuzu, SSS, Sorun Bildir (admin'e e-posta), Hakkında",
  ],
];

export const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "NotBak nedir?",
    answer:
      "NotBak, ekiplerin görevleri, notları ve fikirleri tek bir yerde yönetmesini sağlayan self-hosted bir görev ve proje yönetim sistemidir. Şirket içi ağda (intranet) çalışır; Active Directory / LDAP entegrasyonu ile kurumsal ortamlara uyumludur.",
  },
  {
    question: "Nasıl giriş yaparım?",
    answer:
      "Login sayfasında e-posta adresinizi ve parolanızı girin. Sistem LDAP/Active Directory kullanıyorsa, aynı e-posta ve şifre ile giriş yapabilirsiniz. İlk kurulumda admin tarafından oluşturulan kullanıcılar veya LDAP'tan senkronize edilen kullanıcılar giriş yapabilir.",
  },
  {
    question: "Şifremi unuttum, ne yapmalıyım?",
    answer:
      "Şifre sıfırlama e-posta özelliği uygulamada yoktur. LDAP kullanıcısıysanız parolanızı Active Directory üzerinden değiştirin. Yerel (manuel) kullanıcıysanız, bir yöneticiden Ayarlar → Kullanıcılar bölümünden şifrenizi sıfırlamasını isteyin veya kendi parolanızı Ayarlar → Parola Değiştir ile değiştirin (mevcut parolanızı bilmeniz gerekir).",
  },
  {
    question: '"Bana Özel" ne demek?',
    answer:
      'Görev oluştururken "Bana Özel" işaretlenirse, bu görev yalnızca siz ve yetkili kullanıcılar (proje yöneticisi, admin) tarafından görülür. Diğer ekip üyeleri listede bu görevi görmez.',
  },
  {
    question: "Görevler ile Notlar sayfası arasındaki fark nedir?",
    answer:
      "Görevler sayfası tablo (liste) görünümündedir; filtreler (Tümü, Bana Atanmış, Bu Hafta, Bekleyen, Tamamlanan) ve sütun sıralaması vardır. Notlar sayfası Kanban board görünümündedir; kartlar dört kolonda (Yeni, Devam Ediyor, Beklemede, Tamamlandı) sürükle-bırak ile yönetilir. Her iki sayfada da aynı görev/not kayıtları kullanılır; sadece görüntüleme biçimi farklıdır.",
  },
  {
    question: "Projeye nasıl katılırım?",
    answer:
      'Projeler sayfasında aynı isimde bir proje zaten varsa, proje oluşturma formunda "Evet, katılım talebi gönder" butonu çıkar. Bu butona tıklayarak proje yöneticisine katılım talebi gönderirsiniz. Proje yöneticisi Kayıtlar → Talepler sayfasından talebi onaylar veya reddeder. "Herkes görsün" açık olan projeleri listede görebilirsiniz; katılım için yine proje yöneticisi ile iletişime geçmeniz gerekebilir.',
  },
  {
    question: "Excel'den toplu görev/not nasıl yüklenir?",
    answer:
      'Görevler veya Notlar sayfasında önce "Görev şablonu indir" veya "Not şablonu indir" ile şablonu indirin. Şablonu doldurduktan sonra "Excel\'den toplu yükle" butonu ile dosyayı seçin. Sorumlu kişi proje üyesi değilse kayıtlar onay talebi olarak proje yöneticisine gider; onaydan sonra kayıtlar oluşturulur. Detay için Kullanım Kılavuzu\'ndaki Excel bölümüne bakın.',
  },
  {
    question: "Günlük e-posta özeti nasıl açılır?",
    answer:
      'Ayarlar → E-posta bilgilendirme sayfasına gidin (veya sağ üst Kullanıcı menüsünden ilgili ayarlara ulaşabilirsiniz). "Günlük e-posta özeti" seçeneğini açın ve gönderim saatini seçin (06:00–18:00 arası). Özet, size atanan görevler, bugünkü ve yarınki görevler, gecikenler ve son tamamlananlar gibi bilgileri içerir. "Özeti şimdi gönder" ile test edebilirsiniz.',
  },
  {
    question: "Gelen e-postalar nasıl göreve dönüştürülür?",
    answer:
      'IMAP yapılandırıldıktan sonra gelen e-postalar otomatik olarak Kayıtlar → Gönderilen Kayıtlar sayfasına düşer. "Bekleyenler" filtresinde her kayıt için "Görev Yap" veya "Not Yap" butonuna tıklayın; açılan formda başlık, açıklama, öncelik, son tarih, sorumlu ve proje seçip kaydedin. E-posta konusu ve gövdesi otomatik doldurulur.',
  },
  {
    question: "Bildirimler nerede görünür?",
    answer:
      "Sağ üstteki zil ikonuna tıklayın. Görev ataması, ilgili kişi eklenmesi, son tarih hatırlatması (30 dk içinde), import onay talebi, proje katılım talebi ve e-posta kaydı bildirimleri burada listelenir. Okunmamış sayı kırmızı balonda gösterilir. Bir bildirime tıklayınca ilgili sayfaya gidilir ve bildirim okundu işaretlenir.",
  },
  {
    question: "Bir projeyi neden göremiyorum?",
    answer:
      'Projeler yalnızca erişim yetkiniz varsa listelenir: proje sahibi sizsiniz, proje üyesi veya proje altındaki bir ekipte üye/yönetici iseniz. Admin tüm projeleri görür. Proje "Sadece üyeler görsün" ayarındaysa ve siz üye değilseniz proje listede çıkmaz; katılım talebi göndermeniz gerekir.',
  },
  {
    question: "LDAP kullanıcısı olarak giriş yapamıyorum.",
    answer:
      'Önce yöneticinizin LDAP Ayarları\'nı doğru yapılandırdığından ve "Şimdi Senkronize Et" ile sizi sisteme eklediğinden emin olun. Kullanıcı Yönetimi\'nde hesabınızın aktif olduğunu kontrol ettirin. Girişte kurumsal e-posta adresinizi ve Active Directory parolanızı kullanın. Sorun devam ederse LDAP bağlantı testi ve filtreleri yönetici tarafından kontrol edilmelidir.',
  },
  {
    question: "Sorun bildirmek için nereye yazmalıyım?",
    answer:
      'Yardım menüsünden "Sorun Bildir" sayfasına gidin. Konu ve açıklama alanlarını doldurup gönderin. Bildiriminiz admin kullanıcısına e-posta ile iletilir ve veritabanına kaydedilir. Acil durumlarda doğrudan yöneticiniz veya IT destek birimi ile iletişime geçebilirsiniz.',
  },
];
