-- Keep evidence of the affirmative age/Terms/Privacy click made during
-- signup. Rows are append-only to app users and use the database clock.

begin;

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  age_13_confirmed boolean not null check (age_13_confirmed),
  accepted_at timestamptz not null default now(),
  unique (user_id, terms_version, privacy_version)
);

alter table public.legal_acceptances enable row level security;

drop policy if exists "Users can read own legal acceptances"
  on public.legal_acceptances;
create policy "Users can read own legal acceptances"
  on public.legal_acceptances
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on public.legal_acceptances from anon, authenticated;
grant select on public.legal_acceptances to authenticated;

create or replace function public.accept_current_legal_terms(
  p_terms_version text,
  p_privacy_version text,
  p_age_13_confirmed boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_terms_version <> '2026-08-17'
     or p_privacy_version <> '2026-08-17'
     or p_age_13_confirmed is not true then
    raise exception 'Current age and legal terms must be accepted';
  end if;

  insert into public.legal_acceptances (
    user_id,
    terms_version,
    privacy_version,
    age_13_confirmed
  ) values (
    current_user_id,
    p_terms_version,
    p_privacy_version,
    true
  )
  on conflict (user_id, terms_version, privacy_version) do nothing;
end;
$$;

revoke all on function public.accept_current_legal_terms(text, text, boolean)
  from public, anon;
grant execute on function public.accept_current_legal_terms(text, text, boolean)
  to authenticated;

commit;
