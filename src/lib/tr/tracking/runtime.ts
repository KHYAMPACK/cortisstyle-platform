"use client";

import type { TrBoutiqueTracking } from "./config";
import {
  dispatchTrackingEvent,
  type TrackingEvent,
  type TrackingWindow,
} from "./events";

/**
 * Browser side of tracking: loads a store's tags once the visitor said "all", and
 * lets any component report an event without knowing which tools are configured.
 * Tracking must never break the shop, so everything here swallows its own errors.
 */

interface TagWindow extends TrackingWindow {
  __cortisTagsLoaded?: boolean;
}

let activeConfig: TrBoutiqueTracking | null = null;
const listeners = new Set<() => void>();

/** Called by the tracker component: `null` turns reporting off (no consent / no tags). */
export function activateTracking(config: TrBoutiqueTracking | null): void {
  activeConfig = config;
  listeners.forEach((listener) => listener());
}

/** Whether events are being reported right now (tags configured and consent given). */
export function isTrackingActive(): boolean {
  return activeConfig !== null;
}

/**
 * Lets a component that wants to report something on load (a product view, a
 * purchase) wait until tracking is switched on — the shell's tracker may activate
 * after the page's own effects have run.
 */
export function subscribeTrackingActive(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reports an event to every configured tool — a no-op until tracking is activated. */
export function trackEvent(event: TrackingEvent): void {
  if (typeof window === "undefined" || !activeConfig) return;
  try {
    dispatchTrackingEvent(event, activeConfig, window as unknown as TrackingWindow);
  } catch {
    // A broken tag must not affect browsing or checkout.
  }
}

function addScript(src: string): void {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

/**
 * Defines each tool's queue first and loads its library after, so an event reported
 * before the library finishes loading is replayed by it instead of being lost.
 */
export function loadTrackingTags(config: TrBoutiqueTracking): void {
  if (typeof window === "undefined") return;
  const win = window as unknown as TagWindow;
  if (win.__cortisTagsLoaded) return;
  win.__cortisTagsLoaded = true;

  try {
    win.dataLayer = win.dataLayer ?? [];
    const layer = win.dataLayer;

    if (config.gtmId) {
      layer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      addScript(`https://www.googletagmanager.com/gtm.js?id=${config.gtmId}`);
    } else if (config.ga4Id || config.googleAdsId) {
      win.gtag = function gtag() {
        // gtag.js reads the `arguments` object itself from the data layer, not an array.
        // eslint-disable-next-line prefer-rest-params
        layer.push(arguments);
      };
      win.gtag("js", new Date());
      // Page views are sent by the tracker on every route change, not automatically.
      if (config.ga4Id) win.gtag("config", config.ga4Id, { send_page_view: false });
      if (config.googleAdsId) win.gtag("config", config.googleAdsId);
      addScript(
        `https://www.googletagmanager.com/gtag/js?id=${config.ga4Id ?? config.googleAdsId}`,
      );
    }

    if (config.metaPixelId) {
      type Fbq = ((...args: unknown[]) => void) & {
        callMethod?: (...args: unknown[]) => void;
        queue: unknown[][];
        loaded: boolean;
        version: string;
        push?: unknown;
      };
      // The same queue-then-replay stub Meta's own snippet defines: calls made before
      // fbevents.js loads are kept and played back by it.
      const fbq: Fbq = Object.assign(
        (...args: unknown[]) => {
          if (fbq.callMethod) fbq.callMethod(...args);
          else fbq.queue.push(args);
        },
        { queue: [] as unknown[][], loaded: true, version: "2.0" },
      );
      fbq.push = fbq;
      win.fbq = fbq;
      addScript("https://connect.facebook.net/en_US/fbevents.js");
      fbq("init", config.metaPixelId);
    }
  } catch {
    // Same rule as trackEvent: a tag that fails to load never reaches the shopper.
  }
}
