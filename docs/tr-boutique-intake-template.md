# TR boutique client intake template

> Fill this in with the client, then save it as a JSON file matching the shape below and run:
> `npx tsx scripts/create-boutique.mts --intake path/to/client.json`
>
> This maps 1:1 onto `POST /api/tr/admin/seed`'s payload (`src/app/api/tr/admin/seed/route.ts`) — the checklist below and the script accept exactly the same fields, so they can't drift out of sync. Only `slug` and `name` are required; everything else falls back to a sensible platform default if left out (see `docs/agent-handoffs/03-multi-tenant-boutiques.md`), but the fields marked **recommended** are worth getting from the client up front since they feed the legal pages (`docs/tr-boutique-legal-templates.md`) and checkout copy.

## Checklist

**Identity**
- [ ] `slug` — URL slug, lowercase, no spaces (e.g. `ornek-butik`). This becomes `/tr/{slug}`.
- [ ] `name` — display brand name.
- [ ] `legalName` (recommended) — legal seller name for invoices/legal pages, if different from brand name. For a company: the full ticari unvan ("… Ltd. Şti." / "… A.Ş.").
- [ ] `vergiNo` (recommended) — tax ID, for the künye page.
- [ ] `vergiDairesi` (recommended) — tax office, for the künye page (e.g. `Pamukkale`).
- [ ] `mersisNo` — 16-digit MERSİS number (registered companies).
- [ ] `kepAddress` — KEP address (registered companies).
- [ ] `iban` — for payouts, once payments are connected (see `docs/agent-handoffs/05-owner-panel-commerce.md` — this is a separate, later step, not part of store creation).

**Contact**
- [ ] `contactEmail` (recommended) — shown to shoppers and used as the reply-to of order e-mails; falls back to `info@{customDomain}` or the platform default if omitted. Use a mailbox the client actually reads.
- [ ] `whatsappPhone` (recommended) — shown on storefront + used in legal pages.
- [ ] `instagramHandle`
- [ ] `physicalAddress` (recommended) — for legal pages (künye, mesafeli satış).

**Brand**
- [ ] `logoUrl` — optional here: the owner can upload the logo in Ayarlar → Logo after signing in. If you do set it in the intake, use a path under `public/tr/boutiques/{slug}/`. **Ask for a PNG** (square-ish, transparent or white background): sign-up, password-reset and order emails reuse this logo, many email clients don't show SVG, and the browser-tab icon comes from it too.
- [ ] `themeAccent` — hex color.
- [ ] `description` — short storefront description.

**Ads & analytics (optional)**
- [ ] `tracking` — `{ "gtmId": "GTM-…", "ga4Id": "G-…", "metaPixelId": "…", "googleAdsId": "AW-…", "googleAdsPurchaseLabel": "…" }`, any subset. Needs `supabase/patch_tr_boutiques_company_and_tracking.sql` applied. Tags load only after the visitor accepts cookies. With a `gtmId` set, the GA4 and Google Ads ids are **not** loaded directly (GTM is expected to carry them; events go to its `dataLayer` in GA4 shape), while the Meta pixel id still loads directly — so don't also add the Meta pixel inside GTM. Can also be set later in Ayarlar.

**Storefront**
- [ ] `catalogProfile` — `"fashion"` or `"custom_art"`. See doc 06/07.
- [ ] `customDomain` — if they have one, as `www.<domain>`. **Leave it out until DNS works** (setting it makes `/tr/{slug}` redirect to the domain); add it later from Ayarlar/DB. DNS and Vercel domain setup are separate steps (doc 03 §"Onboarding a new boutique", step 8).
- [ ] `status` — defaults to `verified`, which makes the store public immediately. Use `"draft"` to keep it hidden until you flip it.
- [ ] `shippingNote` / `exchangePolicy` — free-text, used in legal pages and PDP copy. Falls back to default kargo/iade copy if omitted.
- [ ] `shippingFeeTry` (recommended) — flat kargo fee shoppers pay per order, in TRY (e.g. `120`). **Omit it and shoppers are not charged for shipping at all.**
- [ ] `freeShippingMinItems` **or** `freeShippingMinSubtotalTry` — optional free-shipping threshold: orders with at least N items, or an items subtotal of at least N TRY, ship free. Set at most one. Leave both out and the fee always applies.

**Page copy (optional)**
- [ ] `editorialContent` — free-form homepage/SEO copy. `seo`: `{ "title": "…", "description": "…" }` (the browser title and search snippet). For a store on the `natural` skin: `natural`: `{ "announcement", "hero": { "eyebrow", "title", "body", "primaryLabel" }, "usps": [..], "producers": { "title", "body" }, "story": { "eyebrow", "title", "body", "ctaLabel", "ctaHref" } }` — see doc 04. Anything left out falls back to a default built from the store's name, description and categories.

**Starter products (optional)**
- [ ] `products` — array of `{ title, priceTry, sizes?, colors?, category?, images?, stock? }`. Can be left empty and added later via the panel or the batch upload flow.

**Not covered by this intake — separate steps**
- Categories: a `"fashion"` store starts with the fashion category tree. For any other kind of store replace it with `scripts/set-boutique-categories.mts` (doc 03, step 3b) before adding products.
- Owner login: the client signs up themselves at `/giris` after the store exists. Then run `scripts/link-tr-boutique-owner.mts` to connect their account.
- Payments (iyzico): run `scripts/set-boutique-iyzico-credentials.mts --slug <slug>` yourself with the client's API + secret key (live keys, from their iyzico merchant panel). There is no owner-facing "connect your keys" UI yet (Phase 3, not built). Until a row exists, checkout creates pending orders and the owner marks them paid by hand.
- Legal review: these are internal templates, not legal advice — see the banner in `docs/tr-boutique-legal-templates.md`.

## JSON shape (paste into a file, fill in, save)

```json
{
  "slug": "",
  "name": "",
  "legalName": "",
  "vergiNo": "",
  "vergiDairesi": "",
  "mersisNo": "",
  "kepAddress": "",
  "contactEmail": "",
  "whatsappPhone": "",
  "instagramHandle": "",
  "physicalAddress": "",
  "logoUrl": "",
  "themeAccent": "",
  "description": "",
  "tracking": {},
  "catalogProfile": "fashion",
  "shippingFeeTry": 120,
  "freeShippingMinItems": 2,
  "shippingNote": "",
  "exchangePolicy": "",
  "products": []
}
```

Remove any empty fields you don't have yet rather than sending them as empty strings — an omitted field falls back to the platform default; an explicit empty string may not.

## After running the script

1. Send the client the storefront link (`/tr/{slug}`) and ask them to sign up at `/giris`.
2. Link their account: `npx tsx scripts/link-tr-boutique-owner.mts --email <their-email> --slug <slug>`.
3. Log the time from "yes" to here in `docs/onboarding-time-log.md`.
4. Run the go-live check (`GET /api/tr/admin/boutiques/{id}/go-live-check`, Bearer `TR_ADMIN_SECRET`) before telling the client they're live. It reports the shipping fee rules as well as the carrier mode.
