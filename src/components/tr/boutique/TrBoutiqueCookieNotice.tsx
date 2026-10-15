"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  consentNoticeVisible,
  readCookieConsentRaw,
  subscribeCookieConsent,
  writeCookieConsent,
} from "@/lib/tr/tracking/consent";

/** On the server the visitor's choice is unknown, so nothing is shown until hydration. */
const UNKNOWN = Symbol("unknown");

/**
 * A store that loads no ad / analytics tags only needs the one-button "Anladım"
 * notice about essential cookies. One that does (`usesTracking`) has to ask first:
 * "Tümünü kabul et" lets its tags load, "Yalnızca zorunlu" keeps them off.
 */
export function TrBoutiqueCookieNotice({
  privacyHref,
  usesTracking = false,
}: {
  privacyHref: string;
  usesTracking?: boolean;
}) {
  const stored = useSyncExternalStore<string | null | typeof UNKNOWN>(
    subscribeCookieConsent,
    readCookieConsentRaw,
    () => UNKNOWN,
  );

  if (stored === UNKNOWN || !consentNoticeVisible(stored, usesTracking)) return null;

  return (
    <div
      data-atelier-chrome=""
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-black/10 bg-white/95 px-4 py-4 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur-md md:px-8"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] leading-relaxed text-neutral-700">
          {usesTracking
            ? "Bu sitede zorunlu çerezlerin yanı sıra, onayınızla analiz ve reklam çerezleri kullanılır. "
            : "Bu sitede zorunlu çerezler kullanılır. "}
          Detaylar için{" "}
          <Link href={privacyHref} className="underline underline-offset-2">
            çerez politikası
          </Link>
          .
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          {usesTracking ? (
            <button
              type="button"
              onClick={() => writeCookieConsent("essential")}
              className="border border-neutral-900 px-4 py-2.5 text-[11px] tracking-[0.14em] text-neutral-900 uppercase"
            >
              Yalnızca zorunlu
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => writeCookieConsent(usesTracking ? "all" : "essential")}
            className="bg-neutral-900 px-4 py-2.5 text-[11px] tracking-[0.14em] text-white uppercase"
          >
            {usesTracking ? "Tümünü kabul et" : "Anladım"}
          </button>
        </div>
      </div>
    </div>
  );
}
