-- Klimb gym de-duplication cleanup.
-- Appended to gym-import.sql so a fresh import can't leave duplicate map pins.
-- Two passes, both re-point user data (routes/home/visiting) before deleting:
--   1. Same physical place within 250 m, OR same name (accent-folded) whose
--      variant is a prefix of the other within 3 km  → merge (variants/rebrands).
--   2. Belt-and-suspenders exact-coincidence merge within 60 m.
-- Keeps the best-described row (has a city, longest name, oldest).

DO $$
BEGIN
  CREATE TEMP TABLE _lbl ON COMMIT DROP AS
  WITH RECURSIVE
    g AS (
      SELECT id, latitude AS la, longitude AS lo,
             regexp_replace(
               translate(lower(name),
                 'áàâäãåéèêëíìîïóòôöõúùûüñçß',
                 'aaaaaaeeeeiiiiooooouuuuncs'),
               '[^a-z0-9]', '', 'g') AS nk
      FROM gyms WHERE status='approved'
    ),
    dist AS (
      SELECT a.id AS a, b.id AS b, a.nk AS ank, b.nk AS bnk,
             (111320*sqrt(power(a.la-b.la,2)+power((a.lo-b.lo)*cos(radians(a.la)),2))) AS m
      FROM g a JOIN g b ON a.id <> b.id
        AND abs(a.la-b.la) < 0.03 AND abs(a.lo-b.lo) < 0.04
    ),
    edges AS (
      SELECT a, b FROM dist
      WHERE m <= 250
         OR ( m <= 3000 AND length(ank) >= 5 AND length(bnk) >= 5
              AND (ank = bnk OR ank LIKE bnk || '%' OR bnk LIKE ank || '%') )
    ),
    comp AS (
      SELECT id, id::text AS root FROM g
      UNION
      SELECT e.a, c.root FROM edges e JOIN comp c ON c.id = e.b
    )
  SELECT id, min(root) AS root FROM comp GROUP BY id;

  CREATE TEMP TABLE _keep ON COMMIT DROP AS
  SELECT DISTINCT ON (l.root) l.root, g.id AS keeper
  FROM _lbl l JOIN gyms g ON g.id = l.id
  ORDER BY l.root,
    (nullif(btrim(coalesce(g.city,'')),'') IS NOT NULL) DESC,
    length(g.name) DESC, g.created_at ASC, g.id ASC;

  CREATE TEMP TABLE _map ON COMMIT DROP AS
  SELECT l.id AS dup, k.keeper FROM _lbl l JOIN _keep k ON k.root = l.root
  WHERE l.id <> k.keeper;

  UPDATE routes r   SET gym_id=m.keeper          FROM _map m WHERE r.gym_id=m.dup;
  UPDATE profiles p SET home_gym_id=m.keeper     FROM _map m WHERE p.home_gym_id=m.dup;
  UPDATE profiles p SET visiting_gym_id=m.keeper FROM _map m WHERE p.visiting_gym_id=m.dup;
  DELETE FROM gyms g USING _map m WHERE g.id=m.dup;
END $$;

-- Sanity check — both should return 0.
SELECT
  (SELECT count(*) FROM (
     WITH g AS (SELECT id, latitude la, longitude lo FROM gyms WHERE status='approved')
     SELECT 1 FROM g a JOIN g b ON a.id<b.id
       AND (111320*sqrt(power(a.la-b.la,2)+power((a.lo-b.lo)*cos(radians(a.la)),2)))<=60) x
  ) AS overlapping_pairs;
