-- Repair the production schema drift exposed by Build 76.
--
-- The client saves all Pro logbook preferences in one upsert. Production had
-- not received the show_video column from migration 0040, so PostgREST rejected
-- otherwise valid route-name changes before updating either preference.

begin;

alter table public.logbook_preferences
  add column if not exists show_video boolean not null default true;

-- Build 76 already calls the current 11-argument log_climb function. Refresh
-- PostgREST's schema cache so both this column and that RPC signature are
-- immediately available to installed TestFlight builds.
notify pgrst, 'reload schema';

commit;
