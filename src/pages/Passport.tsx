import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { CenterSpinner } from "../components/ui";

/** ISO alpha-2 -> emoji flag. */
function flag(cc: string): string {
  if (!cc || cc.length !== 2) return "🏳️";
  return cc
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

// Continent per ISO code — enough to cover the seeded set and common codes.
const CONTINENT: Record<string, string> = {
  us: "North America", ca: "North America", mx: "North America",
  br: "South America", ar: "South America", cl: "South America", co: "South America", pe: "South America",
  gb: "Europe", ie: "Europe", fr: "Europe", de: "Europe", es: "Europe", it: "Europe",
  nl: "Europe", be: "Europe", ch: "Europe", at: "Europe", se: "Europe", no: "Europe",
  dk: "Europe", fi: "Europe", is: "Europe", cz: "Europe", pl: "Europe", pt: "Europe",
  gr: "Europe", hu: "Europe", ro: "Europe", si: "Europe", sk: "Europe", hr: "Europe",
  jp: "Asia", kr: "Asia", cn: "Asia", hk: "Asia", tw: "Asia", sg: "Asia", th: "Asia",
  in: "Asia", id: "Asia", my: "Asia", ph: "Asia", vn: "Asia", ae: "Asia", il: "Asia", tr: "Asia",
  au: "Oceania", nz: "Oceania",
  za: "Africa", ma: "Africa", eg: "Africa", ke: "Africa", ng: "Africa",
};
const CONTINENT_ORDER = [
  "North America", "South America", "Europe", "Asia", "Oceania", "Africa",
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function fmtStampDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

type GymVisit = {
  id: string;
  name: string;
  city: string | null;
  firstVisit: string;
  sends: number;
};
type CountryStamp = {
  cc: string;
  country: string;
  continent: string;
  firstClimbed: string;
  gyms: GymVisit[];
  sends: number;
};

const GOLD = "#ffc24b";

export function Passport() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<CountryStamp[]>([]);
  const [homeGym, setHomeGym] = useState<{ name: string; cc: string | null; country: string | null } | null>(null);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<CountryStamp | null>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    (async () => {
      const { data: sends } = await supabase
        .from("sends")
        .select("route_id, created_at")
        .eq("user_id", profile.id)
        .neq("send_type", "attempt");
      const routeIds = [...new Set((sends ?? []).map((s) => s.route_id))];
      const { data: routes } = routeIds.length
        ? await supabase.from("routes").select("id, gym_id").in("id", routeIds)
        : { data: [] as { id: string; gym_id: string }[] };
      const routeGym = new Map((routes ?? []).map((r) => [r.id, r.gym_id]));
      const gymIds = [...new Set((routes ?? []).map((r) => r.gym_id))];
      const { data: gyms } = gymIds.length
        ? await supabase
            .from("gyms")
            .select("id, name, city, country, cc")
            .in("id", gymIds)
        : { data: [] as { id: string; name: string; city: string | null; country: string | null; cc: string | null }[] };
      const gymMap = new Map((gyms ?? []).map((g) => [g.id, g]));

      // Per-gym first visit + send count.
      const perGym = new Map<string, GymVisit>();
      for (const s of sends ?? []) {
        const gid = routeGym.get(s.route_id);
        if (!gid) continue;
        const g = gymMap.get(gid);
        if (!g) continue;
        const cur = perGym.get(gid);
        if (!cur) {
          perGym.set(gid, {
            id: gid,
            name: g.name,
            city: g.city,
            firstVisit: s.created_at,
            sends: 1,
          });
        } else {
          cur.sends += 1;
          if (s.created_at < cur.firstVisit) cur.firstVisit = s.created_at;
        }
      }

      // Group gyms into country stamps.
      const byCountry = new Map<string, CountryStamp>();
      for (const gv of perGym.values()) {
        const g = gymMap.get(gv.id)!;
        const cc = (g.cc ?? "xx").toLowerCase();
        const country = g.country ?? "Unknown";
        const cont = CONTINENT[cc] ?? "Elsewhere";
        const cur = byCountry.get(cc);
        if (!cur) {
          byCountry.set(cc, {
            cc,
            country,
            continent: cont,
            firstClimbed: gv.firstVisit,
            gyms: [gv],
            sends: gv.sends,
          });
        } else {
          cur.gyms.push(gv);
          cur.sends += gv.sends;
          if (gv.firstVisit < cur.firstClimbed) cur.firstClimbed = gv.firstVisit;
        }
      }
      const list = [...byCountry.values()].sort(
        (a, b) =>
          CONTINENT_ORDER.indexOf(a.continent) -
            CONTINENT_ORDER.indexOf(b.continent) ||
          a.country.localeCompare(b.country),
      );

      // Home gym for the ID page.
      let hg: typeof homeGym = null;
      if (profile.home_gym_id) {
        const { data: h } = await supabase
          .from("gyms")
          .select("name, country, cc")
          .eq("id", profile.home_gym_id)
          .maybeSingle();
        if (h) hg = { name: h.name, cc: h.cc, country: h.country };
      }

      if (!active) return;
      setCountries(list);
      setHomeGym(hg);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [profile]);

  // Build the spreads: cover, ID page, one chapter spread per continent, finale.
  const continents = useMemo(() => {
    const map = new Map<string, CountryStamp[]>();
    for (const c of countries) {
      const list = map.get(c.continent) ?? [];
      list.push(c);
      map.set(c.continent, list);
    }
    return CONTINENT_ORDER.filter((k) => map.has(k)).map((k) => ({
      name: k,
      stamps: map.get(k)!,
    }));
  }, [countries]);

  const totals = useMemo(() => {
    const conts = new Set(countries.map((c) => c.continent));
    const gymCount = countries.reduce((n, c) => n + c.gyms.length, 0);
    return { stamps: gymCount, countries: countries.length, continents: conts.size };
  }, [countries]);

  const pages = 2 + continents.length + 1; // cover + ID + chapters + finale
  const go = (d: number) => setPage((p) => Math.max(0, Math.min(pages - 1, p + d)));

  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (dx < -50) go(1);
    else if (dx > 50) go(-1);
  }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : "—";
  const climberName = (profile?.display_name ?? "Climber").toUpperCase();

  if (loading) {
    return (
      <div className="klimb-pp fixed inset-0 z-40 flex items-center justify-center">
        <CenterSpinner />
      </div>
    );
  }

  return (
    <div
      className="klimb-pp fixed inset-0 z-40 flex flex-col overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={() => navigate(-1)}
          aria-label="Close passport"
          className="rounded-full bg-black/40 p-2 text-white/80 backdrop-blur transition hover:text-white"
        >
          <X size={20} />
        </button>
        <div className="flex gap-1.5">
          {Array.from({ length: pages }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === page ? 22 : 6,
                background: i === page ? GOLD : "rgba(255,255,255,0.25)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Book track */}
      <div className="relative flex-1">
        <div
          className="flex h-full transition-transform duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(-${page * 100}%)`, width: `${pages * 100}%` }}
        >
          {/* 1. Cover */}
          <Spread>
            <div className="klimb-pp-cover relative flex h-full flex-col items-center justify-center gap-5 rounded-3xl">
              <Guilloche />
              <div className="klimb-foil relative flex h-24 w-24 items-center justify-center rounded-2xl">
                <MountainCrest />
              </div>
              <div className="relative text-center">
                <p
                  className="font-serif text-4xl font-bold tracking-[0.35em]"
                  style={{ color: GOLD }}
                >
                  KLIMB
                </p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.5em] text-white/60">
                  Climbing Passport
                </p>
              </div>
              <p className="relative mt-6 text-xs text-white/40">
                Tap or swipe to open →
              </p>
            </div>
          </Spread>

          {/* 2. Data / ID page */}
          <Spread>
            <div className="klimb-pp-page relative flex h-full flex-col rounded-3xl p-5">
              <Guilloche />
              <Topo />
              <p className="relative text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
                Klimb · Climbing Passport
              </p>
              <div className="relative mt-4 flex gap-4">
                <div
                  className="flex h-24 w-20 shrink-0 items-center justify-center rounded-lg text-3xl font-bold"
                  style={{ background: "rgba(255,255,255,0.06)", color: GOLD }}
                >
                  {climberName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1 font-mono text-sm">
                  <Field label="Climber" value={climberName} />
                  <Field label="Member since" value={memberSince} />
                  <Field label="Home gym" value={homeGym?.name ?? "—"} />
                  <Field
                    label="Home country"
                    value={
                      homeGym?.cc
                        ? `${flag(homeGym.cc)} ${homeGym.country ?? ""}`
                        : "—"
                    }
                  />
                </div>
              </div>

              <div className="relative mt-5 grid grid-cols-3 gap-2">
                <Stat n={totals.stamps} label="Stamps" />
                <Stat n={totals.countries} label="Countries" />
                <Stat n={totals.continents} label="Continents" />
              </div>

              <div className="relative mt-auto rounded-lg bg-black/40 p-3">
                <p className="break-all font-mono text-[11px] leading-relaxed tracking-wider text-white/70">
                  {mrz(climberName, homeGym?.cc ?? null, totals.stamps).map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          </Spread>

          {/* 3..n Chapter + stamp spreads */}
          {continents.map((cont) => (
            <Spread key={cont.name}>
              <div className="klimb-pp-page relative h-full overflow-y-auto rounded-3xl p-5">
                <Guilloche />
                <div className="relative mb-4 flex items-baseline justify-between border-b border-white/10 pb-2">
                  <h2 className="font-serif text-2xl font-bold text-white">
                    {cont.name}
                  </h2>
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    {cont.stamps.length} countr
                    {cont.stamps.length === 1 ? "y" : "ies"}
                  </span>
                </div>
                <div className="relative flex flex-wrap justify-center gap-3 pt-2">
                  {cont.stamps.map((s, i) => (
                    <button
                      key={s.cc}
                      onClick={() => setDetail(s)}
                      style={{ transform: `rotate(${((i % 5) - 2) * 4}deg)` }}
                      className="transition active:scale-95"
                    >
                      <Stamp stamp={s} />
                    </button>
                  ))}
                </div>
              </div>
            </Spread>
          ))}

          {/* Finale */}
          <Spread>
            <div className="klimb-pp-page relative flex h-full flex-col items-center justify-center gap-6 rounded-3xl p-6 text-center">
              <Guilloche />
              <Topo />
              <div className="relative">
                <p className="font-serif text-5xl font-bold" style={{ color: GOLD }}>
                  {totals.countries}
                </p>
                <p className="mt-1 text-sm uppercase tracking-[0.3em] text-white/60">
                  {totals.countries === 1 ? "country" : "countries"} stamped
                </p>
              </div>
              <div className="relative flex flex-wrap justify-center gap-2 px-4">
                {countries.map((c) => (
                  <span key={c.cc} className="text-2xl" title={c.country}>
                    {flag(c.cc)}
                  </span>
                ))}
                {countries.length === 0 ? (
                  <p className="max-w-xs text-sm text-white/60">
                    No stamps yet. Log a send at any gym and its country stamps
                    your passport — your first is one climb away.
                  </p>
                ) : null}
              </div>
              <p className="relative text-xs text-white/40">
                {totals.stamps} gyms · {totals.countries} countries ·{" "}
                {totals.continents} continents
              </p>
            </div>
          </Spread>
        </div>

        {/* Prev / next tap zones */}
        {page > 0 ? (
          <button
            onClick={() => go(-1)}
            aria-label="Previous page"
            className="absolute left-0 top-0 flex h-full w-[30%] items-center justify-start pl-2 text-white/0 active:text-white/60"
          >
            <ChevronLeft size={28} />
          </button>
        ) : null}
        {page < pages - 1 ? (
          <button
            onClick={() => go(1)}
            aria-label="Next page"
            className="absolute right-0 top-0 flex h-full w-[70%] items-center justify-end pr-2 text-white/0 active:text-white/60"
          >
            <ChevronRight size={28} />
          </button>
        ) : null}
      </div>

      {/* Stamp detail */}
      {detail ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 animate-fade-in"
          onClick={() => setDetail(null)}
        >
          <div
            className="klimb-pp-page w-full max-w-sm animate-pop rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-4xl">{flag(detail.cc)}</span>
              <div>
                <p className="font-serif text-xl font-bold text-white">
                  {detail.country}
                </p>
                <p className="text-xs uppercase tracking-wide text-white/50">
                  First climbed {fmtStampDate(detail.firstClimbed)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {detail.gyms.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {g.name}
                    </p>
                    <p className="truncate text-xs text-white/50">
                      {[g.city, fmtDate(g.firstVisit)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-xs font-bold tabular-nums"
                    style={{ color: GOLD }}
                  >
                    {g.sends} send{g.sends === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Spread({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full w-full shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-[9px] uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>
      <p className="truncate font-semibold text-white">{value}</p>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-xl bg-white/5 py-2.5 text-center">
      <p className="text-xl font-extrabold tabular-nums" style={{ color: GOLD }}>
        {n}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-white/50">{label}</p>
    </div>
  );
}

/** An inked visa stamp: arced country name, flag, dashed ring, date. */
function Stamp({ stamp }: { stamp: CountryStamp }) {
  const id = `arc-${stamp.cc}`;
  return (
    <svg width="118" height="118" viewBox="0 0 118 118" className="klimb-stamp">
      <defs>
        <path id={id} d="M 16 59 A 43 43 0 0 1 102 59" fill="none" />
      </defs>
      <circle cx="59" cy="59" r="52" fill="none" stroke={GOLD} strokeWidth="2.5" opacity="0.85" />
      <circle cx="59" cy="59" r="45" fill="none" stroke={GOLD} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
      <text fill={GOLD} fontSize="10" fontWeight="700" letterSpacing="1.5" opacity="0.9">
        <textPath
          href={`#${id}`}
          xlinkHref={`#${id}`}
          startOffset="50%"
          textAnchor="middle"
        >
          {stamp.country.toUpperCase().slice(0, 18)}
        </textPath>
      </text>
      <text x="59" y="68" textAnchor="middle" fontSize="34">
        {flag(stamp.cc)}
      </text>
      <text
        x="59"
        y="92"
        textAnchor="middle"
        fill={GOLD}
        fontSize="8"
        fontWeight="700"
        letterSpacing="1"
        opacity="0.85"
      >
        {fmtStampDate(stamp.firstClimbed)}
      </text>
    </svg>
  );
}

function MountainCrest() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <path
        d="M8 40 L22 16 L30 28 L36 20 L44 40 Z"
        fill="none"
        stroke={GOLD}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="26" cy="10" r="3" fill={GOLD} />
    </svg>
  );
}

/** Fine wavy security lines (guilloché), very low opacity. */
function Guilloche() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
      aria-hidden
    >
      {Array.from({ length: 14 }).map((_, i) => (
        <path
          key={i}
          d={`M0 ${8 + i * 6} Q 25 ${2 + i * 6}, 50 ${8 + i * 6} T 100 ${8 + i * 6}`}
          fill="none"
          stroke={GOLD}
          strokeWidth="0.4"
        />
      ))}
    </svg>
  );
}

/** Topographic contour watermark. */
function Topo() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05]"
      viewBox="0 0 200 200"
      aria-hidden
    >
      {[20, 34, 48, 62, 76, 90].map((r) => (
        <ellipse
          key={r}
          cx="130"
          cy="120"
          rx={r}
          ry={r * 0.72}
          fill="none"
          stroke="#4ADE80"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

/** Machine-readable zone — two lines, `<` fillers, from the climber's data. */
function mrz(name: string, cc: string | null, stamps: number): string[] {
  const pad = (s: string, n: number) =>
    (s + "<".repeat(n)).slice(0, n).replace(/ /g, "<");
  const surname = name.split(" ")[0] || "CLIMBER";
  const line1 = pad(`P<KLIMB<${surname}<<${name.replace(/ /g, "<")}`, 44);
  const country = (cc ?? "XX").toUpperCase();
  const line2 = pad(`${country}${String(stamps).padStart(3, "0")}KLIMB<<CLIMB<PASSPORT`, 44);
  return [line1, line2];
}
