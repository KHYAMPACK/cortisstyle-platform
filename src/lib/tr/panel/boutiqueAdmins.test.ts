import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { confirmedEmailOf, normalizeAdminEmail } from "./boutiqueAdmins";

describe("normalizeAdminEmail", () => {
  it("cleans a real address and rejects anything else", () => {
    assert.equal(normalizeAdminEmail("  Gizem.Ekiz@Gmail.com "), "gizem.ekiz@gmail.com");
    for (const bad of ["", "no-at-sign", "a@b", "a b@c.com", "a@b@c.com", 5, null, undefined]) {
      assert.equal(normalizeAdminEmail(bad), null, String(bad));
    }
    assert.equal(normalizeAdminEmail(`${"a".repeat(250)}@x.com`), null);
  });
});

describe("confirmedEmailOf", () => {
  it("gives an address only once the person has confirmed it", () => {
    assert.equal(
      confirmedEmailOf({ email: "A@B.com", email_confirmed_at: "2026-10-18T10:00:00Z" }),
      "a@b.com",
    );
    assert.equal(confirmedEmailOf({ email: "a@b.com", email_confirmed_at: undefined }), null);
    assert.equal(
      confirmedEmailOf({ email: undefined, email_confirmed_at: "2026-10-18T10:00:00Z" }),
      null,
    );
  });
});
