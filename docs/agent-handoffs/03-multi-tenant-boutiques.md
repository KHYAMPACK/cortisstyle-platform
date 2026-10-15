# 03 — Multi-tenant boutiques

**What this is:** the tenant model underneath the whole TR marketplace — how a "boutique" (a store like Lila Butik) is represented, how a request gets routed to the right one, and how a new one gets created. Read this before touching anything in `src/lib/tr/` that takes a `boutiqueSlug`/`boutiqueId`.

## The tenant model

One row in `tr_boutiques` = one boutique. Every product, order, and integration is scoped by `boutique_id`. There is no other tenancy mechanism (no subdomains-as-code, no per-tenant repo forks, no `if (slug === "...")` — every one of those got deleted at least once as dead weight during cleanup passes, most recently `pervinsoysalbutik`, `newtenant`, and `ozeltablo`).

Key columns on `tr_boutiques` (not exhaustive — check the live schema for the full list): `slug`, `name`, `owner_user_id`, `status`, `catalog_profile` (`"fashion"` | `"custom_art"` — see [06-fashion-module.md](./06-fashion-module.md) / [07-custom-art-module.md](./07-custom-art-module.md)), `custom_domain`, `contact_email`, `theme_accent`, `logo_url`, `whatsapp_phone`, `instagram_handle`, `size_presets`/`color_presets` (jsonb), `editorial_content` (jsonb), company details `legal_name`/`vergi_no`/`vergi_dairesi`/`mersis_no`/`kep_address`/`physical_address`, and `tracking` (jsonb ad/analytics ids — see [05](./05-owner-panel-commerce.md#conversion-tracking--cookie-consent)).

**As of 2026-09**, exactly **one real** boutique exists: `lilabutik` (fashion, live/verified, ~94 products, custom domain). The only other row is `deneme-butik`, an intentional test boutique for trying changes in production. Every other slug you might see referenced in older docs or code comments (`pervinsoysalbutik`, `newtenant`, `ozeltablo`, `minimora`, `demo-maya`) has been purged — `demo-maya` is the one partial exception: it's not a real tenant, but its stock photography is still served as shared template assets for every editorial-skin boutique (see doc 04). There is currently no live `custom_art` boutique — the module ([07-custom-art-module.md](./07-custom-art-module.md)) is kept as a validated reference pattern, not because anything uses it today.

Payments live in a separate table, `tr_boutique_integrations` (`boutique_id`, `provider`, `mode`, `enabled`, `credentials_encrypted` — AES-256-GCM via Node's `crypto`, `metadata`). One boutique can have zero or more integration rows; today the only provider is `"iyzico"`.

## Request → boutique resolution

Three paths reach a boutique:

1. **Platform path** — `/tr/{slug}/...`. The slug is just a URL param; no special resolution needed. Since the Store URLs work (below), this is no longer a *canonical* address for a boutique — it's a redirect source once one exists.
2. **Custom domain** — `src/proxy.ts` (this is a customized Next.js fork; the file that would be `middleware.ts` elsewhere is `proxy.ts` here) calls `resolveBoutiqueSlugFromHostAtEdge(host)` in `src/lib/tr/customDomain.ts`, which resolves the request's `Host` header to a slug and rewrites the path to `/tr/{slug}/...` via `rewriteBoutiqueDomainPath()`.
3. **Default subdomain** (`<slug>.<TR_STORES_DOMAIN>`) — same rewrite as a custom domain, but resolved by pure host parsing (`resolveSlugFromStoresSubdomain`/`subdomainSlugOf`, no DB), and only once the boutique's slug is confirmed to exist (an unknown subdomain 404s rather than falling through to platform routing).

**`tr_boutiques.custom_domain` is the source of truth** for domain resolution, read through `tr_boutiques_public` with a short-TTL in-memory cache per warm edge instance (`EDGE_DOMAIN_MAP_TTL_MS`, `src/lib/tr/customDomain.ts` — the cache now also tracks every boutique's slug → custom domain, not just the ones with one, so `proxy.ts` can check a subdomain's existence and look up a redirect target for a bare slug). The `TR_BOUTIQUE_DOMAINS` env var (a JSON host→slug map) is only an ops override for a host that isn't in the DB yet — e.g. while testing DNS before the row is set. Nothing about domain routing requires a code change.

`resolveBoutiqueSlugFromHostAtEdge()` is the *only* place that ever derives a slug from a **custom-domain** host — everything downstream (SEO, favicon, auth redirect, the boutique-slug React context) reads the `x-boutique-slug` header `proxy.ts` stamps, rather than re-deriving it. `resolveSlugFromStoresSubdomain()` is its subdomain-host counterpart.

### Store URLs — canonical host and redirects (built 2026-09-29)

Every boutique has a **canonical host**: its custom domain if connected, else its default subdomain once `TR_STORES_DOMAIN` is set, else nothing yet (in which case it's still only reachable via the platform path, exactly as before this work). `canonicalStoreHost()` / `resolveStoreHostKind()` / `resolveCanonicalRedirect()` (`src/lib/tr/seo/storeAddress.ts`) are the single decision layer every consumer shares: `proxy.ts` (308s a stray variant to the canonical host before doing anything else — the platform's `/tr/<slug>/…`, a subdomain once a custom domain is connected, `www.` on a custom domain), `sitemap.ts` (drops a boutique with a canonical host from the platform's cross-listing, matching how ikas never cross-lists a merchant store from its own marketing-site sitemap), and the Google feed (`resolveMerchantStoreOrigin`, product `link`s always point at the canonical host). `robots.ts` needed no change — it's already host-aware via the stamped header.

This is fully inert wherever `TR_STORES_DOMAIN` is unset for a boutique without a custom domain — nothing redirects, nothing is dropped from the sitemap, identical to today's behavior. It is **not** inert for a boutique that already has a custom domain (lilabutik): its platform-path duplicate and `www.` variant now redirect immediately, regardless of `TR_STORES_DOMAIN`. See `docs/product-upload-foundation-plan.md`'s "Store URLs" section for the full design and what's still open (ops setting `TR_STORES_DOMAIN` + wildcard DNS/cert, then validating the subdomain path against `deneme-butik` in production).

## Onboarding a new boutique

Mostly a database operation, and there's a tool for it now (Phase 1B, `docs/phase1b-onboarding-tooling-plan.md`):

1. **Decide the vertical** — `catalogProfile: "fashion"` or `"custom_art"`. A genuinely new third vertical is real engineering work (see doc 06's "when you actually need to write code" section), not covered here.
2. **Fill in the intake** (`docs/tr-boutique-intake-template.md`) with the client, save it as a JSON file.
3. **Create the row**: `npx tsx scripts/create-boutique.mts --intake path/to/client.json`. Wraps `POST /api/tr/admin/seed` (`src/app/api/tr/admin/seed/route.ts` has the full payload shape if you need to call it directly) — idempotent, safe to re-run. Nothing gets committed to the repo for this; the intake JSON stays local, and the seed API doesn't read from disk (the old `src/data/tr/{slug}-seed.json` pattern is gone).
4. **Payments** (if taking real money): `scripts/set-boutique-iyzico-credentials.mts --slug <slug>` writes the encrypted `tr_boutique_integrations` row from the client's own iyzico keys (hidden prompt, checked against iyzico first; the script header is the runbook). **Whoever holds the keys runs it, locally** — don't paste live keys into chat or an agent session. Until a row exists, checkout creates **pending** orders and the owner marks them paid manually. There is no owner-facing "connect your own keys" UI yet (Phase 3). See [05](./05-owner-panel-commerce.md#payments-iyzico).
5. **Link an owner**: owner signs up via `/giris` themselves — there's no invite-email flow (a deliberate Phase 1B decision, not an oversight; see the plan doc). Then `npx tsx scripts/link-tr-boutique-owner.mts --email <theirs> --slug <slug>` (or `PATCH /api/tr/admin/boutiques/{id}/owner` directly). One owner login per store.
6. **Logo/favicon**: upload the logo in Ayarlar → Logo (or, before the owner exists, drop a file under `public/tr/boutiques/{slug}/` and reference it from `logoUrl`). Use a **square-ish PNG**: auth and order e-mails reuse the logo and skip SVGs (`authMail/templates.ts`), and the tab icon on the store's own domain comes from it too (a direct `/favicon.ico` request still falls back to Cortisstyle's — see the table below).
7. **Company details, tracking tags**: `vergiDairesi`, `mersisNo`, `kepAddress`, `contactEmail`, and `tracking` (GTM / GA4 / Meta pixel / Google Ads) are in the intake and editable in Ayarlar. They need `supabase/patch_tr_boutiques_company_and_tracking.sql` applied first (see [05](./05-owner-panel-commerce.md#conversion-tracking--cookie-consent)).
8. **Custom domain** (optional): add **both** the apex and `www.<domain>` to the Vercel project (apex redirects to `www`), have the client point DNS, add the domain to Supabase Auth's redirect allow-list, then set `tr_boutiques.custom_domain` to **`www.<domain>`**. **Leave it empty until DNS works**: once it is set, `/tr/<slug>` 308s to the domain, so a not-yet-resolving domain makes the store unreachable. Do pre-launch QA on `/tr/<slug>`. `src/proxy.ts` handles the rewrite automatically. Ask early who controls DNS **and mail (MX)** — moving nameservers can break their e-mail.
9. **Go-live check**: `GET /api/tr/admin/boutiques/{id}/go-live-check` (Bearer `TR_ADMIN_SECRET`) — a real pass/fail readiness list (products exist, storefront renders, contact email set, legal fields populated incl. vergi dairesi, MERSİS/KEP, logo, tracking tags, payment/shipping mode, domain resolves if set, Merchant feed valid). Run this before telling the client they're live, not the older `boutique-health` route — that one checks Supabase/RLS infra health, a different concern.
10. **Log the time** from "yes" to live in `docs/onboarding-time-log.md` — that log is what decides whether anything here is worth automating further.

**Status of a new boutique.** `create-boutique.mts` defaults to status `verified`, which is what makes the storefront public (`tr_boutiques_public` only shows `verified` rows). The store is therefore live at `/tr/<slug>` the moment it is created — there is no staging state. Pass a different status in the intake if the client must not be reachable yet.

**What a non-fashion store gets.** The homepage is built from the store's own products and categories (`buildDataDrivenDefaults` in `boutiqueHome/editorialContent.ts`, non-atelier skins only — Lila's pack is pinned by tests), not the demo fashion copy; the PDP shows the garment care block only for fashion products or categories with a care guide, and its returns copy says "e-posta" instead of "WhatsApp" when the store has no WhatsApp number; legal pages say "çevrimiçi mağaza" rather than "moda butiği".

**Known limits to tell a client up front:** invoices (e-fatura/e-arşiv) are manual — there is no integration; carrier labels and tracking are automatic only for stores with a carrier integration (just Lila's Basit Kargo today), everyone else sets status/tracking by hand; card payments are iyzico only (no havale/EFT or kapıda ödeme flow); one owner login per store; no Ticimax importer and no legacy-URL redirect map (a migrating client's catalog is entered or batch-uploaded, and old Ticimax URLs 404 unless redirects are added).

Smoke test after onboarding: storefront loads at `/tr/{slug}`, a sized product can be added to cart, `/giris` shows branded auth, checkout creates a pending order (or, with iyzico connected and `TR_CHECKOUT_SANDBOX` off, a real payment that you refund afterwards) that shows up in the owner panel, both the customer and owner got the order e-mail, owner can create/hide a product.

## The few remaining per-slug code touches

Optional polish, not blockers, except the carrier integration for a store that wants automatic labels — everything else is DB-driven:

| Concern | File | If you skip it |
|---|---|---|
| Editorial visual skin (`classic` vs `atelier`) | `src/lib/tr/boutiqueHome/editorialSkin.ts` (`SLUG_SKINS` map — no DB equivalent) | Boutique gets `classic` |
| Brand color/logo/favicon/title fallback | `src/lib/tr/storefront/boutiqueBrand.ts` | DB `theme_accent`/`logo_url`/`name` are read directly — only add an override here if you need to show something *different* from the DB |
| Favicon on the store's own domain / subdomain | `src/lib/tr/seo/hostFavicon.ts` → `resolveBoutiqueFaviconFilePath` (code map in `boutiqueBrand.ts`, no DB fallback) | Browser tab shows the Cortisstyle favicon on the store's domain. On hold with the editorial-skin work (`docs/lilabutik-foundation-migration-plan.md`, C.5) |
| Live carrier integration (Basit Kargo label purchase/tracking) | `src/lib/tr/shipping/registry.ts` (`SHIPPING_BY_SLUG`) | Boutique uses manual status updates with its own carrier. This is only the carrier — the shipping **fee** shoppers pay is per-boutique DB config, set in the intake (`shippingFeeTry`, `freeShippingMinItems` \| `freeShippingMinSubtotalTry`). Moves to per-boutique credentials in roadmap P4-T2 |

If you find yourself writing a new `if (slug === "...")` anywhere outside these files, stop — it almost certainly belongs in a DB column instead. This exact pattern (a hardcoded per-slug check leaking into otherwise-generic code) has been deleted from checkout, shipping, and homepage code at least twice already.

## Code map

| Concern | Path |
|---|---|
| Boutique CRUD (admin) | `src/lib/tr/boutiques.ts`, `src/app/api/tr/admin/boutiques/`, `src/app/api/tr/admin/seed/` |
| Domain routing | `src/lib/tr/customDomain.ts`, `src/proxy.ts`, `src/lib/tr/seo/storeAddress.ts` (canonical host + redirect decision) |
| Brand helpers | `src/lib/tr/storefront/boutiqueBrand.ts` |
| Catalog profile / vertical capabilities | `src/lib/tr/catalogProfiles/` |
| Owner auth | `src/lib/tr/ownerAuth.ts`, `src/lib/tr/panel/ownerClient.ts` |
| Payments registry | `src/lib/tr/payments/registry.ts` |
| Paths | `src/lib/tr/paths.ts` |

## Related

- Storefront rendering once a boutique is resolved: [04-storefront-editorial-home.md](./04-storefront-editorial-home.md)
- Owner panel and commerce: [05-owner-panel-commerce.md](./05-owner-panel-commerce.md)
- Fashion vertical: [06-fashion-module.md](./06-fashion-module.md)
- Custom-art vertical: [07-custom-art-module.md](./07-custom-art-module.md)
- Platform env/ops: [11-platform-ops.md](./11-platform-ops.md)
- Onboarding tooling background/decisions: `docs/phase1b-onboarding-tooling-plan.md`
- Client intake checklist: `docs/tr-boutique-intake-template.md`
