-- Bind each Apple subscription chain to exactly one Klimb account.
--
-- Modern purchases carry a signed appAccountToken. Older TestFlight/App Store
-- transactions may not, so an authenticated Restore Purchase may create the
-- claim once. The primary key prevents the same original transaction from
-- ever being moved to a second account.

create table if not exists public.apple_subscription_claims (
  original_transaction_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  signed_account_token_present boolean not null default false,
  claimed_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now()
);

create index if not exists apple_subscription_claims_user_idx
  on public.apple_subscription_claims (user_id, last_verified_at desc);

insert into public.apple_subscription_claims (
  original_transaction_id,
  user_id,
  signed_account_token_present,
  claimed_at,
  last_verified_at
)
select
  e.original_transaction_id,
  e.user_id,
  true,
  coalesce(e.subscription_started_at, e.created_at, now()),
  coalesce(e.last_verified_at, e.updated_at, now())
from public.user_entitlements e
where e.original_transaction_id is not null
on conflict (original_transaction_id) do nothing;

insert into public.apple_subscription_claims (
  original_transaction_id,
  user_id,
  signed_account_token_present,
  claimed_at,
  last_verified_at
)
select distinct on (t.original_transaction_id)
  t.original_transaction_id,
  t.user_id,
  true,
  coalesce(t.purchase_date, t.created_at, now()),
  coalesce(t.verified_at, now())
from public.entitlement_transactions t
order by t.original_transaction_id, t.verified_at asc
on conflict (original_transaction_id) do nothing;

alter table public.apple_subscription_claims enable row level security;

revoke all on public.apple_subscription_claims from anon, authenticated;

comment on table public.apple_subscription_claims is
  'Server-only, immutable ownership binding for an Apple original transaction.';
