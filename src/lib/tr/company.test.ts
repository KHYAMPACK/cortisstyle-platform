import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeContactEmail,
  normalizeKepAddress,
  normalizeMersisNo,
  normalizeVergiDairesi,
} from "./company";

describe("normalizeVergiDairesi", () => {
  it("tidies spaces and treats blank as not set", () => {
    assert.equal(normalizeVergiDairesi("  Pamukkale   V.D. "), "Pamukkale V.D.");
    assert.equal(normalizeVergiDairesi("  "), null);
    assert.equal(normalizeVergiDairesi(null), null);
  });

  it("caps the length", () => {
    assert.throws(() => normalizeVergiDairesi("x".repeat(81)), /80 karakter/);
  });
});

describe("normalizeMersisNo", () => {
  it("accepts 16 digits, ignoring spaces and dashes", () => {
    assert.equal(normalizeMersisNo("0123 4567 8901 2345"), "0123456789012345");
    assert.equal(normalizeMersisNo("0123-4567-8901-2345"), "0123456789012345");
    assert.equal(normalizeMersisNo(""), null);
  });

  it("rejects anything else", () => {
    assert.throws(() => normalizeMersisNo("12345"), /16 haneli/);
    assert.throws(() => normalizeMersisNo("01234567890123AB"), /16 haneli/);
  });
});

describe("normalizeKepAddress / normalizeContactEmail", () => {
  it("lower-cases and validates", () => {
    assert.equal(normalizeKepAddress(" Firma@HS01.kep.tr "), "firma@hs01.kep.tr");
    assert.equal(normalizeContactEmail("Info@Firma.com"), "info@firma.com");
    assert.equal(normalizeKepAddress(""), null);
    assert.equal(normalizeContactEmail(undefined), null);
  });

  it("rejects something that is not an address", () => {
    assert.throws(() => normalizeKepAddress("firma"), /KEP/);
    assert.throws(() => normalizeContactEmail("a b@c.com"), /İletişim e-postası/);
  });
});
