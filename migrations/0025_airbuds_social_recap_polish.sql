-- Build 63 social polish: emoji reactions and privacy-aware public friend lists.

begin;

alter table public.profiles
  add column if not exists friends_public boolean not null default true;

-- Store new reactions as the emoji itself. Keep the three legacy names valid
-- so Build 62 remains compatible while Build 63 rolls through TestFlight.
alter table public.activity_reactions
  drop constraint if exists activity_reactions_reaction_check;

alter table public.activity_reactions
  add constraint activity_reactions_reaction_check check (
    reaction in ('clap', 'fire', 'strong')
    or (
      char_length(reaction) between 1 and 16
      and reaction !~ '[[:alnum:][:space:][:cntrl:]]'
    )
  );

-- Public profiles may expose their accepted-friends list. The function never
-- returns a list when the owner has made it private and filters both sides of
-- blocks so privacy is enforced even if the client is modified.
create or replace function public.get_profile_friends(p_profile_id uuid)
returns table(
  id uuid,
  display_name text,
  username text,
  avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select auth.uid() as id
  ), friend_ids as (
    select case
      when f.requester_id = p_profile_id then f.addressee_id
      else f.requester_id
    end as friend_id
    from public.friendships f
    cross join viewer v
    where f.status = 'accepted'
      and v.id is not null
      and (f.requester_id = p_profile_id or f.addressee_id = p_profile_id)
      and (
        v.id = p_profile_id
        or exists (
          select 1 from public.profiles owner
          where owner.id = p_profile_id and owner.friends_public
        )
      )
  )
  select p.id, p.display_name, p.username, p.avatar_url
  from friend_ids f
  join public.profiles p on p.id = f.friend_id
  cross join viewer v
  where not exists (
    select 1 from public.blocks b
    where (b.blocker_id = v.id and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = v.id)
       or (b.blocker_id = v.id and b.blocked_id = p_profile_id)
       or (b.blocker_id = p_profile_id and b.blocked_id = v.id)
  )
  order by lower(p.display_name), p.id
  limit 250;
$$;

revoke all on function public.get_profile_friends(uuid) from public, anon;
grant execute on function public.get_profile_friends(uuid) to authenticated;

commit;
