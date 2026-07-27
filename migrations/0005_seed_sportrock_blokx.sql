-- Sportrock Alexandria (5308 Eisenhower Ave., Alexandria, VA)
insert into public.gyms (
  name, city, state, country, cc, latitude, longitude, status, grading_style
)
select
  'Sportrock Alexandria', 'Alexandria', 'Virginia', 'United States', 'us',
  38.80113, -77.12614, 'approved', 'classic'
where not exists (
  select 1 from public.gyms
  where name = 'Sportrock Alexandria' and city = 'Alexandria'
);

-- Blokx (Strada Căprioarei 2, Târgu Mureș, Romania)
insert into public.gyms (
  name, city, state, country, cc, latitude, longitude, status, grading_style
)
select
  'Blokx', 'Târgu Mureș', 'Mureș', 'Romania', 'ro',
  46.55773, 24.56668, 'approved', 'classic'
where not exists (
  select 1 from public.gyms
  where name = 'Blokx' and cc = 'ro'
);
