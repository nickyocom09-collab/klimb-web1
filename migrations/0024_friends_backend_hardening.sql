-- Build 62: make profile posting private at the database boundary and expose
-- narrowly scoped friend/mutual/activity RPCs for the redesigned Friends UI.

begin;

-- A reversed pair (A -> B and B -> A) must never create two relationships.
create unique index if not exists friendships_unique_pair_idx
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

-- Per-Klimb visibility is enforced by RLS, not only by client filters.
drop policy if exists sends_select on public.sends;
create policy sends_select on public.sends
  for select using (
    user_id = auth.uid()
    or (
      profile_visible
      and exists (
        select 1 from public.profiles p
        where p.id = sends.user_id and p.sends_public
      )
    )
  );

drop policy if exists bookmarks_select on public.bookmarks;
create policy bookmarks_select on public.bookmarks
  for select using (
    user_id = auth.uid()
    or (
      kind = 'project'
      and profile_visible
      and exists (
        select 1 from public.profiles p
        where p.id = bookmarks.user_id and p.projects_public
      )
    )
  );

-- The old anonymous EXECUTE grant was left behind by an earlier function
-- replacement. Logging always requires an authenticated Supabase session.
revoke all on function public.log_climb(
  uuid, text, text, text, integer, integer, integer, text, text, text, boolean
) from public, anon;
grant execute on function public.log_climb(
  uuid, text, text, text, integer, integer, integer, text, text, text, boolean
) to authenticated;

create or replace function public.get_mutual_friend_counts(p_other_ids uuid[])
returns table(profile_id uuid, mutual_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select auth.uid() as id
  ),
  targets as (
    select distinct u.target_id
    from unnest(coalesce(p_other_ids[1:100], array[]::uuid[])) as u(target_id)
  ),
  my_friends as (
    select case
      when f.requester_id = v.id then f.addressee_id
      else f.requester_id
    end as friend_id
    from public.friendships f
    cross join viewer v
    where f.status = 'accepted'
      and v.id is not null
      and (f.requester_id = v.id or f.addressee_id = v.id)
  )
  select
    t.target_id as profile_id,
    count(distinct mf.friend_id)::integer as mutual_count
  from targets t
  cross join viewer v
  left join my_friends mf on exists (
    select 1
    from public.friendships tf
    where tf.status = 'accepted'
      and (
        (tf.requester_id = t.target_id and tf.addressee_id = mf.friend_id)
        or
        (tf.addressee_id = t.target_id and tf.requester_id = mf.friend_id)
      )
  )
  where v.id is not null
    and t.target_id <> v.id
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = v.id and b.blocked_id = t.target_id)
         or (b.blocker_id = t.target_id and b.blocked_id = v.id)
    )
  group by t.target_id;
$$;

revoke all on function public.get_mutual_friend_counts(uuid[]) from public, anon;
grant execute on function public.get_mutual_friend_counts(uuid[]) to authenticated;

create or replace function public.get_mutual_friends(p_other_id uuid)
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
  ),
  my_friends as (
    select case
      when f.requester_id = v.id then f.addressee_id
      else f.requester_id
    end as friend_id
    from public.friendships f
    cross join viewer v
    where f.status = 'accepted'
      and v.id is not null
      and (f.requester_id = v.id or f.addressee_id = v.id)
  )
  select p.id, p.display_name, p.username, p.avatar_url
  from my_friends mf
  join public.profiles p on p.id = mf.friend_id
  cross join viewer v
  where p_other_id <> v.id
    and exists (
      select 1 from public.friendships tf
      where tf.status = 'accepted'
        and (
          (tf.requester_id = p_other_id and tf.addressee_id = mf.friend_id)
          or
          (tf.addressee_id = p_other_id and tf.requester_id = mf.friend_id)
        )
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = v.id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = v.id)
    )
  order by lower(p.display_name), p.id
  limit 12;
$$;

revoke all on function public.get_mutual_friends(uuid) from public, anon;
grant execute on function public.get_mutual_friends(uuid) to authenticated;

-- Return a bounded number of public activities per accepted friend. This
-- prevents one very active climber from taking over the whole feed query.
create or replace function public.get_friend_activity(p_limit_per_friend integer default 6)
returns table(
  activity_kind text,
  activity_id uuid,
  activity_owner_id uuid,
  route_id uuid,
  send_type text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select auth.uid() as id
  ),
  friend_ids as (
    select case
      when f.requester_id = v.id then f.addressee_id
      else f.requester_id
    end as friend_id
    from public.friendships f
    cross join viewer v
    where f.status = 'accepted'
      and v.id is not null
      and (f.requester_id = v.id or f.addressee_id = v.id)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = v.id and b.blocked_id = case when f.requester_id = v.id then f.addressee_id else f.requester_id end)
           or (b.blocked_id = v.id and b.blocker_id = case when f.requester_id = v.id then f.addressee_id else f.requester_id end)
      )
  ),
  activity as (
    select
      'send'::text as activity_kind,
      s.id as activity_id,
      s.user_id as activity_owner_id,
      s.route_id,
      s.send_type::text as send_type,
      s.created_at
    from public.sends s
    join friend_ids f on f.friend_id = s.user_id
    join public.profiles p on p.id = s.user_id
    where s.profile_visible and p.sends_public and s.send_type <> 'attempt'

    union all

    select
      'project'::text,
      b.id,
      b.user_id,
      b.route_id,
      null::text,
      b.created_at
    from public.bookmarks b
    join friend_ids f on f.friend_id = b.user_id
    join public.profiles p on p.id = b.user_id
    where b.kind = 'project' and b.profile_visible and p.projects_public
  ),
  ranked as (
    select a.*,
      row_number() over (
        partition by a.activity_owner_id
        order by a.created_at desc, a.activity_id
      ) as friend_rank
    from activity a
  )
  select
    r.activity_kind,
    r.activity_id,
    r.activity_owner_id,
    r.route_id,
    r.send_type,
    r.created_at
  from ranked r
  where r.friend_rank <= greatest(1, least(coalesce(p_limit_per_friend, 6), 12))
  order by r.created_at desc, r.activity_id;
$$;

revoke all on function public.get_friend_activity(integer) from public, anon;
grant execute on function public.get_friend_activity(integer) to authenticated;

create or replace function public.can_react_to_friend_activity(
  p_activity_kind text,
  p_activity_id uuid,
  p_activity_owner_id uuid,
  p_route_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and auth.uid() <> p_activity_owner_id
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = p_activity_owner_id)
          or
          (f.addressee_id = auth.uid() and f.requester_id = p_activity_owner_id)
        )
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p_activity_owner_id)
         or (b.blocker_id = p_activity_owner_id and b.blocked_id = auth.uid())
    )
    and (
      (
        p_activity_kind = 'send'
        and exists (
          select 1
          from public.sends s
          join public.profiles p on p.id = s.user_id
          where s.id = p_activity_id
            and s.user_id = p_activity_owner_id
            and s.route_id = p_route_id
            and s.profile_visible
            and p.sends_public
        )
      )
      or
      (
        p_activity_kind = 'project'
        and exists (
          select 1
          from public.bookmarks b
          join public.profiles p on p.id = b.user_id
          where b.id = p_activity_id
            and b.user_id = p_activity_owner_id
            and b.route_id = p_route_id
            and b.kind = 'project'
            and b.profile_visible
            and p.projects_public
        )
      )
    );
$$;

revoke all on function public.can_react_to_friend_activity(text, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.can_react_to_friend_activity(text, uuid, uuid, uuid)
  to authenticated;

drop policy if exists activity_reactions_select on public.activity_reactions;
create policy activity_reactions_select on public.activity_reactions
  for select to authenticated using (
    reactor_id = auth.uid()
    or activity_owner_id = auth.uid()
    or public.can_react_to_friend_activity(
      activity_kind, activity_id, activity_owner_id, route_id
    )
  );

drop policy if exists activity_reactions_insert_own on public.activity_reactions;
create policy activity_reactions_insert_own on public.activity_reactions
  for insert to authenticated with check (
    reactor_id = auth.uid()
    and public.can_react_to_friend_activity(
      activity_kind, activity_id, activity_owner_id, route_id
    )
  );

drop policy if exists activity_reactions_update_own on public.activity_reactions;
create policy activity_reactions_update_own on public.activity_reactions
  for update to authenticated using (reactor_id = auth.uid())
  with check (
    reactor_id = auth.uid()
    and public.can_react_to_friend_activity(
      activity_kind, activity_id, activity_owner_id, route_id
    )
  );

commit;
