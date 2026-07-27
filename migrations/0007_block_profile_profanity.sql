-- Prevent profanity in future profile display names and usernames.
-- Client validation gives an immediate friendly message; this trigger is the
-- server-side backstop so direct API writes cannot bypass the rule.

create or replace function public.profile_name_is_clean(input text)
returns boolean
language sql
immutable
set search_path = public
as $$
  with raw as (
    select
      regexp_replace(
        translate(lower(coalesce(input, '')), '013457@$', 'oieastsas'),
        '(.)\1{2,}',
        '\1\1',
        'g'
      ) as value
  ),
  normalized as (
    select
      regexp_replace(value, '[^a-z]', '', 'g') as compact,
      regexp_split_to_array(
        regexp_replace(value, '[^a-z]+', ' ', 'g'),
        '\s+'
      ) as words
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
set search_path = public
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

drop trigger if exists trg_profiles_clean_names on public.profiles;
create trigger trg_profiles_clean_names
  before insert or update of display_name, username on public.profiles
  for each row execute function public.enforce_clean_profile_names();
