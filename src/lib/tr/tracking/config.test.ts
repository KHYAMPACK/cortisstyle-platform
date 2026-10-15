import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_TRACKING,
  hasTracking,
  readTrackingConfig,
  readTrackingInput,
  trackingToJson,
} from "./config";

describe("readTrackingConfig", () => {
  it("returns nothing for anything that isn't an object", () => {
    assert.deepEqual(readTrackingConfig(null), EMPTY_TRACKING);
    assert.deepEqual(readTrackingConfig("x"), EMPTY_TRACKING);
    assert.deepEqual(readTrackingConfig([]), EMPTY_TRACKING);
  });

  it("keeps valid IDs, upper-casing the prefixed ones", () => {
    const config = readTrackingConfig({
      metaPixelId: " 1234567890123456 ",
      ga4Id: "g-abcde12345",
      gtmId: "gtm-abc1234",
      googleAdsId: "aw-123456789",
      googleAdsPurchaseLabel: "AbC-dEfGhIjK",
    });
    assert.equal(config.metaPixelId, "1234567890123456");
    assert.equal(config.ga4Id, "G-ABCDE12345");
    assert.equal(config.gtmId, "GTM-ABC1234");
    assert.equal(config.googleAdsId, "AW-123456789");
    assert.equal(config.googleAdsPurchaseLabel, "AbC-dEfGhIjK");
  });

  it("drops values that could break out of a script tag", () => {
    const config = readTrackingConfig({
      metaPixelId: "123'); alert(1);//",
      ga4Id: "G-ABC</script>",
      gtmId: "GTM-1 2",
    });
    assert.deepEqual(config, EMPTY_TRACKING);
  });
});

describe("readTrackingInput", () => {
  it("clears blank fields and accepts valid ones", () => {
    const result = readTrackingInput({ metaPixelId: "", ga4Id: "G-ABCDE12345" });
    assert.equal(result.metaPixelId, null);
    assert.equal(result.ga4Id, "G-ABCDE12345");
  });

  it("explains which field is wrong and what it should look like", () => {
    assert.throws(() => readTrackingInput({ metaPixelId: "abc" }), /Meta Pixel ID geçersiz.*1234567890123456/);
    assert.throws(() => readTrackingInput({ ga4Id: "UA-12345-1" }), /GA4.*G-ABCDE12345/);
    assert.throws(() => readTrackingInput({ gtmId: "GTM" }), /Tag Manager/);
    assert.throws(() => readTrackingInput({ googleAdsId: "123" }), /Google Ads kimliği/);
  });

  it("needs the Ads ID when a purchase label is given", () => {
    assert.throws(
      () => readTrackingInput({ googleAdsPurchaseLabel: "AbC-dEfGhIjK" }),
      /Google Ads kimliği de girilmeli/,
    );
    assert.doesNotThrow(() =>
      readTrackingInput({ googleAdsId: "AW-123456789", googleAdsPurchaseLabel: "AbC-dEfGhIjK" }),
    );
  });
});

describe("trackingToJson / hasTracking", () => {
  it("stores only the IDs that are set", () => {
    assert.deepEqual(trackingToJson({ ...EMPTY_TRACKING, ga4Id: "G-ABCDE12345" }), {
      ga4Id: "G-ABCDE12345",
    });
    assert.deepEqual(trackingToJson(EMPTY_TRACKING), {});
  });

  it("knows whether any tag is configured", () => {
    assert.equal(hasTracking(EMPTY_TRACKING), false);
    assert.equal(hasTracking({ ...EMPTY_TRACKING, metaPixelId: "1234567890123456" }), true);
  });
});
