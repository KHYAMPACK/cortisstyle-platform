import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { consentNoticeVisible, parseCookieConsent } from "./consent";

describe("parseCookieConsent", () => {
  it("reads the two choices, and treats the old '1' as essential only", () => {
    assert.equal(parseCookieConsent("all"), "all");
    assert.equal(parseCookieConsent("essential"), "essential");
    assert.equal(parseCookieConsent("1"), "essential");
  });

  it("treats anything else as no answer", () => {
    assert.equal(parseCookieConsent(null), null);
    assert.equal(parseCookieConsent(undefined), null);
    assert.equal(parseCookieConsent("yes"), null);
  });
});

describe("consentNoticeVisible", () => {
  it("shows the notice until there is an answer", () => {
    assert.equal(consentNoticeVisible(null, false), true);
    assert.equal(consentNoticeVisible(null, true), true);
  });

  it("stays hidden once the visitor chose", () => {
    assert.equal(consentNoticeVisible("all", true), false);
    assert.equal(consentNoticeVisible("essential", true), false);
  });

  it("asks a visitor who only ever acknowledged the old notice again, but only if tags are used", () => {
    assert.equal(consentNoticeVisible("1", false), false);
    assert.equal(consentNoticeVisible("1", true), true);
  });
});
