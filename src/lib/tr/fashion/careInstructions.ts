import {
  canonicalizeTrCategoryId,
  getTrCategoryAncestors,
} from "@/lib/tr/fashion/categories";

export type TrCareGuide = {
  wash: string;
  care: string;
  iron: string;
  dry: string;
};

export const CARE_ROW_LABELS = {
  wash: "Yıkama Talimatı",
  care: "Bakım Talimatı",
  iron: "Ütüleme Talimatı",
  dry: "Kurutma Talimatı",
} as const;

const DELICATE_APPAREL: TrCareGuide = {
  wash: "Hassas 30 °C, ters yüz",
  care: "Hassas kullanım gerektirir. Benzer renklerle tersten yıkayınız.",
  iron: "Düşük sıcaklıkta, max. 110 °C ütülenebilir.",
  dry: "Askıda kurutun. Kurutma makinesi kullanılamaz.",
};

const COTTON_KNIT: TrCareGuide = {
  wash: "30 °C, ters yüz",
  care: "Benzer renklerle yıkayınız. Baskılı yüzeyleri ütülemeyin.",
  iron: "Düşük sıcaklıkta, max. 110 °C ütülenebilir.",
  dry: "Asarak kurutun. Kurutma makinesi önerilmez.",
};

const KNITWEAR: TrCareGuide = {
  wash: "Elde yıkama veya yün programı 20–30 °C",
  care: "Sıkmayın. Formunu korumak için yatay serin.",
  iron: "Düşük sıcaklıkta, bir bez üzerinden ütülenebilir.",
  dry: "Yatay sererek kurutun. Kurutma makinesi kullanılamaz.",
};

const OUTERWEAR: TrCareGuide = {
  wash: "Hassas 30 °C veya kuru temizleme",
  care: "Fermuar ve düğmeleri kapatın. Yumuşatıcı kullanmayın.",
  iron: "Düşük sıcaklıkta, max. 110 °C; omuz formunu koruyun.",
  dry: "Askıda doğal kurutun. Kurutma makinesi kullanılamaz.",
};

const DENIM: TrCareGuide = {
  wash: "Soğuk veya 30 °C, ters yüz, ilk yıkamalarda ayrı",
  care: "Ağartıcı ve yumuşatıcı kullanmayın. Koyu indigo boya verebilir.",
  iron: "Düşük sıcaklıkta, dikişler doğrultusunda ütülenebilir.",
  dry: "Belden asarak kurutun. Kurutma makinesi paçayı çekebilir.",
};

const WIPE_ONLY: TrCareGuide = {
  wash: "Yıkamayın. Nemli bezle silin.",
  care: "Su ve yağ bazlı temizleyicilerden kaçının.",
  iron: "Ütülenmez.",
  dry: "Doğal kurutun. Doğrudan ısı uygulamayın.",
};

const HAND_WASH_SOFT: TrCareGuide = {
  wash: "Elde yıkama, soğuk su",
  care: "Hassas kullanım gerektirir. Sıkmayın.",
  iron: "Düşük sıcaklıkta, bir bez üzerinden ütülenebilir.",
  dry: "Sererek kurutun. Kurutma makinesi kullanılamaz.",
};

const BEDDING: TrCareGuide = {
  wash: "40–60 °C, benzer renkler",
  care: "İlk yıkamada çektirme payı bırakın. Çamaşır suyundan kaçının.",
  iron: "Yüksek sıcaklıkta ütülenebilir.",
  dry: "Kurutma makinesinde düşük ısı veya asarak kurutun.",
};

const CARE_BY_CATEGORY: Record<string, TrCareGuide> = {
  tshirt: COTTON_KNIT,
  penye: COTTON_KNIT,
  bluz: DELICATE_APPAREL,
  gomlek: {
    wash: "30 °C, benzer renkler, ters yüz",
    care: "Düğmeleri ilikleyin. Kol ve yaka formunu koruyun.",
    iron: "Nemliyken, max. 110–150 °C ütülenebilir.",
    dry: "Askıda kurutun. Kurutma makinesi kumaşı büzebilir.",
  },
  tunik: DELICATE_APPAREL,
  triko: KNITWEAR,
  ceket: OUTERWEAR,
  mont: OUTERWEAR,
  kaban: OUTERWEAR,
  trenckot: {
    wash: "Hassas 30 °C, ters yüz",
    care: "Su itici kaplama için yumuşatıcı kullanmayın. Leke varsa nemli bezle silin.",
    iron: "Düşük sıcaklıkta, max. 110 °C ütülenebilir.",
    dry: "Askıda kurutun. Kurutma makinesi kullanılamaz.",
  },
  takim: {
    wash: "Kuru temizleme önerilir. Evde: hassas 30 °C, parçaları ayrı",
    care: "Hassas kullanım gerektirir.",
    iron: "Düşük sıcaklıkta ütülenebilir.",
    dry: "Askıda kurutun. Kurutma makinesi kullanılamaz.",
  },
  "deri-ceket": WIPE_ONLY,
  "kase-kaban": {
    wash: "Kuru temizleme",
    care: "Fırça ile tozunu alın. Makinede yıkamayın.",
    iron: "Ütülenmez; askıda buharlayın.",
    dry: "Askıda havalandırın.",
  },
  "kurk-mont": WIPE_ONLY,
  elbise: DELICATE_APPAREL,
  etek: DELICATE_APPAREL,
  pantolon: {
    wash: "30 °C, ters yüz",
    care: "Benzer renklerle yıkayınız.",
    iron: "Düşük sıcaklıkta, dikişler doğrultusunda ütülenebilir.",
    dry: "Belden asarak kurutun. Kurutma makinesi paçayı çekebilir.",
  },
  "kot-pantolon": DENIM,
  "kumas-pantolon": DELICATE_APPAREL,
  esofman: COTTON_KNIT,
  canta: WIPE_ONLY,
  esarp: HAND_WASH_SOFT,
  sal: HAND_WASH_SOFT,
  nevresim: BEDDING,
  "nevresim-takimi": BEDDING,
  "ust-giyim": DELICATE_APPAREL,
  "alt-giyim": {
    wash: "30 °C, ters yüz",
    care: "Benzer renklerle yıkayınız.",
    iron: "Düşük sıcaklıkta ütülenebilir.",
    dry: "Belden asarak kurutun. Kurutma makinesi önerilmez.",
  },
  "dis-giyim": OUTERWEAR,
  aksesuar: WIPE_ONLY,
  ev: BEDDING,
  ayakkabi: WIPE_ONLY,
};

const GENERIC_CARE: TrCareGuide = DELICATE_APPAREL;

/**
 * The care guide written for this category, or `null` when it has none — i.e. the
 * product is probably not a garment, and the generic apparel guide would be wrong.
 */
export function findCareInstructions(
  categoryId: string | null | undefined,
): TrCareGuide | null {
  const raw = categoryId?.trim();
  if (raw && CARE_BY_CATEGORY[raw]) return CARE_BY_CATEGORY[raw]!;

  const canonical = canonicalizeTrCategoryId(raw);
  if (canonical && CARE_BY_CATEGORY[canonical]) {
    return CARE_BY_CATEGORY[canonical]!;
  }

  for (const ancestor of getTrCategoryAncestors(raw)) {
    const copy = CARE_BY_CATEGORY[ancestor.id];
    if (copy) return copy;
  }

  return null;
}

export function getCareInstructions(
  categoryId: string | null | undefined,
): TrCareGuide {
  return findCareInstructions(categoryId) ?? GENERIC_CARE;
}
