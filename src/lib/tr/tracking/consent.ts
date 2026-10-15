/**
 * The visitor's cookie choice, kept in localStorage. Ad and analytics tags load only
 * after "all"; "essential" and no answer at all load nothing. The value `"1"` is what
 * the old single-button notice stored ("Anladım"): it only ever covered essential
 * cookies, so it never counts as consent to tracking.
 */

export type TrCookieConsent = "all" | "essential";

export const COOKIE_CONSENT_STORAGE_KEY = "cortis-tr-boutique-cookie-consent";

/** Fired on `window` after the choice changes, so the notice and the tag loader agree. */
export const COOKIE_CONSENT_EVENT = "cortis-tr-cookie-consent";

export function parseCookieConsent(raw: string | null | undefined): TrCookieConsent | null {
  if (raw === "all") return "all";
  if (raw === "essential" || raw === "1") return "essential";
  return null;
}

/** The stored choice, exactly as written (`null` = none, or storage is blocked). */
export function readCookieConsentRaw(): string | null {
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Saves the visitor's choice and tells every listener in this tab. */
export function writeCookieConsent(choice: TrCookieConsent): void {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice);
  } catch {
    // Storage blocked: the choice only lasts until the next page load.
  }
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
}

/** `useSyncExternalStore`'s subscribe: this tab's changes and other tabs' (`storage`). */
export function subscribeCookieConsent(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(COOKIE_CONSENT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(COOKIE_CONSENT_EVENT, onChange);
  };
}

/**
 * Whether the notice still needs an answer. A store that loads no tags only ever
 * needed the old acknowledgement; one that does has to hear "all" or "essential".
 */
export function consentNoticeVisible(
  raw: string | null | undefined,
  storeUsesTracking: boolean,
): boolean {
  if (raw === "all" || raw === "essential") return false;
  if (raw === "1") return storeUsesTracking;
  return true;
}
