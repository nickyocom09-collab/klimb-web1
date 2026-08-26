-- Apple requires a method for filtering objectionable user-generated content.
-- The app already gives immediate client feedback; these triggers are the
-- server-side backstop for direct API calls or modified clients.

begin;

-- Re-declare the core normalizer so this hardening migration is safe even on
-- an older production project that missed the original profile-name migration.
create or replace function public.profile_name_is_clean(input text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  with raw as (
    select regexp_replace(
      translate(lower(coalesce(input, '')), '013457@$', 'oieastsas'),
      '(.)\1{2,}',
      '\1\1',
      'g'
    ) as value
  ),
  normalized as (
    select
      regexp_replace(value, '[^a-z]', '', 'g') as compact,
      regexp_split_to_array(regexp_replace(value, '[^a-z]+', ' ', 'g'), '\s+') as words
    from raw
  )
  select not (
    compact ~ '(fuck|motherfuck|shithead|bullshit|bitch|cunt|whore|slut|douche|faggot|nigger|nigga|retard|kike|chink|spic)'
    or words && array['ass', 'dick', 'cock', 'pussy', 'shit', 'damn', 'bastard']
  )
  from normalized;
$$;

create or replace function public.enforce_clean_profile_names()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not public.profile_name_is_clean(new.display_name) then
    raise exception 'Display name contains prohibited language'
      using errcode = '23514';
  end if;
  if new.username is not null
     and not public.profile_name_is_clean(new.username) then
    raise exception 'Username contains prohibited language'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.content_text_is_clean(input text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select input is null or public.profile_name_is_clean(input);
$$;

drop trigger if exists trg_profiles_clean_names on public.profiles;
create trigger trg_profiles_clean_names
  before insert or update of display_name, username on public.profiles
  for each row execute function public.enforce_clean_profile_names();

create or replace function public.enforce_clean_route_content()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not public.content_text_is_clean(new.name)
     or not public.content_text_is_clean(new.description)
     or not public.content_text_is_clean(new.wall_section) then
    raise exception 'Route details contain prohibited language'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_clean_send_note()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not public.content_text_is_clean(new.note) then
    raise exception 'Climb note contains prohibited language'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_clean_comment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not public.content_text_is_clean(new.body) then
    raise exception 'Comment contains prohibited language'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_clean_project_note()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not public.content_text_is_clean(new.body) then
    raise exception 'Project note contains prohibited language'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_clean_personal_log()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not public.content_text_is_clean(new.route_name)
     or not public.content_text_is_clean(new.note) then
    raise exception 'Log entry contains prohibited language'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_routes_clean_content on public.routes;
create trigger trg_routes_clean_content
  before insert or update of name, description, wall_section on public.routes
  for each row execute function public.enforce_clean_route_content();

drop trigger if exists trg_sends_clean_note on public.sends;
create trigger trg_sends_clean_note
  before insert or update of note on public.sends
  for each row execute function public.enforce_clean_send_note();

drop trigger if exists trg_comments_clean_body on public.comments;
create trigger trg_comments_clean_body
  before insert or update of body on public.comments
  for each row execute function public.enforce_clean_comment();

drop trigger if exists trg_project_notes_clean_body on public.project_notes;
create trigger trg_project_notes_clean_body
  before insert or update of body on public.project_notes
  for each row execute function public.enforce_clean_project_note();

drop trigger if exists trg_personal_logs_clean_content on public.personal_logs;
create trigger trg_personal_logs_clean_content
  before insert or update of route_name, note on public.personal_logs
  for each row execute function public.enforce_clean_personal_log();

commit;
