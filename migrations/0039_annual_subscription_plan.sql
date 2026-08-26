-- Add the verified annual Klimb Pro plan alongside the existing monthly plan.

begin;

alter table public.user_entitlements
  drop constraint if exists user_entitlements_plan_check;

alter table public.user_entitlements
  add constraint user_entitlements_plan_check
  check (plan in ('free', 'pro_monthly', 'pro_annual', 'lifetime_pro'));

commit;
