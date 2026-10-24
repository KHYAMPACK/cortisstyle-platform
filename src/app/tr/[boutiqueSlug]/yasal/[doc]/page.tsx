import Link from "next/link";
import { notFound } from "next/navigation";
import { isNaturalEditorialSkin } from "@/lib/tr/boutiqueHome";
import { readNaturalOverrides } from "@/lib/tr/boutiqueHome/naturalContent";
import { readReturnShippingPayer } from "@/lib/tr/catalog/storePolicies";
import { resolveBoutiqueContactEmail } from "@/lib/tr/checkoutMode";
import {
  getTrLegalDoc,
  isTrLegalDocId,
  type TrLegalBoutiqueContext,
} from "@/lib/tr/legal/docs";
import { trBoutiquePath } from "@/lib/tr/paths";
import { safeGetPublicBoutique } from "@/lib/tr/publicData";
import { trackingToolNames } from "@/lib/tr/tracking/config";

interface LegalPageProps {
  params: Promise<{ boutiqueSlug: string; doc: string }>;
}

export default async function BoutiqueLegalPage({ params }: LegalPageProps) {
  const { boutiqueSlug, doc } = await params;

  if (!isTrLegalDocId(doc)) {
    notFound();
  }

  const boutique = await safeGetPublicBoutique(boutiqueSlug);
  if (!boutique) {
    notFound();
  }

  const email = resolveBoutiqueContactEmail(boutique);

  const ctx: TrLegalBoutiqueContext = {
    name: boutique.name,
    legalName: boutique.legalName,
    slug: boutique.slug,
    physicalAddress: boutique.physicalAddress,
    whatsappPhone: boutique.whatsappPhone,
    email,
    exchangePolicy: boutique.exchangePolicy,
    shippingNote: boutique.shippingNote,
    customDomain: boutique.customDomain,
    vergiNo: boutique.vergiNo,
    vergiDairesi: boutique.vergiDairesi,
    kepAddress: boutique.kepAddress,
    mersisNo: boutique.mersisNo,
    trackingTools: trackingToolNames(boutique.tracking),
    marketingEnabled: true,
    returnShippingPayer: readReturnShippingPayer(boutique.editorialContent),
  };

  const baseLegal = getTrLegalDoc(doc, ctx);

  // A "natural"-skin store can put its own about text on top of the seller details; the
  // page is then the store's Hakkımızda page (the footer calls it that).
  const aboutIntro =
    doc === "kunye" && isNaturalEditorialSkin(boutique.slug)
      ? readNaturalOverrides(boutique.editorialContent).aboutIntro
      : null;
  const legal = aboutIntro
    ? {
        ...baseLegal,
        title: "Hakkımızda",
        summary: "Biz kimiz; satıcı kimlik, iletişim ve işletme bilgileri.",
        sections: baseLegal.sections.filter((section) => section.heading !== "Hakkımızda"),
      }
    : baseLegal;

  return (
    <article className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
      <Link
        href={trBoutiquePath(boutique.slug)}
        className="text-[11px] tracking-[0.14em] text-neutral-500 uppercase transition-opacity hover:opacity-70"
      >
        ← {boutique.name}
      </Link>
      <h1 className="mt-6 font-serif text-3xl tracking-tight text-neutral-950 md:text-4xl">
        {legal.title}
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-neutral-600">
        {legal.summary}
      </p>

      {aboutIntro ? (
        <section className="mt-10 border-b border-black/10 pb-10">
          {aboutIntro.title ? (
            <h2 className="font-serif text-2xl tracking-tight text-neutral-950">{aboutIntro.title}</h2>
          ) : null}
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-neutral-700">
            {aboutIntro.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
          </div>
          {aboutIntro.signoff ? <p className="mt-6 text-[15px] text-neutral-700">{aboutIntro.signoff}</p> : null}
          {aboutIntro.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={aboutIntro.imageUrl}
              alt={aboutIntro.imageAlt ?? ""}
              width={150}
              height={172}
              className="mt-4 h-auto w-[150px] rounded-sm object-cover"
            />
          ) : null}
        </section>
      ) : null}

      <div className="mt-10 space-y-8">
        {legal.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-[13px] font-semibold tracking-[0.14em] uppercase">
              {section.heading}
            </h2>
            <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-neutral-700">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
