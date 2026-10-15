"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { hasTracking, type TrBoutiqueTracking } from "@/lib/tr/tracking/config";
import {
  parseCookieConsent,
  readCookieConsentRaw,
  subscribeCookieConsent,
} from "@/lib/tr/tracking/consent";
import {
  activateTracking,
  loadTrackingTags,
  trackEvent,
} from "@/lib/tr/tracking/runtime";

/**
 * Loads the store's ad / analytics tags — only for a visitor who chose "Tümünü kabul
 * et" — and reports each page view. Renders nothing; a store with no tags costs nothing.
 */
export function TrBoutiqueTracker({ tracking }: { tracking: TrBoutiqueTracking }) {
  const consent = parseCookieConsent(
    useSyncExternalStore(subscribeCookieConsent, readCookieConsentRaw, () => null),
  );
  const pathname = usePathname();
  const enabled = consent === "all" && hasTracking(tracking);
  const configKey = JSON.stringify(tracking);

  useEffect(() => {
    if (!enabled) {
      activateTracking(null);
      return;
    }
    loadTrackingTags(tracking);
    activateTracking(tracking);
    return () => activateTracking(null);
    // `configKey` stands in for the (re-created each render) tracking object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, configKey]);

  useEffect(() => {
    if (enabled) trackEvent({ type: "page_view", path: pathname });
  }, [enabled, pathname]);

  return null;
}
