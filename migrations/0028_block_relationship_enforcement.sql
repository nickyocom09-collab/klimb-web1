-- A block must be a complete social boundary, not merely a client-side hide.
-- Sever existing relationships and reject new direct interactions in either
-- direction while a block exists.

begin;

create or replace function public.cleanup_relationship_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where (requester_id = new.blocker_id and addressee_id = new.blocked_id)
     or (requester_id = new.blocked_id and addressee_id = new.blocker_id);

  delete from public.climb_shares
  where (from_user = new.blocker_id and to_user = new.blocked_id)
     or (from_user = new.blocked_id and to_user = new.blocker_id);

  return new;
end;
$$;

revoke all on function public.cleanup_relationship_on_block() from public, anon, authenticated;

drop trigger if exists cleanup_relationship_on_block_trigger on public.blocks;
create trigger cleanup_relationship_on_block_trigger
after insert on public.blocks
for each row execute function public.cleanup_relationship_on_block();

create or replace function public.reject_blocked_direct_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_user uuid;
  second_user uuid;
begin
  if tg_table_name = 'friendships' then
    first_user := new.requester_id;
    second_user := new.addressee_id;
  elsif tg_table_name = 'climb_shares' then
    first_user := new.from_user;
    second_user := new.to_user;
  elsif tg_table_name = 'activity_reactions' then
    first_user := new.reactor_id;
    second_user := new.activity_owner_id;
  else
    raise exception 'Unsupported social interaction.';
  end if;

  if exists (
    select 1
    from public.blocks b
    where (b.blocker_id = first_user and b.blocked_id = second_user)
       or (b.blocker_id = second_user and b.blocked_id = first_user)
  ) then
    raise exception 'This interaction is unavailable.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_blocked_direct_interaction() from public, anon, authenticated;

drop trigger if exists reject_blocked_friendship_trigger on public.friendships;
create trigger reject_blocked_friendship_trigger
before insert or update on public.friendships
for each row execute function public.reject_blocked_direct_interaction();

drop trigger if exists reject_blocked_share_trigger on public.climb_shares;
create trigger reject_blocked_share_trigger
before insert or update on public.climb_shares
for each row execute function public.reject_blocked_direct_interaction();

drop trigger if exists reject_blocked_reaction_trigger on public.activity_reactions;
create trigger reject_blocked_reaction_trigger
before insert or update on public.activity_reactions
for each row execute function public.reject_blocked_direct_interaction();

-- Bring existing rows in line with the new behavior immediately.
delete from public.friendships f
using public.blocks b
where (f.requester_id = b.blocker_id and f.addressee_id = b.blocked_id)
   or (f.requester_id = b.blocked_id and f.addressee_id = b.blocker_id);

delete from public.climb_shares s
using public.blocks b
where (s.from_user = b.blocker_id and s.to_user = b.blocked_id)
   or (s.from_user = b.blocked_id and s.to_user = b.blocker_id);

commit;
