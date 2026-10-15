"use client";

import Image from "next/image";
import Link from "next/link";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import { TrNaturalDandelion, TrNaturalWordmark } from "@/components/tr/boutique/natural/TrNaturalArt";
import { useStorefrontTaxonomy } from "@/components/tr/boutique/TrBoutiqueTaxonomy";
import { TrIyzicoFooterPaymentBand } from "@/components/tr/TrIyzicoPaymentBadges";
import { TrPlatformCredit } from "@/components/tr/TrPlatformCredit";
import { resolveBoutiqueLogoUrl } from "@/lib/tr/boutiqueBrand";
import { resolveBoutiqueContactEmail } from "@/lib/tr/checkoutMode";
import {
  trBoutiqueLegalPath,
  trBoutiquePath,
  trBoutiqueProductsPath,
} from "@/lib/tr/paths";
import { instagramProfileUrl } from "@/lib/tr/whatsapp";
import type { TrBoutiquePublic } from "@/types/tr-marketplace";

/** "905382532129" → "+90 538 253 21 29"; anything else as typed. */
function phoneLabel(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) {
    return `+90 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  }
  return phone;
}

const LINK = "text-[13px] text-[#e4ddca] transition-colors hover:text-white";
const HEADING = "text-[11px] font-semibold tracking-[0.18em] text-[#f0c810] uppercase";

export function TrBoutiqueNaturalFooter({ boutique }: { boutique: TrBoutiquePublic }) {
  const taxonomy = useStorefrontTaxonomy();
  const logoUrl = resolveBoutiqueLogoUrl(boutique);
  const slug = boutique.slug;
  const legal = (doc: string) => trBoutiqueLegalPath(slug, doc);
  const email = resolveBoutiqueContactEmail(boutique);
  const instagram = boutique.instagramHandle ? instagramProfileUrl(boutique.instagramHandle) : null;
  const registry = [
    boutique.legalName,
    boutique.mersisNo ? `MERSİS No: ${boutique.mersisNo}` : null,
    boutique.vergiNo
      ? `Vergi No: ${boutique.vergiNo}${boutique.vergiDairesi ? ` (${boutique.vergiDairesi})` : ""}`
      : null,
  ].filter(Boolean);

  return (
    <footer className="relative mt-auto overflow-hidden bg-[color:var(--nat-olive-deep)] text-[#f3eee2]">
      <TrNaturalDandelion
        className="pointer-events-none absolute -right-10 -bottom-14 hidden h-80 w-72 text-[#f3eee2] opacity-[0.07] lg:block"
        stem
      />
      <div className="relative mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:gap-12">
          <div>
            <Link href={trBoutiquePath(slug)} aria-label={boutique.name} className="inline-block">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={boutique.name}
                  width={220}
                  height={64}
                  unoptimized
                  className="h-12 w-auto rounded-sm bg-[color:var(--nat-paper)] px-3 py-1.5 object-contain"
                />
              ) : (
                <TrNaturalWordmark
                  name={boutique.name}
                  className="font-sans text-[2rem] leading-none font-light tracking-[-0.01em] text-[#f3eee2]"
                />
              )}
            </Link>
            {boutique.description ? (
              <p className="mt-5 max-w-sm text-[13px] leading-relaxed text-[#e4ddca]">
                {boutique.description}
              </p>
            ) : null}
            {instagram ? (
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="mt-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#f3eee2]/30 transition-colors hover:bg-[#f3eee2] hover:text-[color:var(--nat-olive-deep)]"
              >
                <InstagramIcon className="h-4 w-4" strokeWidth={1.75} />
              </a>
            ) : null}
          </div>

          <div>
            <h3 className={HEADING}>Alışveriş</h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link href={trBoutiqueProductsPath(slug)} className={LINK}>
                  Tüm ürünler
                </Link>
              </li>
              {taxonomy.roots().map((root) => (
                <li key={root.id}>
                  <Link href={trBoutiqueProductsPath(slug, { kategori: root.id })} className={LINK}>
                    {root.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className={HEADING}>Kurumsal ve yasal</h3>
            <ul className="mt-4 space-y-2.5">
              <li><Link href={legal("kunye")} className={LINK}>Künye ve iletişim</Link></li>
              <li><Link href={legal("mesafeli-satis")} className={LINK}>Mesafeli satış sözleşmesi</Link></li>
              <li><Link href={legal("on-bilgilendirme")} className={LINK}>Ön bilgilendirme formu</Link></li>
              <li><Link href={legal("iade")} className={LINK}>İptal, iade ve cayma</Link></li>
              <li><Link href={legal("kvkk")} className={LINK}>KVKK aydınlatma metni</Link></li>
              <li><Link href={legal("gizlilik")} className={LINK}>Gizlilik ve güvenlik</Link></li>
              <li><Link href={legal("cerez")} className={LINK}>Çerez politikası</Link></li>
            </ul>
          </div>

          <div>
            <h3 className={HEADING}>İletişim</h3>
            <ul className="mt-4 space-y-2.5 text-[13px] text-[#e4ddca]">
              {boutique.whatsappPhone ? (
                <li>
                  <a href={`tel:+${boutique.whatsappPhone.replace(/\D/g, "")}`} className="transition-colors hover:text-white">
                    {phoneLabel(boutique.whatsappPhone)}
                  </a>
                </li>
              ) : null}
              <li>
                <a href={`mailto:${email}`} className="break-all transition-colors hover:text-white">
                  {email}
                </a>
              </li>
              {boutique.physicalAddress ? (
                <li className="leading-relaxed text-[#cfc8b1]">{boutique.physicalAddress}</li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-5 border-t border-[#f3eee2]/15 pt-6">
          {registry.length > 0 ? (
            <p className="text-[11px] leading-relaxed text-[#cfc8b1]">
              © {new Date().getFullYear()} {registry.join(" · ")}
            </p>
          ) : (
            <p className="text-[11px] text-[#cfc8b1]">
              © {new Date().getFullYear()} {boutique.name}
            </p>
          )}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <TrIyzicoFooterPaymentBand variant="dark" />
            <TrPlatformCredit variant="dark" />
          </div>
        </div>
      </div>
    </footer>
  );
}
