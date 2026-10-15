"use client";

import { TrPanelLink as Link } from "@/components/tr/panel/TrPanelLink";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type FormEvent } from "react";
import { TrOwnerPanelGate } from "@/components/tr/panel/TrOwnerPanelGate";
import { TrOwnerPushNotificationsCard } from "@/components/tr/panel/TrOwnerPushNotificationsCard";
import { TrPanelImageField } from "@/components/tr/panel/TrPanelImageField";
import {
  panelBackLinkClass,
  panelFieldClass,
  panelHintClass,
  panelLabelClass,
  panelPageTitleClass,
  panelPrimaryBtnClass,
  panelSectionClass,
} from "@/components/tr/panel/panelUi";
import {
  TrPanelBusySpinner,
  TrPanelFadeIn,
  TrPanelListSkeleton,
  trPanelFadeTransition,
} from "@/components/tr/panel/TrPanelMotion";
import {
  fetchOwnerBoutiqueSettings,
  updateOwnerBoutiqueSettings,
  type TrOwnerBoutiqueSettings,
} from "@/lib/tr/ownerClient";
import { trBoutiquePath, trPanelOriginalsPath, trPanelPath } from "@/lib/tr/paths";

function SettingsForm({ boutiqueId }: { boutiqueId: string }) {
  const [settings, setSettings] = useState<TrOwnerBoutiqueSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [themeAccent, setThemeAccent] = useState("");
  const [shippingNote, setShippingNote] = useState("");
  const [exchangePolicy, setExchangePolicy] = useState("");
  const [physicalAddress, setPhysicalAddress] = useState("");
  const [legalName, setLegalName] = useState("");
  const [vergiNo, setVergiNo] = useState("");
  const [vergiDairesi, setVergiDairesi] = useState("");
  const [mersisNo, setMersisNo] = useState("");
  const [kepAddress, setKepAddress] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [iban, setIban] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [metaPixelId, setMetaPixelId] = useState("");
  const [ga4Id, setGa4Id] = useState("");
  const [gtmId, setGtmId] = useState("");
  const [googleAdsId, setGoogleAdsId] = useState("");
  const [googleAdsPurchaseLabel, setGoogleAdsPurchaseLabel] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchOwnerBoutiqueSettings(boutiqueId);
        if (cancelled) return;
        setSettings(result);
        setDescription(result.description ?? "");
        setLogoUrl(result.logoUrl ?? "");
        setWhatsappPhone(result.whatsappPhone ?? "");
        setInstagramHandle(result.instagramHandle ?? "");
        setThemeAccent(result.themeAccent ?? "");
        setShippingNote(result.shippingNote ?? "");
        setExchangePolicy(result.exchangePolicy ?? "");
        setPhysicalAddress(result.physicalAddress ?? "");
        setLegalName(result.legalName ?? "");
        setVergiNo(result.vergiNo ?? "");
        setVergiDairesi(result.vergiDairesi ?? "");
        setMersisNo(result.mersisNo ?? "");
        setKepAddress(result.kepAddress ?? "");
        setContactEmail(result.contactEmail ?? "");
        setIban(result.iban ?? "");
        setMetaPixelId(result.tracking?.metaPixelId ?? "");
        setGa4Id(result.tracking?.ga4Id ?? "");
        setGtmId(result.tracking?.gtmId ?? "");
        setGoogleAdsId(result.tracking?.googleAdsId ?? "");
        setGoogleAdsPurchaseLabel(result.tracking?.googleAdsPurchaseLabel ?? "");
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Ayarlar yüklenemedi.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [boutiqueId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateOwnerBoutiqueSettings(boutiqueId, {
        description: description.trim() || null,
        logoUrl: logoUrl.trim() || null,
        whatsappPhone: whatsappPhone.trim() || null,
        instagramHandle: instagramHandle.trim() || null,
        themeAccent: themeAccent.trim() || null,
        shippingNote: shippingNote.trim() || null,
        exchangePolicy: exchangePolicy.trim() || null,
        physicalAddress: physicalAddress.trim() || null,
        legalName: legalName.trim() || null,
        vergiNo: vergiNo.trim() || null,
        vergiDairesi: vergiDairesi.trim() || null,
        mersisNo: mersisNo.trim() || null,
        kepAddress: kepAddress.trim() || null,
        contactEmail: contactEmail.trim() || null,
        iban: iban.trim() || null,
        tracking: {
          metaPixelId: metaPixelId.trim() || null,
          ga4Id: ga4Id.trim() || null,
          gtmId: gtmId.trim() || null,
          googleAdsId: googleAdsId.trim() || null,
          googleAdsPurchaseLabel: googleAdsPurchaseLabel.trim() || null,
        },
      });
      setSettings(updated);
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Kayıt başarısız.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <TrPanelListSkeleton rows={6} label="Ayarlar yükleniyor" />;
  }

  return (
    <TrPanelFadeIn>
      <form onSubmit={handleSubmit} className={`${panelSectionClass} space-y-6`}>
        <p className={panelHintClass}>
          {settings?.name} — mağaza iletişim ve politika alanları.
        </p>

        {settings?.slug ? (
          <div className={`${panelHintClass} rounded-xl border border-[color:var(--panel-accent-border)] bg-[color:var(--panel-accent-softer)] px-4 py-3`}>
            <p>
              Vitrin:{" "}
              <Link
                href={trBoutiquePath(settings.slug)}
                className="underline underline-offset-2"
                target="_blank"
              >
                /tr/{settings.slug}
              </Link>
            </p>
            <p className="text-[15px] text-neutral-600">
              Özel alan adı DNS ile bağlandığında (ör. pervinsoysal.com) aynı
              vitrin o adreste açılır.
            </p>
          </div>
        ) : null}

        <label className="block space-y-2">
          <span className={panelLabelClass}>
            Açıklama
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className={panelFieldClass}
          />
        </label>

        <div className="space-y-2">
          <TrPanelImageField
            boutiqueId={boutiqueId}
            label="Logo"
            value={logoUrl.trim() || null}
            onChange={(url) => setLogoUrl(url ?? "")}
            onError={(message) => setError(message)}
            onUploadingChange={setUploadingLogo}
            disabled={saving}
          />
          <p className={panelHintClass}>
            PNG yükleyin: giriş ve sipariş e-postalarında da bu logo kullanılır, SVG
            çoğu e-posta uygulamasında görünmez.
          </p>
        </div>

        <label className="block space-y-2">
          <span className={panelLabelClass}>
            İletişim e-postası
          </span>
          <input
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            className={panelFieldClass}
            placeholder="destek@firmaniz.com"
            autoComplete="off"
          />
          <span className={panelHintClass}>
            Mağazada ve sözleşmelerde görünür; sipariş e-postalarına yanıt bu adrese gider.
          </span>
        </label>

        <label className="block space-y-2">
          <span className={panelLabelClass}>
            WhatsApp (ülke kodu ile)
          </span>
          <input
            value={whatsappPhone}
            onChange={(event) => setWhatsappPhone(event.target.value)}
            className={panelFieldClass}
            placeholder="90543..."
          />
        </label>

        <label className="block space-y-2">
          <span className={panelLabelClass}>
            Instagram
          </span>
          <input
            value={instagramHandle}
            onChange={(event) => setInstagramHandle(event.target.value)}
            className={panelFieldClass}
            placeholder="lilabutik"
          />
        </label>

        <label className="block space-y-2">
          <span className={panelLabelClass}>
            Tema rengi (accent)
          </span>
          <div className="flex gap-3">
            <input
              type="color"
              value={themeAccent.trim() || "#C2185B"}
              onChange={(event) => setThemeAccent(event.target.value)}
              className="h-12 w-14 shrink-0 cursor-pointer border border-black/15 bg-white p-1"
              aria-label="Tema rengi seç"
            />
            <input
              value={themeAccent}
              onChange={(event) => setThemeAccent(event.target.value)}
              className={panelFieldClass}
              placeholder="#C2185B"
            />
          </div>
        </label>

        <label className="block space-y-2">
          <span className={panelLabelClass}>
            Kargo notu
          </span>
          <input
            value={shippingNote}
            onChange={(event) => setShippingNote(event.target.value)}
            className={panelFieldClass}
          />
        </label>

        <label className="block space-y-2">
          <span className={panelLabelClass}>
            Değişim / iade
          </span>
          <input
            value={exchangePolicy}
            onChange={(event) => setExchangePolicy(event.target.value)}
            className={panelFieldClass}
          />
        </label>

        <label className="block space-y-2">
          <span className={panelLabelClass}>
            Adres
          </span>
          <textarea
            value={physicalAddress}
            onChange={(event) => setPhysicalAddress(event.target.value)}
            rows={2}
            className={panelFieldClass}
          />
        </label>

        <div className="space-y-4 border border-black/10 bg-neutral-50 px-4 py-4">
          <div>
            <p className={panelLabelClass}>
              Satıcı / fatura bilgileri
            </p>
            <p className="mt-1 text-[12px] text-neutral-600">
              Vergi levhası ve IBAN buraya yazılır (owner-only). Kimlik /
              ikametgah belgelerini panele yüklemeyin; iyzico KYC için ayrı
              saklayın.
            </p>
          </div>
          <label className="block space-y-2">
            <span className={panelLabelClass}>
              Ticari unvan / satıcı adı
            </span>
            <input
              value={legalName}
              onChange={(event) => setLegalName(event.target.value)}
              className={panelFieldClass}
              placeholder="Şahıs: Ad Soyad (vergi levhası)"
            />
          </label>
          <label className="block space-y-2">
            <span className={panelLabelClass}>
              Vergi no
            </span>
            <input
              value={vergiNo}
              onChange={(event) => setVergiNo(event.target.value)}
              className={panelFieldClass}
              inputMode="numeric"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-2">
            <span className={panelLabelClass}>
              Vergi dairesi
            </span>
            <input
              value={vergiDairesi}
              onChange={(event) => setVergiDairesi(event.target.value)}
              className={panelFieldClass}
              placeholder="Örn. Pamukkale"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-2">
            <span className={panelLabelClass}>
              MERSİS no (şirketler için, 16 hane)
            </span>
            <input
              value={mersisNo}
              onChange={(event) => setMersisNo(event.target.value)}
              className={panelFieldClass}
              inputMode="numeric"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-2">
            <span className={panelLabelClass}>
              KEP adresi
            </span>
            <input
              type="email"
              value={kepAddress}
              onChange={(event) => setKepAddress(event.target.value)}
              className={panelFieldClass}
              placeholder="firma@hs01.kep.tr"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-2">
            <span className={panelLabelClass}>
              IBAN
            </span>
            <input
              value={iban}
              onChange={(event) => setIban(event.target.value)}
              className={panelFieldClass}
              placeholder="TR…"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="space-y-4 border border-black/10 bg-neutral-50 px-4 py-4">
          <div>
            <p className={panelLabelClass}>
              Reklam ve analiz kodları
            </p>
            <p className="mt-1 text-[12px] text-neutral-600">
              Boş bırakılan kod yüklenmez. Kodlar yalnızca çerez uyarısında “Tümünü
              kabul et” diyen ziyaretçilerde çalışır. Google Tag Manager
              kullanıyorsanız GA4 ve Google Ads etiketlerini GTM içinden yönetin;
              aynı etiketi hem burada hem GTM’de tanımlamayın (çift sayım olur).
            </p>
          </div>
          <label className="block space-y-2">
            <span className={panelLabelClass}>Meta Pixel ID</span>
            <input
              value={metaPixelId}
              onChange={(event) => setMetaPixelId(event.target.value)}
              className={panelFieldClass}
              inputMode="numeric"
              placeholder="1234567890123456"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-2">
            <span className={panelLabelClass}>Google Analytics 4 ölçüm kimliği</span>
            <input
              value={ga4Id}
              onChange={(event) => setGa4Id(event.target.value)}
              className={panelFieldClass}
              placeholder="G-ABCDE12345"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-2">
            <span className={panelLabelClass}>Google Tag Manager kimliği</span>
            <input
              value={gtmId}
              onChange={(event) => setGtmId(event.target.value)}
              className={panelFieldClass}
              placeholder="GTM-ABC1234"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-2">
            <span className={panelLabelClass}>Google Ads kimliği</span>
            <input
              value={googleAdsId}
              onChange={(event) => setGoogleAdsId(event.target.value)}
              className={panelFieldClass}
              placeholder="AW-123456789"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-2">
            <span className={panelLabelClass}>Google Ads satın alma dönüşüm etiketi</span>
            <input
              value={googleAdsPurchaseLabel}
              onChange={(event) => setGoogleAdsPurchaseLabel(event.target.value)}
              className={panelFieldClass}
              placeholder="AbC-dEfGhIjKlMn"
              autoComplete="off"
            />
          </label>
        </div>

        <AnimatePresence>
          {error ? (
            <motion.p
              key="settings-error"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={trPanelFadeTransition}
              className="border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800"
            >
              {error}
            </motion.p>
          ) : null}
          {saved ? (
            <motion.p
              key="settings-saved"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={trPanelFadeTransition}
              className="rounded-xl border border-[color:var(--panel-accent-border)] bg-[color:var(--panel-accent-softer)] px-4 py-3 text-[15px] text-neutral-700"
            >
              Kaydedildi. Mağaza sayfasında güncellenir.
            </motion.p>
          ) : null}
        </AnimatePresence>

        <button
          type="submit"
          disabled={saving || uploadingLogo}
          className={`${panelPrimaryBtnClass} w-full gap-3`}
        >
          {saving ? (
            <>
              <TrPanelBusySpinner />
              Kaydediliyor…
            </>
          ) : (
            "Kaydet"
          )}
        </button>
      </form>
    </TrPanelFadeIn>
  );
}

export function TrOwnerSettingsPage() {
  return (
    <TrOwnerPanelGate>
      {({ activeBoutique, isStaff }) => (
        <div className="space-y-6">
          <div>
            <Link href={trPanelPath()} className={panelBackLinkClass}>
              ← Giriş
            </Link>
            <h2 className={panelPageTitleClass}>Ayarlar</h2>
          </div>
          <TrOwnerPushNotificationsCard boutiqueId={activeBoutique.id} />
          <SettingsForm boutiqueId={activeBoutique.id} />
          {isStaff ? (
            <p className={`${panelHintClass} pt-2`}>
              <Link
                href={trPanelOriginalsPath()}
                className="text-neutral-400 hover:text-neutral-600"
              >
                Orijinal fotoğraflar
              </Link>
            </p>
          ) : null}
        </div>
      )}
    </TrOwnerPanelGate>
  );
}
