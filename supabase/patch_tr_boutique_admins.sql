-- Extra panel admins for a store (besides its single owner login).
--
-- A store has one owner (tr_boutiques.owner_user_id). This table lets that store's team
-- sign in to the same panel with their own accounts: a row says "the person who has
-- confirmed this e-mail address is an admin of this store". They get the same panel
-- access as the owner, for that store only (never the platform-wide TR_PANEL_STAFF_EMAILS
-- access). Matching is by e-mail, so an admin can be added before they have an account;
-- access starts when they sign up and confirm that address.
--
-- Service-role only, like tr_boutique_integrations: RLS on, no policies.
-- Additive and safe to apply before the app version that reads it is deployed; the app
-- also works without it (admins just aren't found).
--
-- Manual apply only (Supabase SQL editor). Not applied by the agent.

create table if not exists public.tr_boutique_admins (
  id uuid primary key default gen_random_uuid(),
  boutique_id uuid not null references public.tr_boutiques (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%._%'),
  created_at timestamptz not null default now(),
  unique (boutique_id, email)
);

create index if not exists tr_boutique_admins_email_idx
  on public.tr_boutique_admins (email);

comment on table public.tr_boutique_admins is
  'Extra panel admins per store, matched by confirmed e-mail. Service-role only — never grant anon/authenticated access.';

alter table public.tr_boutique_admins enable row level security;
-- No policies: the service role bypasses RLS; anon/authenticated get no access.
