"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  CARE_ROW_LABELS,
  findCareInstructions,
  getCareInstructions,
  type TrCareGuide,
} from "@/lib/tr/fashion/careInstructions";
import { listProductFeatureRows } from "@/lib/tr/catalog/productFeatures";
import {
  getPdpDeliverySummary,
  type TrPdpPolicyRun,
} from "@/lib/tr/catalog/pdpReturns";
import {
  formatColorLabel,
  resolveProductColors,
} from "@/lib/tr/productOptions";
import { TrSoftNavLink } from "@/components/tr/TrSoftNavLink";
import type { TrProductWithBoutique } from "@/types/tr-marketplace";

interface TrBoutiquePdpInfoSectionsProps {
  product: TrProductWithBoutique;
  branded: boolean;
}

export function TrBoutiquePdpInfoSections({
  product,
  branded,
}: TrBoutiquePdpInfoSectionsProps) {
  const featureRows = listProductFeatureRows(product.features, {
    color: formatColorLabel(resolveProductColors(product)),
  });
  // Garment care text only makes sense for garments: fashion products and legacy
  // rows (no product type) keep it; "simple" products never get it; "advanced" ones
  // only when their category has a care guide of its own.
  const showCare =
    product.productType === "fashion" ||
    product.productType === undefined ||
    (product.productType === "advanced" &&
      findCareInstructions(product.category) !== null);
  const care = getCareInstructions(product.category);
  const delivery = getPdpDeliverySummary(
    product.boutique,
  );
  const rule = branded ? "border-black/8" : "border-blueprint-border";

  return (
    <div className={`mt-6 border-t pt-1 ${rule}`}>
      {featureRows.length > 0 ? (
        <section className={`border-b py-5 ${rule}`}>
          <h2 className="text-[12px] font-semibold tracking-[0.12em] text-neutral-950 uppercase">
            Ürün Özellikleri
          </h2>
          <dl className="mt-4 space-y-2.5 text-[13px] leading-relaxed">
            {featureRows.map((row) => (
              <div key={row.key} className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-neutral-800">{row.label}:</dt>
                <dd className="text-neutral-700">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {showCare ? (
        <PdpAccordion title="İçerik ve Bakım" rule={rule} defaultOpen>
          <CareGuideList care={care} />
        </PdpAccordion>
      ) : null}

      <PdpAccordion title="Teslimat ve İade" rule={rule} defaultOpen>
        <div className="space-y-3 text-[13px] leading-relaxed text-neutral-800">
          {delivery.paragraphs.map((runs, index) => (
            <p key={index}>
              {runs.map((run, runIndex) => (
                <PolicyRun key={runIndex} run={run} />
              ))}
            </p>
          ))}
          {delivery.legalHref ? (
            <p>
              <TrSoftNavLink
                href={delivery.legalHref}
                className="underline underline-offset-2 decoration-black/25 hover:decoration-black/60"
              >
                İade koşullarının ayrıntısı
              </TrSoftNavLink>
            </p>
          ) : null}
        </div>
      </PdpAccordion>
    </div>
  );
}

function PolicyRun({ run }: { run: TrPdpPolicyRun }) {
  if (run.strong) {
    return <strong className="font-semibold text-neutral-950">{run.text}</strong>;
  }
  return run.text;
}

function CareGuideList({ care }: { care: TrCareGuide }) {
  const rows: Array<{
    key: keyof TrCareGuide;
    icon: ReactNode;
  }> = [
    { key: "wash", icon: <HandWashIcon /> },
    { key: "care", icon: <ShirtCareIcon /> },
    { key: "iron", icon: <IronIcon /> },
    { key: "dry", icon: <NoTumbleIcon /> },
  ];

  return (
    <ul className="space-y-4">
      {rows.map((row) => (
        <li key={row.key} className="flex gap-3 text-[13px] leading-relaxed">
          <span className="mt-0.5 shrink-0 text-neutral-700" aria-hidden>
            {row.icon}
          </span>
          <p className="text-neutral-800">
            <span className="font-semibold">{CARE_ROW_LABELS[row.key]}:</span>{" "}
            {care[row.key]}
          </p>
        </li>
      ))}
    </ul>
  );
}

function PdpAccordion({
  title,
  children,
  rule,
  defaultOpen,
}: {
  title: string;
  children: ReactNode;
  rule: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <section className={`border-b ${rule}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-between gap-3 py-4 text-left"
      >
        <span className="text-[12px] font-semibold tracking-[0.12em] text-neutral-950 uppercase">
          {title}
        </span>
        {open ? (
          <Minus className="h-4 w-4 text-neutral-500" strokeWidth={1.5} />
        ) : (
          <Plus className="h-4 w-4 text-neutral-500" strokeWidth={1.5} />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className={`border-t pt-4 pb-5 ${rule}`}>{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function HandWashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 14h16v3.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5V14Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M8 14V11.5a4 4 0 0 1 8 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M7.5 9.5c.4-1.2 1.2-2 2.2-2.2M16.5 9.5c-.4-1.2-1.2-2-2.2-2.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShirtCareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 5.5 4.5 8v12.5h15V8L16 5.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M8 5.5c1.2 1.6 6.8 1.6 8 0"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M12 7.5v13" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 16.5h14.5A3.5 3.5 0 0 0 22 13V11H9.5L4 16.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M8 19h10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NoTumbleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6 6l12 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
