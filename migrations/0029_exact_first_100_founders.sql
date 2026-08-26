-- Exact founder campaign for Klimb's public launch.
--
-- Build 61 remains fully usable for everyone. This migration only records the
-- first 100 verified accounts created after the public launch and stores their
-- permanent entitlement for the later Pro release. The advisory transaction
-- lock prevents concurrent signups from exceeding the cap.

begin;

-- Retire the earlier date-based grant immediately. Existing grants are not
-- revoked here; they can be reviewed safely before the paid update ships.
update public.entitlement_config
set founders_lifetime_pro_enabled = false,
    updated_at = now()
where singleton = true;

create table if not exists public.founder_campaigns (
  campaign text primary key,
  starts_at timestamptz not null,
  max_founders integer not null check (max_founders between 1 and 10000),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.founder_campaigns (
  campaign,
  starts_at,
  max_founders,
  enabled
)
values (
  'public_launch_2026',
  timestamptz '2026-08-17 16:00:00+00', -- 11:00 AM CDT
  100,
  true
)
on conflict (campaign) do update
set starts_at = excluded.starts_at,
    max_founders = excluded.max_founders,
    enabled = excluded.enabled,
    updated_at = now();

create table if not exists public.founder_claims (
  campaign text not null references public.founder_campaigns(campaign),
  founder_number integer not null check (founder_number > 0),
  user_id uuid references auth.users(id) on delete set null,
  account_created_at timestamptz not null,
  account_verified_at timestamptz not null,
  claimed_at timestamptz not null default now(),
  primary key (campaign, founder_number)
);

create unique index if not exists founder_claims_campaign_user_uidx
  on public.founder_claims (campaign, user_id)
  where user_id is not null;

create or replace function public.claim_public_launch_founder(
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_campaign constant text := 'public_launch_2026';
  v_config public.founder_campaigns%rowtype;
  v_account_created_at timestamptz;
  v_account_verified_at timestamptz;
  v_founder_number integer;
  v_previous jsonb;
  v_granted_at timestamptz := now();
begin
  select created_at, email_confirmed_at
    into v_account_created_at, v_account_verified_at
  from auth.users
  where id = p_user_id
    and deleted_at is null;

  select * into v_config
  from public.founder_campaigns
  where campaign = v_campaign;

  if v_config.campaign is null
     or not v_config.enabled
     or v_account_created_at is null
     or v_account_verified_at is null
     or v_account_created_at < v_config.starts_at then
    return null;
  end if;

  -- One serialized allocator protects slots 1..100 from signup races.
  perform pg_advisory_xact_lock(hashtext('klimb_public_launch_founders_2026'));

  select founder_number into v_founder_number
  from public.founder_claims
  where campaign = v_campaign
    and user_id = p_user_id;

  if v_founder_number is not null then
    return v_founder_number;
  end if;

  select coalesce(max(founder_number), 0) + 1
    into v_founder_number
  from public.founder_claims
  where campaign = v_campaign;

  if v_founder_number > v_config.max_founders then
    return null;
  end if;

  insert into public.founder_claims (
    campaign,
    founder_number,
    user_id,
    account_created_at,
    account_verified_at,
    claimed_at
  ) values (
    v_campaign,
    v_founder_number,
    p_user_id,
    v_account_created_at,
    v_account_verified_at,
    v_granted_at
  );

  select to_jsonb(e) into v_previous
  from public.user_entitlements e
  where e.user_id = p_user_id;

  insert into public.user_entitlements (
    user_id,
    plan,
    entitlement_type,
    entitlement_status,
    is_lifetime_pro,
    founder_granted_at,
    last_verified_at
  ) values (
    p_user_id,
    'lifetime_pro',
    'founder',
    'active',
    true,
    v_granted_at,
    v_granted_at
  )
  on conflict (user_id) do update
  set plan = 'lifetime_pro',
      entitlement_type = 'founder',
      entitlement_status = 'active',
      is_lifetime_pro = true,
      founder_granted_at = coalesce(
        public.user_entitlements.founder_granted_at,
        excluded.founder_granted_at
      ),
      last_verified_at = excluded.last_verified_at;

  insert into public.entitlement_audit_log (
    target_user_id,
    action,
    previous_value,
    new_value,
    reason
  )
  select
    p_user_id,
    'founder_lifetime_pro_granted',
    v_previous,
    to_jsonb(e),
    format(
      'Public launch founder %s of %s.',
      v_founder_number,
      v_config.max_founders
    )
  from public.user_entitlements e
  where e.user_id = p_user_id;

  insert into public.entitlement_analytics_events (
    user_id,
    event_name,
    properties
  ) values (
    p_user_id,
    'founder_lifetime_pro_granted',
    jsonb_build_object(
      'campaign', v_campaign,
      'founder_number', v_founder_number,
      'max_founders', v_config.max_founders
    )
  );

  return v_founder_number;
end;
$$;

-- Keep the existing profile trigger name used by build 61's schema, but make
-- it call the exact-cap allocator instead of the retired date cutoff.
create or replace function public.grant_founder_lifetime_pro()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  perform public.claim_public_launch_founder(new.id);

  -- Every account gets an entitlement row, including accounts after #100.
  insert into public.user_entitlements (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_profiles_founder_entitlement on public.profiles;
create trigger trg_profiles_founder_entitlement
after insert on public.profiles
for each row execute function public.grant_founder_lifetime_pro();

-- Email/password profiles may be created before email confirmation. Claim the
-- slot only when Supabase marks that account verified. OAuth accounts are
-- already verified when the profile trigger runs.
drop trigger if exists trg_auth_user_founder_on_verification on auth.users;
create trigger trg_auth_user_founder_on_verification
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.grant_founder_lifetime_pro();

alter table public.founder_campaigns enable row level security;
alter table public.founder_claims enable row level security;

revoke all on table public.founder_campaigns from anon, authenticated;
revoke all on table public.founder_claims from anon, authenticated;
revoke all on function public.claim_public_launch_founder(uuid) from public;
revoke all on function public.grant_founder_lifetime_pro() from public;
-- Supabase may grant new public functions directly to its API roles through
-- default privileges, so remove those explicit grants as well.
revoke all on function public.claim_public_launch_founder(uuid)
  from anon, authenticated;
revoke all on function public.grant_founder_lifetime_pro()
  from anon, authenticated;

-- If this migration is applied after launch, claim any already-verified
-- launch accounts in deterministic verification/account order.
do $$
declare
  v_user record;
begin
  for v_user in
    select u.id
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.deleted_at is null
      and u.email_confirmed_at is not null
      and u.created_at >= timestamptz '2026-08-17 16:00:00+00'
    order by u.email_confirmed_at, u.created_at, u.id
  loop
    perform public.claim_public_launch_founder(v_user.id);
  end loop;
end;
$$;

commit;
