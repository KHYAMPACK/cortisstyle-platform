-- Company details a registered seller must show, and the per-store ad/analytics IDs.
--
--   vergi_dairesi   tax office, shown on the künye ("Hakkımızda / Künye") page and the
--                   contracts next to the vergi no.
--   mersis_no       MERSİS number (16 digits), required on a company's künye page.
--   kep_address     KEP (registered e-mail) address, shown on the künye page.
--   tracking        the store's public ad / analytics IDs, as JSON:
--                   { metaPixelId, ga4Id, gtmId, googleAdsId, googleAdsPurchaseLabel }.
--                   Public identifiers only — never a secret or an API token. Validated
--                   in code (lib/tr/tracking/config.ts) before it is stored.
--
-- All four are shown on the storefront (künye page / tracking scripts), so they are
-- added to tr_boutiques_public. CREATE OR REPLACE VIEW may only append columns, so the
-- existing ones are restated unchanged and the new ones come last. The view's security
-- setting, grants, and the tr_products read policy that depends on it are untouched.
--
-- Additive and safe to apply BEFORE the app version that reads these columns is
-- deployed (the deployed app ignores them). The app tolerates the patch being absent:
-- saves of the new fields report a clear error instead of breaking the other settings.
--
-- If this fails with "cannot change name of view column", the live view differs from
-- the one rebuilt here — nothing is changed (single transaction); send the output of
--   select pg_get_viewdef('public.tr_boutiques_public'::regclass, true);
--
-- Manual apply only (Supabase SQL editor). Not applied by the agent.

begin;

alter table public.tr_boutiques
  add column if not exists vergi_dairesi text,
  add column if not exists mersis_no text,
  add column if not exists kep_address text,
  add column if not exists tracking jsonb not null default '{}'::jsonb;

alter table public.tr_boutiques
  drop constraint if exists tr_boutiques_mersis_no_check;
alter table public.tr_boutiques
  add constraint tr_boutiques_mersis_no_check
  check (mersis_no is null or mersis_no ~ '^[0-9]{16}$');

alter table public.tr_boutiques
  drop constraint if exists tr_boutiques_tracking_is_object_check;
alter table public.tr_boutiques
  add constraint tr_boutiques_tracking_is_object_check
  check (jsonb_typeof(tracking) = 'object');

comment on column public.tr_boutiques.vergi_dairesi is
  'Tax office, shown next to vergi_no on the künye page and contracts.';
comment on column public.tr_boutiques.mersis_no is
  'MERSİS number (16 digits) for the künye page. Null = not shown.';
comment on column public.tr_boutiques.kep_address is
  'KEP (registered e-mail) address for the künye page. Null = not shown.';
comment on column public.tr_boutiques.tracking is
  'Public ad/analytics IDs: metaPixelId, ga4Id, gtmId, googleAdsId, googleAdsPurchaseLabel. Never secrets.';

create or replace view public.tr_boutiques_public
with (security_invoker = false)
as
select
  id,
  slug,
  name,
  legal_name,
  description,
  logo_url,
  whatsapp_phone,
  instagram_handle,
  theme_accent,
  shipping_note,
  exchange_policy,
  physical_address,
  custom_domain,
  editorial_content,
  catalog_profile,
  vergi_no,
  contact_email,
  status,
  created_at,
  updated_at,
  shipping_fee_kurus,
  free_shipping_min_items,
  free_shipping_min_subtotal_kurus,
  vergi_dairesi,
  mersis_no,
  kep_address,
  tracking
from public.tr_boutiques
where status = 'verified';

commit;
