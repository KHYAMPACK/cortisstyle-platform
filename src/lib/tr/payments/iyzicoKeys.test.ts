import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IYZICO_BASE_URL,
  iyzicoModeOf,
  iyzicoStatusLabel,
  lastFour,
  NOT_CONNECTED,
  readIyzicoKeysInput,
} from "./iyzicoKeys";

describe("readIyzicoKeysInput", () => {
  it("accepts two different keys and trims them", () => {
    const input = readIyzicoKeysInput({
      apiKey: "  AbCdEf1234567890  ",
      secretKey: "ZyXwVu0987654321",
    });
    assert.deepEqual(input, {
      apiKey: "AbCdEf1234567890",
      secretKey: "ZyXwVu0987654321",
      mode: "live",
    });
  });

  it("recognises sandbox keys by their prefix", () => {
    assert.equal(iyzicoModeOf("sandbox-AbCdEf123456"), "sandbox");
    assert.equal(iyzicoModeOf("SANDBOX-abc"), "sandbox");
    assert.equal(iyzicoModeOf("AbCdEf1234567890"), "live");
    assert.equal(
      readIyzicoKeysInput({ apiKey: "sandbox-Abcdef1234", secretKey: "sandbox-Zyxwvu9876" }).mode,
      "sandbox",
    );
    assert.equal(IYZICO_BASE_URL.sandbox.includes("sandbox"), true);
    assert.equal(IYZICO_BASE_URL.live.includes("sandbox"), false);
  });

  it("explains what is wrong, without repeating the key", () => {
    const bad: Array<[unknown, RegExp]> = [
      [{}, /API anahtarı gerekli/],
      [{ apiKey: "short", secretKey: "ZyXwVu0987654321" }, /API anahtarı geçerli görünmüyor/],
      [{ apiKey: "AbCdEf 1234567890", secretKey: "ZyXwVu0987654321" }, /boşluk içermemeli/],
      [{ apiKey: "AbCdEf1234567890", secretKey: "" }, /Güvenlik anahtarı gerekli/],
      [{ apiKey: "AbCdEf1234567890", secretKey: "AbCdEf1234567890" }, /aynı olamaz/],
      [{ apiKey: "AbCdEf123456789ö", secretKey: "ZyXwVu0987654321" }, /geçersiz karakter/],
      [{ apiKey: "x".repeat(200), secretKey: "ZyXwVu0987654321" }, /geçerli görünmüyor/],
    ];
    for (const [body, message] of bad) {
      assert.throws(() => readIyzicoKeysInput(body), (error: Error) => {
        assert.match(error.message, message);
        assert.equal(error.message.includes("AbCdEf1234567890"), false);
        return true;
      });
    }
    assert.throws(() => readIyzicoKeysInput(null), /API anahtarı gerekli/);
  });
});

describe("what the panel shows of a key", () => {
  it("shows only the last four characters", () => {
    assert.equal(lastFour("AbCdEf1234567890"), "7890");
    assert.equal(lastFour("abc"), "");
    assert.equal(
      iyzicoStatusLabel({ connected: true, mode: "live", apiKeyLast4: "7890" }),
      "Bağlı · Canlı · anahtar …7890",
    );
    assert.equal(
      iyzicoStatusLabel({ connected: true, mode: "sandbox", apiKeyLast4: null }),
      "Bağlı · Deneme (sandbox)",
    );
    assert.equal(iyzicoStatusLabel(NOT_CONNECTED), "Bağlı değil");
  });
});
