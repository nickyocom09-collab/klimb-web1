-- Keep Climb Bentonville's official circuit bands consistent anywhere routes
-- are logged, edited, or graded later.
update public.gyms
set grading_style = 'bands'
where lower(trim(name)) = 'climb bentonville';
