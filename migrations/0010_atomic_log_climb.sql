-- Save a complete log as one transaction.
-- The previous ten-routes-per-day trigger did not fit Klimb's model, where
-- each logged climb creates a route row, and failed multi-step saves could
-- consume the whole allowance with partial data.

drop trigger if exists trg_routes_rate_limit on public.routes;

create or replace function public.log_climb(
  p_gym_id uuid,
  p_photo_url text,
  p_hold_color text,
  p_climbing_type text,
  p_gym_grade integer,
  p_felt_grade integer,
  p_stars integer,
  p_outcome text,
  p_note text
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

  insert into public.routes (
    gym_id,
    photo_url,
    hold_color,
    climbing_type,
    gym_grade,
    created_by
  )
  values (
    p_gym_id,
    p_photo_url,
    p_hold_color,
    p_climbing_type::public.climbing_type,
    p_gym_grade,
    v_user_id
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
      route_id,
      user_id,
      send_type,
      attempts,
      note
    )
    values (
      v_route_id,
      v_user_id,
      p_outcome,
      1,
      v_note
    );
  end if;

  return v_route_id;
end;
$$;

revoke all on function public.log_climb(
  uuid, text, text, text, integer, integer, integer, text, text
) from public;

grant execute on function public.log_climb(
  uuid, text, text, text, integer, integer, integer, text, text
) to authenticated;
