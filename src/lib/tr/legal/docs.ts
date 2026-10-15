/**
 * Turkish consumer-facing legal documents for white-label boutiques.
 * Runtime text is filled from boutique context (see getTrLegalDoc).
 * Placeholder / clone templates: docs/tr-boutique-legal-templates.md
 * Not legal advice — have a lawyer review per boutique before relying on them.
 */

export const TR_LEGAL_DOC_IDS = [
  "kvkk",
  "gizlilik",
  "cerez",
  "mesafeli-satis",
  "on-bilgilendirme",
  "iade",
  "uyelik",
  "kunye",
] as const;

export type TrLegalDocId = (typeof TR_LEGAL_DOC_IDS)[number];

export function isTrLegalDocId(value: string): value is TrLegalDocId {
  return (TR_LEGAL_DOC_IDS as readonly string[]).includes(value);
}

export type TrLegalBoutiqueContext = {
  name: string;
  legalName: string | null;
  slug: string;
  physicalAddress: string | null;
  whatsappPhone: string | null;
  email: string;
  exchangePolicy: string | null;
  shippingNote: string | null;
  customDomain: string | null;
  /** Published on künye (normal for TR e-commerce). */
  vergiNo: string | null;
  /** Tax office, printed next to the tax id when set. */
  vergiDairesi: string | null;
  /** Optional; leave null until boutique has KEP. */
  kepAddress: string | null;
  /** Optional; şahıs often N/A. */
  mersisNo: string | null;
  /** Names of the ad / analytics tools the store loads (cookie policy); empty = none. */
  trackingTools: string[];
  /** Boutique may send marketing SMS/email (İYS / açık rıza). */
  marketingEnabled: boolean;
};

export type TrLegalDoc = {
  id: TrLegalDocId;
  title: string;
  summary: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
};

function sellerLabel(ctx: TrLegalBoutiqueContext): string {
  return ctx.legalName?.trim() || ctx.name;
}

function brandLabel(ctx: TrLegalBoutiqueContext): string {
  return ctx.name.trim() || sellerLabel(ctx);
}

/** City for non-consumer dispute venue (e.g. Merkezefendi/Denizli → Denizli). */
function disputeVenue(physicalAddress: string | null): string {
  const raw = physicalAddress?.trim() ?? "";
  if (!raw || /güncellenecek/i.test(raw)) {
    return "satıcının yerleşim yerinin bulunduğu";
  }
  const slashParts = raw
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  const last = slashParts[slashParts.length - 1];
  if (last && last.length >= 3) return last;
  return "satıcının yerleşim yerinin bulunduğu";
}

export function getTrLegalDoc(
  docId: TrLegalDocId,
  ctx: TrLegalBoutiqueContext,
): TrLegalDoc {
  const seller = sellerLabel(ctx);
  const brand = brandLabel(ctx);
  const address =
    ctx.physicalAddress?.trim() ||
    "Adres, satıcı tarafından güncellenecektir.";
  const contact = [
    ctx.whatsappPhone ? `Telefon / WhatsApp: ${ctx.whatsappPhone}` : null,
    `E-posta: ${ctx.email}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const domain =
    ctx.customDomain?.trim().replace(/^www\./, "") ||
    `${ctx.slug}.cortisstyle.com`;
  const siteUrl = `https://${domain}`;
  const vergiLine = ctx.vergiNo?.trim()
    ? ctx.vergiDairesi?.trim()
      ? `Vergi dairesi / vergi kimlik no: ${ctx.vergiDairesi.trim()} / ${ctx.vergiNo.trim()}`
      : `Vergi kimlik no: ${ctx.vergiNo.trim()}`
    : "Vergi kimlik no: satıcı kayıtlarında güncellenecektir.";
  const kepLine = ctx.kepAddress?.trim()
    ? `KEP: ${ctx.kepAddress.trim()}`
    : "KEP adresi: henüz tanımlanmadı (ETBİS / tebligat için satıcı tarafından tamamlanacaktır).";
  const mersisLine = ctx.mersisNo?.trim()
    ? `MERSİS: ${ctx.mersisNo.trim()}`
    : "MERSİS: şahıs işletmelerinde uygulanmayabilir; varsa satıcı tarafından eklenecektir.";
  const shipping =
    ctx.shippingNote?.trim() ||
    "Siparişler, anlaşmalı kargo firması tarafından satıcının adresinden alınır ve Alıcı’nın bildirdiği adrese teslim edilir. Tahmini teslimat süresi sipariş / kargo bilgilendirmesinde paylaşılır; her hâlükârda yasal azami süreler saklıdır.";
  const returns =
    ctx.exchangePolicy?.trim() ||
    "Mesafeli satışlarda cayma hakkı, yasal istisnalar saklı kalmak kaydıyla, malın tesliminden itibaren 14 gün içinde kullanılabilir. Cayma kapsamında iade kargo ücreti satıcıya aittir (mevzuat çerçevesinde).";

  const docs: Record<TrLegalDocId, TrLegalDoc> = {
    kvkk: {
      id: "kvkk",
      title: "KVKK Aydınlatma Metni",
      summary:
        "6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) m.10 kapsamında veri sorumlusu bilgilendirmesi.",
      sections: [
        {
          heading: "Veri sorumlusu",
          paragraphs: [
            `Veri sorumlusu: ${seller} (marka: ${brand}).`,
            address,
            contact,
            vergiLine,
            `İnternet sitesi: ${siteUrl}`,
          ],
        },
        {
          heading: "İşlenen kişisel veriler",
          paragraphs: [
            "Kimlik ve iletişim: ad soyad, e-posta, telefon.",
            "Teslimat / fatura: adres bilgileri; kurumsal fatura talebinde unvan, VKN, vergi dairesi.",
            "İşlem güvenliği: oturum, cihaz / log kayıtları, çerez kimlikleri (zorunlu çerezler).",
            "Sipariş ve ödeme: sipariş içeriği, tutar, ödeme durumu; kart verileri ödeme kuruluşu nezdinde işlenir (satıcı kart CVV saklamaz).",
            "Müşteri hizmetleri: WhatsApp / e-posta yazışma içeriği.",
          ],
        },
        {
          heading: "Amaçlar ve hukuki sebepler",
          paragraphs: [
            "Sözleşmenin kurulması ve ifası (sipariş, teslimat, iade, üyelik).",
            "Yasal yükümlülükler (vergi, tüketici, e-ticaret kayıtları).",
            "Meşru menfaat: dolandırıcılık önleme, site güvenliği, hizmet iyileştirme (temel hak ve özgürlüklere zarar vermemek kaydıyla).",
            ctx.marketingEnabled
              ? "Ticari elektronik ileti (SMS / e-posta / bildirim): yalnızca açık rızanız ve İYS kuralları çerçevesinde; aydınlatma metni ile açık rıza aynı onay kutusunda birleştirilmez."
              : "Pazarlama iletileri gönderilmeyecekse bu amaç için veri işlenmez; ileride başlanırsa ayrı açık rıza alınır.",
          ],
        },
        {
          heading: "Aktarım",
          paragraphs: [
            "Veriler; barındırma / altyapı, ödeme kuruluşu, kargo / lojistik, e-posta ve bildirim sağlayıcıları ile yalnızca hizmetin ifası için ve gerekli ölçüde paylaşılabilir.",
            "Yasal zorunluluk halinde yetkili kamu kurum ve kuruluşlarına aktarılabilir.",
            "Yurt dışı aktarım söz konusu olursa KVKK’daki şartlara uygun hareket edilir.",
          ],
        },
        {
          heading: "Saklama",
          paragraphs: [
            "Veriler, işleme amacının gerektirdiği süre ve ilgili mevzuattaki zamanaşımı / saklama süreleri boyunca tutulur; süre sonunda silinir, yok edilir veya anonim hale getirilir.",
          ],
        },
        {
          heading: "Haklarınız (KVKK m.11)",
          paragraphs: [
            "Kişisel verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silme / yok etme, itiraz ve zarar halinde tazminat talep etme haklarınız vardır.",
            `Başvurularınızı ${ctx.email} veya yukarıdaki iletişim kanallarından iletebilirsiniz. Başvurular yasal süreler içinde yanıtlanır.`,
          ],
        },
      ],
    },
    gizlilik: {
      id: "gizlilik",
      title: `${brand} Gizlilik Politikası`,
      summary:
        "Kişisel verilerin 6698 sayılı KVKK ile uyumlu işlenmesi ve bilgilendirme (e-ticaret).",
      sections: [
        {
          heading: "Giriş",
          paragraphs: [
            `${seller} (marka: ${brand}) olarak, kullanıcılarımızın hizmetlerimizden güvenli ve eksiksiz bir biçimde faydalanmalarını sağlamak amacıyla, platformumuzu kullanan tüm ilgili kişilerin gizliliğini korumak için azami özen göstermekteyiz.`,
            `Bu doğrultuda, işbu ${brand} Gizlilik Politikası (“Politika”), kullanıcılarımızın kişisel verilerinin 6698 sayılı Kişisel Verilerin Korunması Kanunu (“Kanun”) ile tamamen uyumlu bir şekilde işlenmesi ve bu süreç hakkında bilgilendirilmesi amacıyla hazırlanmıştır.`,
            `İşbu Politika’nın ayrılmaz bir parçasını oluşturan ${siteUrl} Çerez Politikası da ilgili bilgilendirmeleri içermektedir.`,
            `Veri sorumlusu: ${seller}. ${address}. ${contact}. ${vergiLine}.`,
          ],
        },
        {
          heading: "Politikanın amacı ve kapsamı",
          paragraphs: [
            `İşbu Politika’nın temel amacı, ${seller} tarafından işletilmekte olan ${siteUrl} internet sitesi ile varsa mobil uygulamasının (hepsi birlikte “Platform” olarak anılacaktır) faaliyetleri sırasında, Platform üyeleri / ziyaretçileri / kullanıcıları (hepsi birlikte “Veri Sahibi” olarak anılacaktır) tarafından ${seller} ile paylaşılan veya ${seller}’nın, Veri Sahibi’nin Platform’u kullanımı sırasında otomatik ya da otomatik olmayan yollarla ürettiği kişisel verilerin kullanımına ilişkin genel koşul ve şartları belirlemektir.`,
          ],
        },
        {
          heading: "İşlenen kişisel veri kategorileri",
          paragraphs: [
            `Aşağıda ${seller} tarafından işlenen ve Kanun uyarınca kişisel veri sayılan veri kategorileri sıralanmıştır. Aksi açıkça belirtilmedikçe, işbu Politika kapsamında kullanılan “kişisel veri” ifadesi, aşağıda belirtilen bilgi türlerini kapsayacaktır:`,
            "Kimlik bilgisi: ad, soyad, T.C. kimlik numarası vb. (sipariş / fatura için gerekli olduğunda).",
            "İletişim bilgisi: e-posta adresi, telefon numarası, adres vb.",
            "Kullanıcı bilgisi: kullanıcı adı / e-posta, şifre (hash’lenmiş), üyelik bilgileri vb.",
            "Kullanıcı işlem bilgisi: Platform kullanım geçmişi, sipariş bilgileri, etkileşim kayıtları vb.",
            "İşlem güvenliği bilgisi: IP adresi, log kayıtları, cihaz bilgisi, çerez kimlikleri vb.",
            "Finansal bilgi: ödeme durumu ve işlem referansları; kart verileri yetkili ödeme kuruluşu (ör. iyzico) nezdinde işlenir, satıcı kart CVV saklamaz.",
            "Pazarlama bilgisi: çerez kayıtları, alışveriş geçmişi, ilgi alanları vb. (yalnızca ilgili hukuki sebepler / açık rıza kapsamında).",
            "Talep / şikayet yönetimi bilgisi: iletişim formları, WhatsApp / e-posta yazışmaları, şikayet kayıtları vb.",
            "Kanun’un 3. ve 7. maddeleri uyarınca, geri döndürülemeyecek şekilde anonim hale getirilen veriler kişisel veri olarak kabul edilmez; istatistiksel analiz ve raporlamalar için kullanılabilir.",
          ],
        },
        {
          heading: "Kişisel veri işleme amaçları",
          paragraphs: [
            `${seller}, Veri Sahibi tarafından sağlanan kişisel verileri aşağıdaki amaçlar doğrultusunda işleyebilir:`,
            "Üyelik kaydının ve hesabının oluşturulması, ilgili kayıtların tutulması.",
            "Veri Sahibi’nin Platform üzerinden sunulan hizmetlerden eksiksiz faydalandırılması (sipariş, teslimat, iade, fatura).",
            "Sistem hatalarının tespiti, performans takibi ve Platform’un işleyişinin iyileştirilmesi.",
            "Bakım, destek ve yedekleme hizmetlerinin sunulması.",
            "Sunulan ürün ve hizmetlerden ilgili kişileri faydalandırmak için gerekli çalışmaların yapılması ve ilgili iş süreçlerinin yürütülmesi.",
            "Ürün ve hizmetlerin ilgili kişilerin beğeni, kullanım alışkanlıkları ve ihtiyaçlarına göre özelleştirilerek önerilmesi ve tanıtılması için gerekli aktivitelerin planlanması ve icrası (ilgili hukuki sebepler / açık rıza saklı).",
            "Ticari faaliyetlerin gerçekleştirilmesi için gerekli çalışmaların yapılması ve buna bağlı iş süreçlerinin yürütülmesi.",
            `${seller} ve iş ilişkisi içerisinde bulunduğu kişilerin hukuki, teknik ve ticari-iş güvenliğinin temini.`,
            "Ticari ve/veya iş stratejilerinin planlanması ve icrası.",
          ],
        },
        {
          heading: "Açık rıza doğrultusunda işlenebilecek veriler",
          paragraphs: [
            ctx.marketingEnabled
              ? `Veri Sahibi’nin açık rızası kapsamında, ${seller}; Platform üzerindeki hareketleri takip ederek kullanıcı deneyiminin artırılması, istatistik oluşturulması, profilleme, doğrudan pazarlama ve yeniden pazarlama, Veri Sahibi’ne özel promosyon önerilerinin oluşturulması ve iletilmesi amaçlarıyla veri işleyebilir. Aydınlatma metni ile açık rıza ayrı süreçler olarak sunulur.`
              : `Pazarlama / profilleme amaçlı işleme yapılacaksa, ${seller} ilgili mevzuat uyarınca ayrı açık rıza alır; aksi halde bu amaçlarla veri işlenmez.`,
          ],
        },
        {
          heading: "Kişisel verilerin aktarımı",
          paragraphs: [
            `${seller}, Veri Sahibi’ne ait kişisel verileri, işbu Politika ile belirlenen amaçların gerçekleştirilebilmesi için hizmetlerinden faydalandığı üçüncü kişilere, söz konusu hizmetlerin temini amacıyla sınırlı olmak üzere aktarabilir.`,
            "Bu aktarımlar; deneyimin geliştirilmesi, güvenliğin sağlanması, hileli / izinsiz kullanımların tespiti, operasyonel değerlendirme, Platform hatalarının giderilmesi ve Politika’daki amaçlardan herhangi birinin gerçekleştirilmesi için yapılabilir.",
            "Bu kapsamda barındırma (hosting), ödeme kuruluşu, kargo / lojistik, e-posta / SMS / bildirim sağlayıcıları, hukuk büroları ve benzeri tedarikçilerle paylaşım söz konusu olabilir.",
            "Kişisel veriler, Kanun’un 8. ve 9. maddelerindeki şartlar çerçevesinde yetkili kamu kurumları, kanunen yetkili özel kurumlar ve gerekli ölçüde iş ortakları / tedarikçiler ile paylaşılabilecektir. Yurt dışı aktarım söz konusu olursa Kanun m.9 ve Kurul kararlarına uygun hareket edilir.",
          ],
        },
        {
          heading: "Toplanma yöntemi ve hukuki sebep",
          paragraphs: [
            "Kişisel veriler, Platform üzerinden elektronik ortamda (üyelik, sipariş, iletişim kanalları, çerezler ve otomatik log kayıtları dahil) toplanmaktadır.",
            "Toplanan kişisel veriler, 6698 sayılı Kanun’un 5. ve 6. maddelerinde ve bu Politika’da belirtilen amaçlarla işlenebilmekte ve aktarılabilmektedir.",
          ],
        },
        {
          heading: "Kişisel veri sahibinin hakları (Kanun m.11)",
          paragraphs: [
            `Kanun’un 11. maddesi uyarınca veri sahipleri, ${seller}’ya başvurarak şu haklara sahiptir:`,
            "Kişisel veri işlenip işlenmediğini öğrenme; işlenmişse buna ilişkin bilgi talep etme.",
            "İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme.",
            "Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme.",
            "Eksik veya yanlış işlenmiş olması hâlinde düzeltilmesini isteme ve bunun aktarıldığı üçüncü kişilere bildirilmesini isteme.",
            "İşlenmesini gerektiren sebeplerin ortadan kalkması hâlinde silinmesini veya yok edilmesini isteme ve bunun aktarıldığı üçüncü kişilere bildirilmesini isteme.",
            "Münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhine bir sonucun ortaya çıkmasına itiraz etme.",
            "Kanuna aykırı işleme sebebiyle zarara uğraması hâlinde zararın giderilmesini talep etme.",
            `Taleplerinizi ${ctx.email} adresine iletebilirsiniz. ${seller}, talepleri en geç otuz (30) gün içinde sonuçlandırır; Kişisel Verileri Koruma Kurulu ücret tarifesi saklıdır.`,
            "Ayrıntılı aydınlatma için Sitedeki KVKK Aydınlatma Metni’ne bakınız.",
          ],
        },
      ],
    },
    cerez: {
      id: "cerez",
      title: `${brand} Çerez Politikası`,
      summary:
        "Platformda kullanılan çerezler, amaçları ve tercihlerinizi nasıl yönetebileceğiniz.",
      sections: [
        {
          heading: "Giriş",
          paragraphs: [
            `${seller} (marka: ${brand}) olarak, kullanıcılarımızın hizmetlerimizden güvenli ve eksiksiz şekilde faydalanmalarını sağlamak amacıyla sitemizi kullanan kişilerin gizliliğini korumak için çalışmaktayız.`,
            `Çoğu web sitesinde olduğu gibi, ${siteUrl} (“Site”) ile varsa mobil uygulamanın (hepsi birlikte “Platform”) ziyaretçilere kişisel içerik ve reklamlar göstermek, site içinde analitik faaliyetler gerçekleştirmek ve ziyaretçi kullanım alışkanlıklarını takip etmek amacıyla çerezler kullanılabilir.`,
            `İşbu Çerez Politikası, ${brand} Gizlilik Politikası’nın ayrılmaz bir parçasıdır. Kişisel verilerin işlenmesine ilişkin daha detaylı bilgi için Gizlilik Politikası ve KVKK Aydınlatma Metni’ni incelemenizi tavsiye ederiz.`,
          ],
        },
        {
          heading: "Çerez (“cookie”) nedir?",
          paragraphs: [
            "Çerezler, ziyaret ettiğiniz internet siteleri tarafından tarayıcılar aracılığıyla cihazınıza veya ağ sunucusuna depolanan küçük metin dosyalarıdır. Çerezler, ziyaret ettiğiniz web sitesiyle ilişkili sunucular tarafından oluşturulur; böylelikle aynı siteyi tekrar ziyaret ettiğinizde sunucu bunu anlayabilir.",
            "Çerezler, ziyaretçilere ilişkin isim, cinsiyet veya adres gibi doğrudan kişisel verileri içermez. Daha fazla bilgi için www.aboutcookies.org ve www.allaboutcookies.org adreslerini ziyaret edebilirsiniz.",
          ],
        },
        {
          heading: "Hangi çerezler kullanılmaktadır?",
          paragraphs: [
            "Çerezler; sahipleri, kullanım ömürleri ve kullanım amaçları açısından kategorize edilebilir.",
            `Çerezi yerleştiren tarafa göre: Platform çerezleri (birinci taraf — ${seller} tarafından oluşturulur / yönetilir) ve üçüncü taraf çerezleri (iş birliği yapılan firmalar; örn. analitik, reklam, ödeme).`,
            "Aktif olduğu süreye göre: oturum çerezleri (Platform terk edilince silinir) ve kalıcı çerezler (kullanım alanına bağlı olarak çeşitli sürelerle cihazlarda kalabilir).",
            "Teknik çerezler: Platform’un temel fonksiyonları için gereklidir (örn. sepet, oturum).",
            "Doğrulama çerezleri: kimlik doğrulama ve yetkilendirme süreçleri için kullanılır.",
            "Hedefleme / reklam çerezleri: ilgi alanlarıyla bağlantılı reklam gösterilmesi amacıyla kullanılabilir (rıza gerektirenler için).",
            "Kişiselleştirme çerezleri: dil, bölge gibi tercihleri hatırlamak için kullanılabilir.",
            "Analitik çerezler: Platform’u analiz etmek, performansını artırmak ve geliştirmek amacıyla kullanılabilir.",
            ...(ctx.trackingTools.length > 0
              ? [
                  `Bu Site’de ${ctx.trackingTools.join(", ")} kullanılmaktadır. Bu araçların çerezleri yalnızca çerez uyarısında “Tümünü kabul et” seçeneğini onaylamanız hâlinde yüklenir; “Yalnızca zorunlu” seçeneğinde yüklenmez.`,
                ]
              : []),
          ],
        },
        {
          heading: "Neden çerezler kullanılmaktadır?",
          paragraphs: [
            "Platform’un temel fonksiyonlarını gerçekleştirmek (sepet, giriş, güvenlik).",
            "Platform analizi ve performans iyileştirmesi.",
            "İşlevselliği artırmak ve kullanım kolaylığı sağlamak.",
            "Kişiselleştirme, hedefleme ve reklamcılık faaliyeti gerçekleştirmek (ilgili çerezler için rıza süreçleri saklıdır).",
          ],
        },
        {
          heading: "Çerez tercihlerinizi nasıl yönetebilirsiniz?",
          paragraphs: [
            `${seller}, kullanıcıların kendilerine ait kişisel veriler üzerindeki tercihlerini kullanabilmelerini önemser. Bununla birlikte, Site’nin çalışması için zorunlu olan bazı çerezler konusunda tercih yönetimi mümkün olmayabilir. Bazı çerezlerin kapatılması halinde Site’nin çeşitli fonksiyonları (sepet, giriş vb.) çalışmayabilir.`,
            "Tarayıcı ayarlarından çerezleri engelleyebilir, silme veya uyarı alma tercihlerini kişiselleştirebilirsiniz. Genel açıklama: https://www.aboutcookies.org/",
            "Çerez tercihlerine ilişkin ayarlar, Platform’a erişim sağladığınız her cihaz / tarayıcı için ayrı ayrı yapılmalıdır.",
            "Google Analytics çerezlerini (kullanılıyorsa) kapatmak için: https://tools.google.com/dlpage/gaoptout",
            "Google kişiselleştirilmiş reklam deneyimi: https://adssettings.google.com/",
            "Birçok firmanın reklam çerezleri için tercihler: https://www.youronlinechoices.com/tr/",
            "Mobil cihazlarda çerez / izleme tercihleri cihaz ayarları menüsünden yönetilebilir.",
          ],
        },
        {
          heading: "Rıza ve politikadaki değişiklikler",
          paragraphs: [
            `${seller}, bu Politika ile çerez kullanımının kapsamı ve amaçları hakkında bilgilendirme sunmayı hedefler. Platform’da yer alan çerez bilgilendirme uyarısının kapatılması ve Site’nin kullanılmaya devam edilmesi hâlinde, zorunlu olmayan çerezler bakımından sunulan rıza mekanizmaları saklı kalmak kaydıyla, bilgilendirme yapılmış sayılır.`,
            "Kullanıcıların çerez tercihlerini değiştirme imkânı her zaman saklıdır.",
            `${seller}, Politika hükümlerini dilediği zaman değiştirebilir. Güncel Politika, Platform’da yayınlandığı tarihte yürürlük kazanır.`,
            `Sorularınız için: ${ctx.email}.`,
          ],
        },
      ],
    },
    "mesafeli-satis": {
      id: "mesafeli-satis",
      title: "Mesafeli Satış Sözleşmesi",
      summary:
        "6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği çerçevesinde tarafların hak ve yükümlülükleri.",
      sections: [
        {
          heading: "1. Taraflar",
          paragraphs: [
            "İşbu Sözleşme, aşağıdaki taraflar arasında belirtilen hüküm ve şartlar çerçevesinde kurulmuştur.",
            "ALICI: Sipariş / ödeme formunda belirtilen ad-soyad ve adres bilgilerine sahip kişi.",
            `SATICI: ${seller} (marka: ${brand}). Adres: ${address}.`,
            "İşbu sözleşmeyi kabul etmekle ALICI, sözleşme konusu siparişi onayladığı takdirde sipariş konusu bedeli ve varsa kargo ücreti, vergi gibi belirtilen ek ücretleri ödeme yükümlülüğü altına gireceğini ve bu konuda bilgilendirildiğini peşinen kabul eder.",
          ],
        },
        {
          heading: "2. Tanımlar",
          paragraphs: [
            "İşbu sözleşmenin uygulanmasında ve yorumlanmasında aşağıda yazılı terimler karşılarında belirtilen anlamları ifade eder.",
            "BAKAN: Ticaret Bakanı’nı; BAKANLIK: Ticaret Bakanlığı’nı; KANUN: 6502 sayılı Tüketicinin Korunması Hakkında Kanun’u; YÖNETMELİK: Mesafeli Sözleşmeler Yönetmeliği’ni.",
            "HİZMET: Bir ücret veya menfaat karşılığında yapılan ya da yapılması taahhüt edilen mal sağlama dışındaki her türlü tüketici işlemini.",
            "SATICI: Ticari veya mesleki faaliyetleri kapsamında tüketiciye mal sunan veya mal sunan adına ya da hesabına hareket eden gerçek veya tüzel kişiyi.",
            "ALICI: Bir mal veya hizmeti ticari veya mesleki olmayan amaçlarla edinen, kullanan veya yararlanan gerçek ya da tüzel kişiyi.",
            `SİTE: SATICI’ya ait internet sitesini (${siteUrl}).`,
            "SİPARİŞ VEREN: Bir mal veya hizmeti SATICI’ya ait internet sitesi üzerinden talep eden gerçek ya da tüzel kişiyi.",
            "TARAFLAR: SATICI ve ALICI’yı; SÖZLEŞME: SATICI ve ALICI arasında kurulan işbu sözleşmeyi.",
            "MAL: Alışverişe konu taşınır eşyayı ve elektronik ortamda kullanılmak üzere hazırlanan yazılım, ses, görüntü ve benzeri gayri maddi malları ifade eder.",
          ],
        },
        {
          heading: "3. Konu",
          paragraphs: [
            "İşbu Sözleşme, ALICI’nın SATICI’ya ait internet sitesi üzerinden elektronik ortamda siparişini verdiği, nitelikleri ve satış fiyatı belirtilen ürünün satışı ve teslimiyle ilgili olarak 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerini düzenler.",
            "Listelenen ve sitede ilan edilen fiyatlar satış fiyatıdır. İlan edilen fiyatlar ve vaatler güncellenene veya değiştirilene kadar geçerlidir. Süreli olarak ilan edilen fiyatlar ise belirtilen süre sonuna kadar geçerlidir.",
          ],
        },
        {
          heading: "4. Satıcı bilgileri",
          paragraphs: [
            `Unvanı / ad-soyad: ${seller}`,
            `Marka: ${brand}`,
            `Adres: ${address}`,
            ctx.whatsappPhone?.trim()
              ? `Telefon / WhatsApp: ${ctx.whatsappPhone.trim()}`
              : "Telefon: satıcı iletişim bilgilerinde güncellenir.",
            "Faks: Yok",
            `E-posta: ${ctx.email}`,
            vergiLine,
            `İnternet sitesi: ${siteUrl}`,
          ],
        },
        {
          heading: "5. Alıcı bilgileri",
          paragraphs: [
            "Teslim edilecek kişi, teslimat adresi, telefon ve e-posta: Sipariş / ödeme formunda ALICI tarafından beyan edilen bilgilerdir.",
            "Bu bilgiler sipariş özeti ve sipariş onayında kalıcı veri saklayıcısı ile ALICI’ya iletilir.",
          ],
        },
        {
          heading: "6. Sipariş veren kişi bilgileri",
          paragraphs: [
            "Ad / soyad / unvan, adres, telefon ve e-posta / kullanıcı adı: Sipariş veren ile ALICI aynı kişi ise sipariş formundaki bilgiler; farklıysa formda ayrıca belirtilen sipariş veren bilgileridir.",
          ],
        },
        {
          heading: "7. Sözleşme konusu ürün / ürünler bilgileri",
          paragraphs: [
            "7.1. Temel özellikler: Malın, ürünün veya ürünlerin temel özellikleri; türü, miktarı, marka / modeli, rengi, bedeni ve adediyle birlikte SATICI’ya ait internet sitesinde ve sipariş özetinde yayımlanır. Kampanya düzenlenmişse ilgili ürünün temel özellikleri kampanya süresince incelenebilir.",
            "7.2. Fiyatlar: Listelenen ve sitede ilan edilen fiyatlar satış fiyatıdır. İlan edilen fiyatlar ve vaatler güncellenene veya değiştirilene kadar geçerlidir. Süreli olarak ilan edilen fiyatlar belirtilen süre sonuna kadar geçerlidir.",
            "7.3. Vergiler ve ödemeler: Sözleşme konusu mal veya hizmetin tüm vergiler dâhil satış fiyatı, adet, birim fiyat, ara toplam, varsa kargo tutarı ve genel toplam sipariş / ödeme ekranında ve sipariş onayında gösterilir.",
          ],
        },
        {
          heading: "8. Fatura bilgileri",
          paragraphs: [
            "Ad / soyad / unvan, adres, telefon, e-posta ve varsa vergi kimlik bilgileri: Sipariş formunda seçilen fatura tipine (bireysel / kurumsal) göre ALICI tarafından beyan edilen bilgilerdir.",
            "Fatura teslimi: Fatura, sipariş teslimatı sırasında veya elektronik ortamda (e-fatura / e-arşiv veya offline fatura kaydı) fatura bilgilerine uygun şekilde düzenlenir ve ALICI’ya iletilir.",
          ],
        },
        {
          heading: "9. Genel hükümler",
          paragraphs: [
            "9.1. Bilgilendirme ve kabul: ALICI, SATICI’ya ait internet sitesinde sözleşme konusu ürünün temel nitelikleri, satış fiyatı ve ödeme şekliyle teslimata ilişkin ön bilgileri okuyup bilgi sahibi olduğunu ve elektronik ortamda gerekli teyidi verdiğini kabul, beyan ve taahhüt eder.",
            `9.2. Teslim süresi: Sözleşme konusu her bir ürün, 30 günlük yasal süreyi aşmamak kaydıyla ALICI’nın yerleşim yeri uzaklığına bağlı olarak ön bilgilendirme ve sipariş sürecinde belirtilen süre içinde teslim edilir. ${shipping}`,
            "ALICI; ön bilgilendirme formunu ve bu sözleşmeyi elektronik ortamda onaylayarak siparişi tamamladığında sözleşme kurulmuş sayılır. Sipariş özeti kalıcı veri saklayıcısı ile (e-posta vb.) ALICI’ya iletilir.",
            "Ödeme, sitede sunulan yöntemlerle (kart / havale / diğer açıklanan yöntemler) yapılır. Kart ile ödeme açıldığında işlem yetkili ödeme kuruluşu (ör. iyzico) üzerinden gerçekleşir.",
          ],
        },
        {
          heading: "10. Cayma hakkı",
          paragraphs: [
            "ALICI, mesafeli sözleşmenin mal satışına ilişkin olması durumunda, ürünün kendisine veya gösterdiği adresteki kişi ya da kuruluşa teslim tarihinden itibaren 14 gün içinde SATICI’ya bildirmek şartıyla, hiçbir gerekçe göstermeksizin malı reddederek sözleşmeden cayma hakkını kullanabilir.",
            returns,
            `Cayma bildirimi e-posta (${ctx.email}), WhatsApp veya yazılı / kalıcı veri saklayıcısı ile yapılabilir. Ayrıntılar için Teslimat ve İade Şartları sayfasına bakınız.`,
          ],
        },
        {
          heading: "11. Cayma hakkı kullanılamayacak ürünler",
          paragraphs: [
            "ALICI’nın isteği veya açıkça kişisel ihtiyaçları doğrultusunda hazırlanan, iade edilmesi sağlık ve hijyen açısından uygun olmayan ve tesliminden sonra ambalaj, bant, mühür veya paket gibi koruyucu unsurları açılmış olan ürünler ile yürürlükteki mevzuatta belirtilen diğer mal ve hizmetlerde cayma hakkı kullanılamayabilir.",
            "Cayma hakkının istisnaları Mesafeli Sözleşmeler Yönetmeliği’nde yer alan hallerde uygulanır.",
          ],
        },
        {
          heading: "12. Temerrüt hâli ve hukukî sonuçları",
          paragraphs: [
            "ALICI, ödeme işlemlerini kredi kartıyla yaptığı durumda temerrüde düştüğü takdirde, kart sahibi banka ile arasındaki kredi kartı sözleşmesi çerçevesinde faiz ödeyeceğini ve bankaya karşı sorumlu olacağını kabul, beyan ve taahhüt eder.",
          ],
        },
        {
          heading: "13. Yetkili merciler",
          paragraphs: [
            "İşbu sözleşmeden doğan tüketici uyuşmazlıklarında, yürürlükteki mevzuat uyarınca yetkili tüketici hakem heyetlerine veya tüketici mahkemelerine başvurulabilir.",
            `Emredici bir yetki kuralının bulunmadığı diğer uyuşmazlıklarda ${disputeVenue(ctx.physicalAddress)} Mahkemeleri ve İcra Daireleri yetkilidir.`,
            `Şikayet ve talepler: ${contact}.`,
          ],
        },
        {
          heading: "14. Yürürlük",
          paragraphs: [
            "ALICI, Site üzerinden verdiği siparişe ait ödemeyi gerçekleştirdiğinde (veya ödeme adımında bu sözleşmeyi elektronik ortamda onaylayıp siparişi tamamladığında) işbu sözleşmenin tüm şartlarını kabul etmiş sayılır.",
            "SATICI, onaylanmış sözleşme / sipariş kayıtlarını mevzuattaki süreler boyunca saklar.",
          ],
        },
      ],
    },
    "on-bilgilendirme": {
      id: "on-bilgilendirme",
      title: "Ön Bilgilendirme Formu",
      summary:
        "Mesafeli Sözleşmeler Yönetmeliği m.5 kapsamında sipariş öncesi bilgilendirme.",
      sections: [
        {
          heading: "Satıcı bilgileri",
          paragraphs: [
            `${seller} (marka: ${brand})`,
            address,
            contact,
            vergiLine,
            siteUrl,
          ],
        },
        {
          heading: "Malın temel nitelikleri ve fiyat",
          paragraphs: [
            "Ürünün temel özellikleri ürün sayfasında ve sipariş özetinde gösterilir.",
            "Satış fiyatı vergiler dahil olarak TL cinsinden belirtilir; varsa kargo bedeli sipariş / ödeme ekranında ayrıca gösterilir.",
          ],
        },
        {
          heading: "Ödeme ve teslimat",
          paragraphs: [
            "Ödeme yöntemleri ödeme adımında listelenir.",
            shipping,
          ],
        },
        {
          heading: "Cayma, iade ve şikayet",
          paragraphs: [
            returns,
            "İade süreci ve istisnalar için Tüketici Hakları – Cayma – İptal İade Koşulları sayfasına bakınız.",
            "Şikayetleriniz için satıcı iletişim kanallarını kullanabilirsiniz. Tüketici Hakem Heyetleri / Tüketici Mahkemeleri başvuru mercileridir.",
          ],
        },
        {
          heading: "Onay",
          paragraphs: [
            "Siparişi tamamlamadan önce bu ön bilgilendirmeyi ve mesafeli satış sözleşmesini okuyup onaylamanız gerekir. Onay verilmeden sipariş alınmaz.",
          ],
        },
      ],
    },
    iade: {
      id: "iade",
      title: "Tüketici Hakları – Cayma – İptal İade Koşulları",
      summary:
        "Teslimat, cayma, iptal ve iade koşulları; 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği çerçevesinde.",
      sections: [
        {
          heading: "Genel",
          paragraphs: [
            "Kullanmakta olduğunuz web sitesi üzerinden elektronik ortamda sipariş verdiğiniz takdirde, size sunulan ön bilgilendirme formunu ve mesafeli satış sözleşmesini kabul etmiş sayılırsınız.",
            "Alıcılar, satın aldıkları ürünün satış ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği (RG:27.11.2014/29188) hükümleri ile yürürlükteki diğer yasalara tabidir.",
            "Ürün sevkiyat masrafı olan kargo ücretleri, sipariş / ödeme ekranında aksi belirtilmedikçe alıcılar tarafından ödenir.",
            "Satın alınan her bir ürün, 30 günlük yasal süreyi aşmamak kaydı ile alıcının gösterdiği adresteki kişi ve/veya kuruluşa teslim edilir. Bu süre içinde ürün teslim edilmez ise, Alıcılar sözleşmeyi sona erdirebilir.",
            shipping,
            "Satın alınan ürün, eksiksiz ve siparişte belirtilen niteliklere uygun ve varsa garanti belgesi, kullanım kılavuzu gibi belgelerle teslim edilmek zorundadır.",
            "Satın alınan ürünün satılmasının imkânsızlaşması durumunda, satıcı bu durumu öğrendiğinden itibaren 3 gün içinde yazılı olarak alıcıya bu durumu bildirmek zorundadır. 14 gün içinde de toplam bedel Alıcı’ya iade edilmek zorundadır.",
          ],
        },
        {
          heading: "Satın alınan ürün bedeli ödenmez ise",
          paragraphs: [
            "Alıcı, satın aldığı ürün bedelini ödemez veya banka kayıtlarında iptal ederse, Satıcının ürünü teslim yükümlülüğü sona erer.",
          ],
        },
        {
          heading: "Kredi kartının yetkisiz kullanımı ile yapılan alışverişler",
          paragraphs: [
            "Ürün teslim edildikten sonra, alıcının ödeme yaptığı kredi kartının yetkisiz kişiler tarafından haksız olarak kullanıldığı tespit edilirse ve satılan ürün bedeli ilgili banka veya finans kuruluşu tarafından Satıcı’ya ödenmez ise, Alıcı, sözleşme konusu ürünü 3 gün içerisinde nakliye gideri SATICI’ya ait olacak şekilde SATICI’ya iade etmek zorundadır.",
          ],
        },
        {
          heading: "Öngörülemeyen sebeplerle ürün süresinde teslim edilemez ise",
          paragraphs: [
            "Satıcı’nın öngöremeyeceği mücbir sebepler oluşursa ve ürün süresinde teslim edilemez ise, durum Alıcı’ya bildirilir. Alıcı, siparişin iptalini, ürünün benzeri ile değiştirilmesini veya engel ortadan kalkana dek teslimatın ertelenmesini talep edebilir.",
            "Alıcı siparişi iptal ederse; ödemeyi nakit / havale ile yapmış ise iptalinden itibaren 14 gün içinde kendisine nakden bu ücret ödenir. Alıcı, ödemeyi kredi kartı ile yapmış ise ve iptal ederse, bu iptalden itibaren yine 14 gün içinde ürün bedeli bankaya iade edilir; bankanın alıcının hesabına 2–3 hafta içerisinde aktarması olasıdır.",
          ],
        },
        {
          heading: "Alıcının ürünü kontrol etme yükümlülüğü",
          paragraphs: [
            "Alıcı, sözleşme konusu mal / hizmeti teslim almadan önce muayene edecek; ezik, kırık, ambalajı yırtılmış vb. hasarlı ve ayıplı mal / hizmeti kargo şirketinden teslim almayacaktır. Teslim alınan mal / hizmetin hasarsız ve sağlam olduğu kabul edilecektir.",
            "ALICI, teslimden sonra mal / hizmeti özenle korumak zorundadır. Cayma hakkı kullanılacaksa mal / hizmet kullanılmamalıdır. Ürünle birlikte fatura da iade edilmelidir.",
          ],
        },
        {
          heading: "Cayma hakkı",
          paragraphs: [
            "ALICI; satın aldığı ürünün kendisine veya gösterdiği adresteki kişi / kuruluşa teslim tarihinden itibaren 14 (on dört) gün içerisinde, SATICI’ya aşağıdaki iletişim bilgileri üzerinden bildirmek şartıyla hiçbir hukuki ve cezai sorumluluk üstlenmeksizin ve hiçbir gerekçe göstermeksizin malı reddederek sözleşmeden cayma hakkını kullanabilir.",
            returns,
          ],
        },
        {
          heading: "Satıcının cayma hakkı bildirimi yapılacak iletişim bilgileri",
          paragraphs: [
            `Şirket adı / unvanı: ${seller}`,
            `Marka: ${brand}`,
            `Adres: ${address}`,
            `E-posta: ${ctx.email}`,
            ctx.whatsappPhone?.trim()
              ? `Tel / WhatsApp: ${ctx.whatsappPhone.trim()}`
              : "Tel: satıcı iletişim bilgilerinde güncellenir.",
            "Faks: Yok",
            `İnternet sitesi: ${siteUrl}`,
          ],
        },
        {
          heading: "Cayma hakkının süresi",
          paragraphs: [
            "Alıcı, satın aldığı eğer bir hizmet ise, bu 14 günlük süre sözleşmenin imzalandığı tarihten itibaren başlar. Cayma hakkı süresi sona ermeden önce, tüketicinin onayı ile hizmetin ifasına başlanan hizmet sözleşmelerinde cayma hakkı kullanılamaz.",
            "Cayma hakkının kullanımından kaynaklanan masraflar (cayma kapsamındaki iade kargo) SATICI’ya aittir. Yeniden stoklama (restocking) ücreti alınmaz.",
            `Cayma hakkının kullanılması için 14 (on dört) günlük süre içinde SATICI’ya iadeli taahhütlü posta, faks veya e-posta (${ctx.email}) / WhatsApp ile yazılı bildirimde bulunulması ve ürünün işbu metinde düzenlenen “Cayma hakkı kullanılamayacak ürünler” hükümleri çerçevesinde kullanılmamış olması şarttır.`,
          ],
        },
        {
          heading: "Cayma hakkının kullanımı",
          paragraphs: [
            "3. kişiye veya ALICI’ya teslim edilen ürünün faturası iade edilmelidir. (İade edilmek istenen ürünün faturası kurumsal ise, iade ederken kurumun düzenlemiş olduğu iade faturası ile birlikte gönderilmesi gerekmektedir. Faturası kurumlar adına düzenlenen sipariş iadeleri iade faturası kesilmediği takdirde tamamlanamayabilir.)",
            "İade formu (varsa) ve iade edilecek ürünlerin kutusu, ambalajı, varsa standart aksesuarları ile birlikte eksiksiz ve hasarsız olarak teslim edilmesi gerekmektedir.",
          ],
        },
        {
          heading: "İade koşulları",
          paragraphs: [
            "SATICI, cayma bildiriminin kendisine ulaşmasından itibaren en geç 10 günlük süre içerisinde toplam bedeli ve ALICI’yı borç altına sokan belgeleri ALICI’ya iade etmek ve 20 günlük süre içerisinde malı iade almakla yükümlüdür.",
            "Onaylanan cayma / iadelerde ödenen bedel, mevzuatta öngörülen süre içinde (kural olarak malın satıcıya ulaşmasından itibaren on dört gün içinde) ALICI’nın ödeme yaptığı yönteme iade edilir.",
            "ALICI’nın kusurundan kaynaklanan bir nedenle malın değerinde bir azalma olursa veya iade imkânsızlaşırsa ALICI kusuru oranında SATICI’nın zararlarını tazmin etmekle yükümlüdür. Ancak cayma hakkı süresi içinde malın veya ürünün usulüne uygun kullanılması sebebiyle meydana gelen değişiklik ve bozulmalardan ALICI sorumlu değildir.",
            "Cayma hakkının kullanılması nedeniyle SATICI tarafından düzenlenen kampanya limit tutarının altına düşülmesi halinde kampanya kapsamında faydalanılan indirim miktarı iptal edilir.",
          ],
        },
        {
          heading: "Cayma hakkı kullanılamayacak ürünler",
          paragraphs: [
            "ALICI’nın isteği veya açıkça kişisel ihtiyaçları doğrultusunda hazırlanan ve geri gönderilmeye müsait olmayan ürünler; iç giyim alt parçaları, mayo ve bikini altları, makyaj malzemeleri, tek kullanımlık ürünler; çabuk bozulma tehlikesi olan veya son kullanma tarihi geçme ihtimali olan mallar; ALICI’ya teslim edilmesinin ardından ALICI tarafından ambalajı açıldığı takdirde iade edilmesi sağlık ve hijyen açısından uygun olmayan ürünler; teslim edildikten sonra başka ürünlerle karışan ve doğası gereği ayrıştırılması mümkün olmayan ürünler; abonelik sözleşmesi kapsamında sağlananlar dışında gazete ve dergi gibi süreli yayınlara ilişkin mallar; elektronik ortamda anında ifa edilen hizmetler veya tüketiciye anında teslim edilen gayrimaddi mallar; ses veya görüntü kayıtları, kitap, dijital içerik, yazılım programları, veri kaydedebilme ve veri depolama cihazları, bilgisayar sarf malzemeleri — ambalajının ALICI tarafından açılmış olması halinde iadesi Yönetmelik gereği mümkün olmayabilir.",
            "Ayrıca cayma hakkı süresi sona ermeden önce, tüketicinin onayı ile ifasına başlanan hizmetlere ilişkin cayma hakkının kullanılması da Yönetmelik gereği mümkün değildir.",
            "Kozmetik ve kişisel bakım ürünleri, iç giyim ürünleri, mayo, bikini, kitap, kopyalanabilir yazılım ve programlar, DVD, VCD, CD ve kasetler ile kırtasiye sarf malzemeleri (toner, kartuş, şerit vb.) iade edilebilmesi için ambalajlarının açılmamış, denenmemiş, bozulmamış ve kullanılmamış olmaları gerekir.",
          ],
        },
        {
          heading: "Temerrüt hâli ve hukukî sonuçları",
          paragraphs: [
            "ALICI, ödeme işlemlerini kredi kartı ile yaptığı durumda temerrüde düştüğü takdirde, kart sahibi banka ile arasındaki kredi kartı sözleşmesi çerçevesinde faiz ödeyeceğini ve bankaya karşı sorumlu olacağını kabul, beyan ve taahhüt eder.",
            "Bu durumda ilgili banka hukuki yollara başvurabilir; doğacak masrafları ve vekâlet ücretini ALICI’dan talep edebilir. ALICI’nın borcundan dolayı temerrüde düşmesi halinde, ALICI, borcun gecikmeli ifasından dolayı SATICI’nın uğradığı zarar ve ziyanını ödeyeceğini kabul eder.",
          ],
        },
        {
          heading: "Ödeme ve teslimat",
          paragraphs: [
            "Banka havalesi veya EFT ile ödeme seçeneği sunulduğunda, hesap bilgileri sipariş / ödeme ekranında veya satıcı iletişiminde paylaşılır (IBAN kamuya açık yasal sayfada yayımlanmaz).",
            "Site üzerinden kredi kartı ile ödeme açıldığında; yetkili ödeme kuruluşu (ör. iyzico) üzerinden online tek çekim veya sunulan taksit imkânlarından yararlanılabilir. Online ödemelerde sipariş sonunda kartınızdan tutar çekim işlemi gerçekleşir.",
            shipping,
            "Beden / model değişimi, stok durumuna göre satıcının takdirinde veya karşılıklı anlaşma ile yapılabilir.",
          ],
        },
      ],
    },
    uyelik: {
      id: "uyelik",
      title: "Site Kullanım Şartları – Üyelik Sözleşmesi",
      summary:
        "Üyelik oluşturmadan önce okuyunuz. Formu tamamlayarak bu şartları kabul etmiş sayılırsınız.",
      sections: [
        {
          heading: "Giriş",
          paragraphs: [
            "Lütfen üyelik işlemini tamamlamadan önce bu site kullanım şartları ve üyelik sözleşmesini dikkatlice okuyun. Üyelik formunu doldurarak sözleşmeyi onaylayan kişiler aşağıdaki şartları kabul etmiş sayılır.",
            `Bu web sitesi ve siteye bağlı tüm sayfalar (“Site”), ${address} adresinde bulunan ${seller} (“Firma”; marka: ${brand}) tarafından işletilmektedir. Siteye üyelik oluşturan kişiler (“Kullanıcı”); yürürlükteki mevzuata göre sözleşme yapma hakkına, yetkisine ve hukukî ehliyetine sahip olduklarını, bu sözleşmeyi okuyup anladıklarını ve üyelik işlemini tamamlamaları hâlinde burada belirtilen koşullarla bağlı olacaklarını kabul eder.`,
            `İletişim: ${contact}. İnternet sitesi: ${siteUrl}.`,
            "Aynı e-posta ve şifre ile bu platformdaki diğer mağazalarda da giriş yapılabilir; sepet, favori ve siparişler mağaza bazında ayrı tutulur. Şifre sıfırlama tüm mağazalar için geçerlidir.",
          ],
        },
        {
          heading: "1. Sorumluluklar",
          paragraphs: [
            "1.1. Firma; yürürlükteki mevzuat ve tüketicinin zorunlu hakları saklı kalmak kaydıyla, Sitede sunulan ürün, hizmet ve fiyatlarda değişiklik yapma hakkını saklı tutar.",
            "1.2. Firma, planlı bakım, teknik arıza, mücbir sebep veya kendi makul kontrolü dışındaki durumlar haricinde Sitede sunulan hizmetlerin erişilebilirliğini sağlamak için gerekli özeni gösterir.",
            "1.3. Kullanıcı; Site üzerinde tersine mühendislik yapmayacağını, kaynak kodunu bulmaya veya elde etmeye yönelik işlemde bulunmayacağını ve Site güvenliğini ihlal edecek faaliyetler gerçekleştirmeyeceğini kabul eder. Bu tür işlemlerden doğan hukukî ve cezai sorumluluk Kullanıcıya aittir.",
            "1.4. Kullanıcı, Site üzerindeki faaliyetlerinde genel ahlaka, kamu düzenine ve yürürlükteki mevzuata aykırı davranmayacağını kabul eder. Firma; bu kuralları ihlal eden hesapları askıya alma veya kapatma ve gerekli hâllerde yasal yollara başvurma hakkını saklı tutar.",
            "1.5. Site kullanıcılarının birbirleri veya üçüncü kişilerle kurduğu ilişkilerden doğan sorumluluk kendilerine aittir.",
          ],
        },
        {
          heading: "2. Fikrî Mülkiyet Hakları",
          paragraphs: [
            "2.1. Sitede yer alan ve üçüncü kişilere ait olduğu açıkça belirtilmeyen içerik, tasarım, marka, logo, metin, görsel ve diğer fikrî mülkiyet unsurları Firma veya ilgili hak sahiplerine aittir ve yürürlükteki mevzuatla korunur. Sitenin ziyaret edilmesi Kullanıcıya bu unsurlar üzerinde herhangi bir hak vermez.",
            "2.2. Sitedeki içerikler, ilgili hak sahibinin yazılı izni olmadan mevzuatın izin verdiği sınırlar dışında çoğaltılamaz, kopyalanamaz, dağıtılamaz veya başka bir ortamda kullanılamaz.",
          ],
        },
        {
          heading: "3. Kişisel Veriler ve Gizlilik",
          paragraphs: [
            "3.1. Kullanıcılara ait kişisel veriler, 6698 sayılı Kişisel Verilerin Korunması Kanunu ve ilgili mevzuat uyarınca, Sitede yayımlanan aydınlatma metninde açıklanan amaçlar ve hukukî sebepler kapsamında işlenir ve gerekli durumlarda aktarılır.",
            "3.2. Reklam ve pazarlama amacıyla kişisel veri işlenmesi, ticari elektronik ileti gönderilmesi veya kişisel verilerin üçüncü kişilere aktarılması gereken durumlarda ilgili mevzuat uyarınca gerekli bilgilendirmeler yapılır ve gerektiğinde ayrı onay veya açık rıza alınır. Aydınlatma metni ile açık rıza metni ayrı süreçler olarak sunulur.",
            "3.3. Kullanıcıya ait bilgiler, yetkili kamu kurum ve kuruluşları tarafından usulüne uygun şekilde talep edilmesi veya yürürlükteki mevzuatın gerektirmesi hâlinde ilgili mercilerle paylaşılabilir.",
            `Ayrıntılar için KVKK Aydınlatma Metni ve Gizlilik Sözleşmesi sayfalarına bakınız (${siteUrl}).`,
          ],
        },
        {
          heading: "4. Hizmetlerin Sunumu",
          paragraphs: [
            "Zorunlu tüketici hakları ve emredici mevzuat hükümleri saklı kalmak kaydıyla, Site ve Site üzerinden sunulan dijital hizmetler mevcut hâliyle kullanıma sunulur. Firma, yürürlükteki mevzuatın izin verdiği ölçüde Sitenin kesintisiz veya hatasız çalışacağını garanti etmez.",
          ],
        },
        {
          heading: "5. Kayıt ve Güvenlik",
          paragraphs: [
            "Kullanıcı, kayıt sırasında doğru, güncel ve eksiksiz bilgi vermekle yükümlüdür. Hesap ve şifre güvenliğinin sağlanması Kullanıcının sorumluluğundadır. Kullanıcı, hesabında yetkisiz bir işlem fark ettiğinde Firmayı gecikmeden bilgilendirmelidir.",
            "Kullanıcının şifresini korumaması veya hesabını üçüncü kişilerle paylaşması nedeniyle oluşan zararlardan, yürürlükteki mevzuatın izin verdiği ölçüde Firma sorumlu tutulamaz.",
            `Hesap kapatma veya güvenlik bildirimleri için: ${contact}.`,
          ],
        },
        {
          heading: "6. Mücbir Sebep",
          paragraphs: [
            "Doğal afet, savaş, salgın, grev, iletişim veya enerji altyapısındaki geniş çaplı kesintiler, kamu otoritesi kararları ve tarafların makul kontrolü dışında gerçekleşen benzeri mücbir sebep hâllerinde, etkilenen yükümlülükler mücbir sebebin devam ettiği süre boyunca askıya alınabilir.",
          ],
        },
        {
          heading: "7. Sözleşmenin Bütünlüğü ve Uygulanabilirlik",
          paragraphs: [
            "Bu şartların herhangi bir hükmünün geçersiz veya uygulanamaz hâle gelmesi, diğer hükümlerin geçerliliğini etkilemez. Geçersiz hüküm, yürürlükteki mevzuata en uygun şekilde uygulanır.",
          ],
        },
        {
          heading: "8. Kullanım Şartlarında Yapılacak Değişiklikler",
          paragraphs: [
            "Firma, yürürlükteki mevzuata uygun olmak kaydıyla bu kullanım şartlarında değişiklik yapabilir. Değişiklikler Sitede yayımlandığı tarihte yürürlüğe girer. Mevzuatın ayrıca bildirim yapılmasını gerektirdiği durumlarda Kullanıcılar uygun yöntemlerle bilgilendirilir.",
          ],
        },
        {
          heading: "9. Bildirimler",
          paragraphs: [
            `Taraflar arasındaki bildirimler, yürürlükteki mevzuatın zorunlu tuttuğu özel bildirim yöntemleri saklı kalmak kaydıyla, tarafların bildirdiği iletişim adresleri üzerinden yapılabilir. Firma iletişim: ${contact}. Kullanıcı, iletişim bilgilerindeki değişiklikleri güncellemekle yükümlüdür.`,
          ],
        },
        {
          heading: "10. Kayıtlar ve Deliller",
          paragraphs: [
            "Taraflar arasında doğabilecek uyuşmazlıklarda Siteye ilişkin elektronik kayıtlar, işlem kayıtları ve tarafların sunduğu diğer deliller, yürürlükteki usul mevzuatı çerçevesinde değerlendirilir. Bu hüküm, tüketicilerin veya diğer tarafların emredici mevzuattan doğan ispat ve başvuru haklarını sınırlamaz.",
          ],
        },
        {
          heading: "11. Uyuşmazlıkların Çözümü",
          paragraphs: [
            "Tüketici işlemlerinde, tüketici hakem heyetleri ve tüketici mahkemeleri dâhil olmak üzere emredici mevzuatla belirlenen yetkili mercilere başvuru hakları saklıdır.",
            `Emredici bir yetki kuralının bulunmadığı diğer uyuşmazlıklarda ${disputeVenue(ctx.physicalAddress)} Mahkemeleri ve İcra Daireleri yetkilidir.`,
          ],
        },
      ],
    },
    kunye: {
      id: "kunye",
      title: "Hakkımızda / Künye",
      summary: "Satıcı kimlik, iletişim ve işletme bilgileri.",
      sections: [
        {
          heading: "Hakkımızda",
          paragraphs: [
            `${brand}, ${seller} tarafından işletilen bir çevrimiçi mağazadır.`,
            ctx.physicalAddress?.trim()
              ? `Mağaza / gönderim adresi: ${address}`
              : "Mağaza bilgileri künye bölümünde güncellenir.",
            "Ürünlerimizi online mağazamız üzerinden Türkiye geneline ulaştırıyoruz.",
          ],
        },
        {
          heading: "İşletme (künye)",
          paragraphs: [
            `Marka: ${brand}`,
            `Satıcı (yasal ad): ${seller}`,
            `Adres: ${address}`,
            contact,
            vergiLine,
            mersisLine,
            kepLine,
            `Web: ${siteUrl}`,
            ...(ctx.mersisNo?.trim()
              ? []
              : ["İşletme türü: şahıs işletmesi olabilir; MERSİS / KEP bilgileri mevcut oldukça güncellenir."]),
          ],
        },
        {
          heading: "İletişim",
          paragraphs: [
            `Sipariş, iade ve sorularınız için: ${contact}`,
            "ETBİS kaydı ve diğer idari yükümlülükler satıcı / danışman tarafından tamamlanır.",
          ],
        },
      ],
    },
  };

  return docs[docId];
}
