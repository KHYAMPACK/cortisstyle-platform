import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOrderConfirmationEmail,
  buildOwnerNewOrderEmail,
  type OrderMailOrder,
} from "./templates";

const brand = { name: "Örnek Mağaza", logoAbsoluteUrl: null };

function order(overrides: Partial<OrderMailOrder> = {}): OrderMailOrder {
  return {
    number: "A1B2C3D4",
    customerName: "Ayşe Yılmaz",
    customerEmail: "ayse@example.com",
    customerPhone: "05551112233",
    lines: [
      { title: "Çanta", option: null, quantity: 1, priceKurus: 125000 },
      { title: "Elbise", option: "Beden: M", quantity: 2, priceKurus: 99900 },
    ],
    discountKurus: 0,
    discountLabel: null,
    shippingKurus: 12000,
    totalKurus: 336800,
    addressLines: ["Atatürk Cd. No:1", "Merkezefendi / Denizli"],
    paid: true,
    ...overrides,
  };
}

describe("buildOrderConfirmationEmail", () => {
  it("greets by first name, shows lines, shipping and total", () => {
    const mail = buildOrderConfirmationEmail({
      brand,
      order: order(),
      orderUrl: "https://shop.example/siparis-onay?order=1&token=t",
      supportEmail: "destek@example.com",
    });
    assert.equal(mail.subject, "Örnek Mağaza — siparişiniz alındı (#A1B2C3D4)");
    assert.match(mail.html, /Merhaba Ayşe/);
    assert.match(mail.html, /Çanta/);
    assert.match(mail.html, /Beden: M/);
    assert.match(mail.html, /× 2/);
    assert.match(mail.html, /Siparişimi görüntüle/);
    assert.match(mail.html, /destek@example\.com/);
    assert.match(mail.text, /Toplam: /);
    assert.match(mail.text, /Teslimat adresi:/);
  });

  it("says the order is waiting for payment when it isn't paid", () => {
    const mail = buildOrderConfirmationEmail({
      brand,
      order: order({ paid: false }),
      orderUrl: null,
      supportEmail: "destek@example.com",
    });
    assert.match(mail.subject, /siparişiniz kaydedildi/);
    assert.match(mail.html, /Ödemeniz onaylandığında/);
    assert.doesNotMatch(mail.html, /Siparişimi görüntüle/);
  });

  it("shows free shipping and a named discount", () => {
    const mail = buildOrderConfirmationEmail({
      brand,
      order: order({ shippingKurus: 0, discountKurus: 5000, discountLabel: "Yaz İndirimi" }),
      orderUrl: null,
      supportEmail: "destek@example.com",
    });
    assert.match(mail.html, /Ücretsiz/);
    assert.match(mail.html, /Yaz İndirimi/);
  });

  it("escapes anything a shopper typed", () => {
    const mail = buildOrderConfirmationEmail({
      brand,
      order: order({
        customerName: "<script>alert(1)</script>",
        addressLines: ['"><img src=x onerror=alert(1)>'],
      }),
      orderUrl: null,
      supportEmail: "destek@example.com",
    });
    assert.doesNotMatch(mail.html, /<script>alert/);
    assert.doesNotMatch(mail.html, /<img src=x/);
  });
});

describe("buildOwnerNewOrderEmail", () => {
  it("names the customer, the state and links to the panel", () => {
    const mail = buildOwnerNewOrderEmail({
      brand,
      order: order(),
      panelUrl: "https://www.cortisstyle.com/tr/panel/siparisler/abc",
    });
    assert.match(mail.subject, /^Yeni sipariş #A1B2C3D4 — /);
    assert.match(mail.html, /Ayşe Yılmaz sipariş verdi/);
    assert.match(mail.html, /Ödendi/);
    assert.match(mail.html, /05551112233/);
    assert.match(mail.html, /Siparişi aç/);
  });

  it("flags an unpaid order", () => {
    const mail = buildOwnerNewOrderEmail({
      brand,
      order: order({ paid: false }),
      panelUrl: "https://www.cortisstyle.com/tr/panel/siparisler/abc",
    });
    assert.match(mail.html, /Ödeme bekleniyor/);
  });
});
