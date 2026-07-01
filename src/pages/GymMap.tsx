import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Globe from "react-globe.gl";
import { Check, Home, List, MapPin, Plane, Search, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Button, CenterSpinner } from "../components/ui";
import type { GymRow } from "../lib/database.types";

type GymWithCount = GymRow & { routeCount: number };

const ACCENT = "#39FF88";
const HOME = "#FFFFFF";

export function GymMap() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  // react-globe.gl exposes imperative methods via ref; loosely typed.
  const globeEl = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [gyms, setGyms] = useState<GymWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GymWithCount | null>(null);
  const [saving, setSaving] = useState<"home" | "visit" | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Measure the container so the globe fills the tab.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      supabase.from("gyms").select("*").eq("status", "approved"),
      supabase
        .from("routes")
        .select("gym_id")
        .eq("status", "active")
        .eq("hidden", false),
    ]).then(([{ data: g }, { data: r }]) => {
      if (!active) return;
      const counts = new Map<string, number>();
      for (const row of r ?? [])
        counts.set(row.gym_id, (counts.get(row.gym_id) ?? 0) + 1);
      const withCounts = (g ?? [])
        .filter((x) => x.latitude != null && x.longitude != null)
        .map((x) => ({ ...x, routeCount: counts.get(x.id) ?? 0 }));
      setGyms(withCounts);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  function onGlobeReady() {
    const g = globeEl.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    controls.enableZoom = true;
    // Focus roughly on the user's home gym, else the US.
    const home = gyms.find((x) => x.id === profile?.home_gym_id);
    g.pointOfView(
      home
        ? { lat: home.latitude!, lng: home.longitude!, altitude: 1.6 }
        : { lat: 39.5, lng: -98.35, altitude: 2.2 },
      0,
    );
  }

  function focusGym(gym: GymWithCount) {
    setSelected(gym);
    setQuery("");
    const g = globeEl.current;
    if (g) {
      g.controls().autoRotate = false;
      g.pointOfView(
        { lat: gym.latitude!, lng: gym.longitude!, altitude: 1.1 },
        900,
      );
    }
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return gyms
      .filter((g) =>
        [g.name, g.city, g.state, g.brand]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [gyms, query]);

  async function setHome(gym: GymWithCount) {
    if (!profile) return;
    if (gym.id === profile.home_gym_id && !profile.visiting_gym_id) {
      navigate("/");
      return;
    }
    setSaving("home");
    await supabase
      .from("profiles")
      .update({ home_gym_id: gym.id, visiting_gym_id: null })
      .eq("id", profile.id);
    await refreshProfile();
    setSaving(null);
    navigate("/");
  }

  async function visitGym(gym: GymWithCount) {
    if (!profile) return;
    setSaving("visit");
    await supabase
      .from("profiles")
      .update({ visiting_gym_id: gym.id })
      .eq("id", profile.id);
    await refreshProfile();
    setSaving(null);
    navigate("/");
  }

  const isHome = selected?.id === profile?.home_gym_id;

  return (
    <div
      ref={wrapRef}
      className="relative -mb-28 h-[calc(100%+7rem)] w-full overflow-hidden bg-bg"
    >
      {size.w > 0 ? (
        <Globe
          ref={globeEl}
          width={size.w}
          height={size.h}
          onGlobeReady={onGlobeReady}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-dark.jpg"
          atmosphereColor={ACCENT}
          atmosphereAltitude={0.18}
          pointsData={gyms}
          pointLat={(d: any) => d.latitude}
          pointLng={(d: any) => d.longitude}
          pointColor={(d: any) =>
            d.id === profile?.home_gym_id ? HOME : ACCENT
          }
          pointAltitude={0.015}
          pointRadius={(d: any) => (d.id === profile?.home_gym_id ? 0.6 : 0.42)}
          pointLabel={(d: any) => `${d.name}`}
          onPointClick={(d: any) => focusGym(d as GymWithCount)}
        />
      ) : null}

      {/* Search overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-4">
        <div className="pointer-events-auto relative mx-auto max-w-app">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search gym, city, or brand"
            className="h-12 w-full rounded-2xl bg-surface/90 pl-11 pr-4 text-chalk shadow-lg backdrop-blur placeholder:text-faint outline-none focus:ring-1 focus:ring-accent"
          />
          {matches.length > 0 ? (
            <ul className="mt-2 overflow-hidden rounded-2xl bg-surface/95 shadow-lg backdrop-blur">
              {matches.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => focusGym(g)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-surface-2"
                  >
                    <MapPin size={15} className="shrink-0 text-faint" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-chalk">
                        {g.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {[g.city, g.state].filter(Boolean).join(", ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {/* Browse-as-list shortcut */}
      <button
        onClick={() => navigate("/gyms")}
        className="absolute right-4 top-20 z-10 flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-2 text-xs font-semibold text-chalk shadow-lg backdrop-blur"
      >
        <List size={15} /> List
      </button>

      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/40">
          <CenterSpinner />
        </div>
      ) : null}

      {/* Selected-gym card */}
      {selected ? (
        <div className="absolute inset-x-0 bottom-24 z-10 p-4">
          <div className="mx-auto max-w-app rounded-3xl bg-surface/95 p-5 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-lg font-extrabold text-chalk">
                  <span className="truncate">{selected.name}</span>
                  {isHome ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                      <Home size={10} /> Home
                    </span>
                  ) : null}
                </p>
                {selected.city || selected.state ? (
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                    <MapPin size={13} />
                    {[selected.city, selected.state].filter(Boolean).join(", ")}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-faint">
                  {selected.routeCount} active{" "}
                  {selected.routeCount === 1 ? "route" : "routes"}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-full p-1 text-faint hover:text-chalk"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1"
                loading={saving === "home"}
                onClick={() => setHome(selected)}
              >
                {isHome ? (
                  <>
                    <Check size={16} className="mr-1.5" /> View routes
                  </>
                ) : (
                  "Set as home"
                )}
              </Button>
              {!isHome ? (
                <Button
                  variant="secondary"
                  className="flex-1"
                  loading={saving === "visit"}
                  onClick={() => visitGym(selected)}
                >
                  <Plane size={16} className="mr-1.5" /> I'm visiting
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
