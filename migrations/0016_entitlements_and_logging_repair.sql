-- Klimb access control and StoreKit entitlement cache.
--
-- The database is the authority for access. The iOS client may submit an
-- Apple-signed transaction to the Edge Function, but it cannot write an
-- entitlement directly. Founder grants use auth.users.created_at and server
-- time; client clocks and profile payloads are never trusted.

create table if not exists public.entitlement_config (
  singleton boolean primary key default true check (singleton),
  founders_lifetime_pro_enabled boolean not null default true,
  founders_cutoff_at timestamptz not null default '2026-08-31 23:59:59+00',
  monthly_product_id text not null default 'com.nickyocom.klimb.pro.monthly',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.entitlement_config (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free'
    check (plan in ('free', 'pro_monthly', 'lifetime_pro')),
  entitlement_type text not null default 'free'
    check (entitlement_type in ('free', 'founder', 'manual_lifetime', 'subscription', 'trial')),
  entitlement_status text not null default 'inactive'
    check (entitlement_status in (
      'inactive', 'active', 'trial', 'grace_period', 'billing_retry',
      'expired', 'revoked'
    )),
  is_lifetime_pro boolean not null default false,
  founder_granted_at timestamptz,
  manual_granted_at timestamptz,
  subscription_product_id text,
  original_transaction_id text,
  subscription_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  expiration_date timestamptz,
  last_verified_at timestamptz,
  environment text check (environment is null or environment in ('Sandbox', 'Production', 'Xcode')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_entitlements_original_transaction_uidx
  on public.user_entitlements (original_transaction_id)
  where original_transaction_id is not null;

create table if not exists public.entitlement_transactions (
  transaction_id text primary key,
  original_transaction_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  environment text not null,
  purchase_date timestamptz,
  expires_date timestamptz,
  revocation_date timestamptz,
  offer_type integer,
  signed_payload_sha256 text not null,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists entitlement_transactions_user_idx
  on public.entitlement_transactions (user_id, verified_at desc);
create index if not exists entitlement_transactions_original_idx
  on public.entitlement_transactions (original_transaction_id);

create table if not exists public.entitlement_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.entitlement_audit_log (
  id bigint generated always as identity primary key,
  target_user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists entitlement_audit_target_idx
  on public.entitlement_audit_log (target_user_id, created_at desc);

create table if not exists public.entitlement_analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null check (event_name in (
    'pricing_screen_viewed',
    'trial_started',
    'subscription_purchased',
    'purchase_canceled',
    'purchase_pending',
    'purchase_failed',
    'purchase_restored',
    'trial_converted',
    'subscription_expired',
    'founder_lifetime_pro_granted',
    'upgrade_prompt_viewed'
  )),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_entitlement_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_user_entitlements_updated_at on public.user_entitlements;
create trigger trg_user_entitlements_updated_at
before update on public.user_entitlements
for each row execute function public.touch_entitlement_updated_at();

drop trigger if exists trg_entitlement_config_updated_at on public.entitlement_config;
create trigger trg_entitlement_config_updated_at
before update on public.entitlement_config
for each row execute function public.touch_entitlement_updated_at();

create or replace function public.grant_founder_lifetime_pro()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_config public.entitlement_config%rowtype;
  v_account_created_at timestamptz;
  v_previous jsonb;
  v_granted_at timestamptz := now();
begin
  select * into v_config
  from public.entitlement_config
  where singleton = true;

  select created_at into v_account_created_at
  from auth.users
  where id = new.id;

  if coalesce(v_config.founders_lifetime_pro_enabled, false)
     and v_account_created_at is not null
     and v_account_created_at <= v_config.founders_cutoff_at then
    select to_jsonb(e) into v_previous
    from public.user_entitlements e
    where e.user_id = new.id;

    insert into public.user_entitlements (
      user_id,
      plan,
      entitlement_type,
      entitlement_status,
      is_lifetime_pro,
      founder_granted_at,
      last_verified_at
    )
    values (
      new.id,
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

    if v_previous is null then
      insert into public.entitlement_audit_log (
        target_user_id, action, new_value, reason
      )
      select new.id,
             'founder_lifetime_pro_granted',
             to_jsonb(e),
             'Eligible account created before the configured founder cutoff.'
      from public.user_entitlements e
      where e.user_id = new.id;

      insert into public.entitlement_analytics_events (user_id, event_name)
      values (new.id, 'founder_lifetime_pro_granted');
    end if;
  else
    insert into public.user_entitlements (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_founder_entitlement on public.profiles;
create trigger trg_profiles_founder_entitlement
after insert on public.profiles
for each row execute function public.grant_founder_lifetime_pro();

-- Backfill one row per existing account, then grant all already-registered
-- users who meet the same server-verified founder rule. This makes "created
-- before the cutoff" consistent whether the account predates this migration or
-- is created after it.
insert into public.user_entitlements (user_id)
select id from auth.users
on conflict (user_id) do nothing;

update public.user_entitlements e
set plan = 'lifetime_pro',
    entitlement_type = 'founder',
    entitlement_status = 'active',
    is_lifetime_pro = true,
    founder_granted_at = coalesce(e.founder_granted_at, now()),
    last_verified_at = now()
from auth.users u, public.entitlement_config c
where e.user_id = u.id
  and c.singleton = true
  and c.founders_lifetime_pro_enabled
  and u.created_at <= c.founders_cutoff_at
  and not e.is_lifetime_pro;

insert into public.entitlement_audit_log (
  target_user_id, action, new_value, reason
)
select
  e.user_id,
  'founder_lifetime_pro_granted',
  to_jsonb(e),
  'Existing eligible account backfilled during entitlement launch.'
from public.user_entitlements e
where e.entitlement_type = 'founder'
  and e.founder_granted_at is not null
  and not exists (
    select 1
    from public.entitlement_audit_log a
    where a.target_user_id = e.user_id
      and a.action = 'founder_lifetime_pro_granted'
  );

insert into public.entitlement_analytics_events (user_id, event_name)
select e.user_id, 'founder_lifetime_pro_granted'
from public.user_entitlements e
where e.entitlement_type = 'founder'
  and not exists (
    select 1
    from public.entitlement_analytics_events a
    where a.user_id = e.user_id
      and a.event_name = 'founder_lifetime_pro_granted'
  );

create or replace function public.is_entitlement_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.entitlement_admins
    where user_id = auth.uid()
  );
$$;

create or replace function public.record_entitlement_event(
  p_event_name text,
  p_properties jsonb default '{}'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.entitlement_analytics_events (
    user_id, event_name, properties
  )
  values (
    auth.uid(),
    p_event_name,
    coalesce(p_properties, '{}'::jsonb) - 'transaction_id' - 'signed_payload'
  );
end;
$$;

create or replace function public.admin_set_founder_config(
  p_enabled boolean,
  p_cutoff_at timestamptz
)
returns public.entitlement_config
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous jsonb;
  v_result public.entitlement_config;
begin
  if not public.is_entitlement_admin() then
    raise exception 'Administrative access required.';
  end if;

  select to_jsonb(c) into v_previous
  from public.entitlement_config c
  where singleton = true;

  update public.entitlement_config
  set founders_lifetime_pro_enabled = p_enabled,
      founders_cutoff_at = p_cutoff_at,
      updated_by = auth.uid()
  where singleton = true
  returning * into v_result;

  insert into public.entitlement_audit_log (
    actor_user_id, action, previous_value, new_value, reason
  )
  values (
    auth.uid(),
    'founder_config_updated',
    v_previous,
    to_jsonb(v_result),
    'Founder access configuration changed by an entitlement administrator.'
  );

  return v_result;
end;
$$;

create or replace function public.admin_grant_lifetime_pro(
  p_user_id uuid,
  p_reason text
)
returns public.user_entitlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous jsonb;
  v_result public.user_entitlements;
begin
  if not public.is_entitlement_admin() then
    raise exception 'Administrative access required.';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'An audit reason is required.';
  end if;

  select to_jsonb(e) into v_previous
  from public.user_entitlements e
  where user_id = p_user_id;

  insert into public.user_entitlements (
    user_id, plan, entitlement_type, entitlement_status,
    is_lifetime_pro, manual_granted_at, last_verified_at
  )
  values (
    p_user_id, 'lifetime_pro', 'manual_lifetime', 'active',
    true, now(), now()
  )
  on conflict (user_id) do update
    set plan = 'lifetime_pro',
        entitlement_type = 'manual_lifetime',
        entitlement_status = 'active',
        is_lifetime_pro = true,
        manual_granted_at = now(),
        last_verified_at = now()
  returning * into v_result;

  insert into public.entitlement_audit_log (
    target_user_id, actor_user_id, action,
    previous_value, new_value, reason
  )
  values (
    p_user_id, auth.uid(), 'manual_lifetime_granted',
    v_previous, to_jsonb(v_result), p_reason
  );

  return v_result;
end;
$$;

create or replace function public.admin_get_user_entitlement(
  p_user_id uuid
)
returns public.user_entitlements
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result public.user_entitlements;
begin
  if not public.is_entitlement_admin() then
    raise exception 'Administrative access required.';
  end if;
  select * into v_result
  from public.user_entitlements
  where user_id = p_user_id;
  return v_result;
end;
$$;

create or replace function public.admin_revoke_manual_lifetime_pro(
  p_user_id uuid,
  p_reason text
)
returns public.user_entitlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous public.user_entitlements;
  v_result public.user_entitlements;
begin
  if not public.is_entitlement_admin() then
    raise exception 'Administrative access required.';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'An audit reason is required.';
  end if;

  select * into v_previous
  from public.user_entitlements
  where user_id = p_user_id
  for update;

  if v_previous.entitlement_type <> 'manual_lifetime'
     or v_previous.founder_granted_at is not null then
    raise exception 'Only a non-founder manual lifetime grant can be revoked.';
  end if;

  update public.user_entitlements
  set plan = case
        when subscription_product_id is not null
         and current_period_ends_at > now()
        then 'pro_monthly'
        else 'free'
      end,
      entitlement_type = case
        when trial_ends_at > now() then 'trial'
        when subscription_product_id is not null
         and current_period_ends_at > now()
        then 'subscription'
        else 'free'
      end,
      entitlement_status = case
        when trial_ends_at > now() then 'trial'
        when subscription_product_id is not null
         and current_period_ends_at > now()
        then 'active'
        else 'revoked'
      end,
      is_lifetime_pro = false,
      manual_granted_at = null,
      last_verified_at = now()
  where user_id = p_user_id
  returning * into v_result;

  insert into public.entitlement_audit_log (
    target_user_id, actor_user_id, action,
    previous_value, new_value, reason
  )
  values (
    p_user_id, auth.uid(), 'manual_lifetime_revoked',
    to_jsonb(v_previous), to_jsonb(v_result), p_reason
  );

  return v_result;
end;
$$;

alter table public.entitlement_config enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.entitlement_transactions enable row level security;
alter table public.entitlement_admins enable row level security;
alter table public.entitlement_audit_log enable row level security;
alter table public.entitlement_analytics_events enable row level security;

drop policy if exists "Users read own entitlement" on public.user_entitlements;
create policy "Users read own entitlement"
on public.user_entitlements for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users read own transaction history" on public.entitlement_transactions;
create policy "Users read own transaction history"
on public.entitlement_transactions for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins read entitlement config" on public.entitlement_config;
create policy "Admins read entitlement config"
on public.entitlement_config for select
to authenticated
using (public.is_entitlement_admin());

drop policy if exists "Admins read admin roster" on public.entitlement_admins;
create policy "Admins read admin roster"
on public.entitlement_admins for select
to authenticated
using (public.is_entitlement_admin());

drop policy if exists "Admins read entitlement audit" on public.entitlement_audit_log;
create policy "Admins read entitlement audit"
on public.entitlement_audit_log for select
to authenticated
using (public.is_entitlement_admin());

drop policy if exists "Users insert safe entitlement analytics" on public.entitlement_analytics_events;
create policy "Users insert safe entitlement analytics"
on public.entitlement_analytics_events for insert
to authenticated
with check (user_id = auth.uid());

revoke all on public.entitlement_config from anon, authenticated;
revoke all on public.user_entitlements from anon, authenticated;
revoke all on public.entitlement_transactions from anon, authenticated;
revoke all on public.entitlement_admins from anon, authenticated;
revoke all on public.entitlement_audit_log from anon, authenticated;
revoke all on public.entitlement_analytics_events from anon, authenticated;

grant select on public.user_entitlements to authenticated;
grant select on public.entitlement_transactions to authenticated;
grant insert on public.entitlement_analytics_events to authenticated;

revoke all on function public.is_entitlement_admin() from public;
grant execute on function public.is_entitlement_admin() to authenticated;
revoke all on function public.record_entitlement_event(text, jsonb) from public;
grant execute on function public.record_entitlement_event(text, jsonb) to authenticated;
revoke all on function public.admin_set_founder_config(boolean, timestamptz) from public;
grant execute on function public.admin_set_founder_config(boolean, timestamptz) to authenticated;
revoke all on function public.admin_grant_lifetime_pro(uuid, text) from public;
grant execute on function public.admin_grant_lifetime_pro(uuid, text) to authenticated;
revoke all on function public.admin_revoke_manual_lifetime_pro(uuid, text) from public;
grant execute on function public.admin_revoke_manual_lifetime_pro(uuid, text) to authenticated;
revoke all on function public.admin_get_user_entitlement(uuid) from public;
grant execute on function public.admin_get_user_entitlement(uuid) to authenticated;

-- Repair the complete logging function in the same release. This makes the
-- deployment safe even if the route-name migration was skipped on production.
alter table public.profiles
  add column if not exists route_names_enabled boolean not null default false;
alter table public.routes
  add column if not exists name text;

drop function if exists public.log_climb(
  uuid, text, text, text, integer, integer, integer, text, text
);
drop function if exists public.log_climb(
  uuid, text, text, text, integer, integer, integer, text, text, text
);

create function public.log_climb(
  p_gym_id uuid,
  p_photo_url text,
  p_hold_color text,
  p_climbing_type text,
  p_gym_grade integer,
  p_felt_grade integer,
  p_stars integer,
  p_outcome text,
  p_note text,
  p_name text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_route_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if v_user_id is null then
    raise exception 'You must be signed in to log a Klimb.';
  end if;
  if p_climbing_type not in ('boulder', 'toprope', 'lead') then
    raise exception 'Invalid climbing type.';
  end if;
  if p_outcome not in ('flash', 'send', 'project') then
    raise exception 'Invalid Klimb outcome.';
  end if;
  if p_stars is not null and (p_stars < 1 or p_stars > 5) then
    raise exception 'Rating must be between 1 and 5.';
  end if;
  if v_name is not null and char_length(v_name) > 80 then
    raise exception 'Route names must be 80 characters or fewer.';
  end if;

  insert into public.routes (
    gym_id, photo_url, hold_color, climbing_type,
    gym_grade, name, created_by
  )
  values (
    p_gym_id, p_photo_url, p_hold_color,
    p_climbing_type::public.climbing_type,
    p_gym_grade, v_name, v_user_id
  )
  returning id into v_route_id;

  if p_felt_grade is not null then
    insert into public.grades (route_id, user_id, grade)
    values (v_route_id, v_user_id, p_felt_grade);
  end if;
  if p_stars is not null then
    insert into public.route_ratings (route_id, user_id, stars)
    values (v_route_id, v_user_id, p_stars);
  end if;

  if p_outcome = 'project' then
    insert into public.bookmarks (user_id, route_id, kind)
    values (v_user_id, v_route_id, 'project');
    if v_note is not null then
      insert into public.project_notes (user_id, route_id, body)
      values (v_user_id, v_route_id, v_note);
    end if;
  else
    insert into public.sends (
      route_id, user_id, send_type, attempts, note
    )
    values (
      v_route_id, v_user_id, p_outcome, 1, v_note
    );
  end if;

  return v_route_id;
end;
$$;

revoke all on function public.log_climb(
  uuid, text, text, text, integer, integer, integer, text, text, text
) from public;
grant execute on function public.log_climb(
  uuid, text, text, text, integer, integer, integer, text, text, text
) to authenticated;
