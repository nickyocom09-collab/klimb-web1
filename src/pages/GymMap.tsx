import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Check, Home, List, MapPin, Plus, Search, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Button, CenterSpinner, Spinner } from "../components/ui";
import type { GymRow } from "../lib/database.types";

// Continental-US default view.
const US_CENTER: [number, number] = [39.5, -98.35];
const US_ZOOM = 4;

/** Teardrop pin as a divIcon so we don't depend on Leaflet's image assets
 *  (which break under bundlers). Home gym gets a filled accent pin. */
function pinIcon(home: boolean): L.DivIcon {
  const fill = home ? "rgb(var(--c-accent))" : "rgb(var(--c-surface-2))";
  const stroke = "rgb(var(--c-accent))";
  const dot = home ? "rgb(var(--c-bg))" : "rgb(var(--c-accent))";
  return L.divIcon({
    className: "klimb-pin",
    html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z"
        fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <circle cx="15" cy="15" r="5.5" fill="${dot}"/>
    </svg>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
  });
}

type GymWithCount = GymRow & { routeCount: number };

export function GymMap() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const [gyms, setGyms] = useState<GymWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GymWithCount | null>(null);
  const [saving, setSaving] = useState(false);

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

  // Center on the user's home gym once data is in.
  useEffect(() => {
    if (loading || !mapRef.current || !profile?.home_gym_id) return;
    const home = gyms.find((g) => g.id === profile.home_gym_id);
    if (home) mapRef.current.setView([home.latitude!, home.longitude!], 11);
  }, [loading, gyms, profile?.home_gym_id]);

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

  function flyTo(gym: GymWithCount) {
    setQuery("");
    setSelected(gym);
    mapRef.current?.flyTo([gym.latitude!, gym.longitude!], 13, {
      duration: 0.8,
    });
  }

  async function setHome(gym: GymWithCount) {
    if (!profile) return;
    if (gym.id === profile.home_gym_id) {
      navigate("/");
      return;
    }
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ home_gym_id: gym.id })
      .eq("id", profile.id);
    await refreshProfile();
    setSaving(false);
    navigate("/");
  }

  return (
    // Extend past the shared bottom padding so the map sits under the floating
    // nav; the negative margin keeps layout flush.
    <div className="relative -mb-28 h-[calc(100%+7rem)] w-full">
      {/* Map fills the tab. */}
      <MapContainer
        center={US_CENTER}
        zoom={US_ZOOM}
        ref={mapRef}
        zoomControl={false}
        className="absolute inset-0 z-0 h-full w-full bg-surface"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {gyms.map((gym) => (
          <Marker
            key={gym.id}
            position={[gym.latitude!, gym.longitude!]}
            icon={pinIcon(gym.id === profile?.home_gym_id)}
            eventHandlers={{ click: () => setSelected(gym) }}
          />
        ))}
      </MapContainer>

      {/* Search overlay. */}
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
            className="h-12 w-full rounded-2xl border border-border bg-surface/95 pl-11 pr-4 text-chalk shadow-lg backdrop-blur placeholder:text-faint outline-none focus:border-accent"
          />
          {matches.length > 0 ? (
            <ul className="mt-2 overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-lg backdrop-blur">
              {matches.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => flyTo(g)}
                    className="flex w-full items-center gap-2 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-surface-2"
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

      {/* Browse-as-list shortcut. */}
      <button
        onClick={() => navigate("/gyms")}
        className="absolute right-4 top-20 z-10 flex items-center gap-1.5 rounded-full border border-border bg-surface/95 px-3 py-2 text-xs font-semibold text-chalk shadow-lg backdrop-blur"
      >
        <List size={15} /> List
      </button>

      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/40">
          <CenterSpinner />
        </div>
      ) : null}

      {/* Selected-gym card. */}
      {selected ? (
        <div className="absolute inset-x-0 bottom-24 z-10 p-4">
          <div className="mx-auto max-w-app rounded-3xl border border-border bg-surface/95 p-5 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-lg font-extrabold text-chalk">
                  <span className="truncate">{selected.name}</span>
                  {selected.id === profile?.home_gym_id ? (
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
                loading={saving}
                onClick={() => setHome(selected)}
              >
                {selected.id === profile?.home_gym_id ? (
                  <>
                    <Check size={16} className="mr-1.5" /> View routes
                  </>
                ) : saving ? (
                  <Spinner />
                ) : (
                  "Set as home"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Suggest a gym. */}
      {!selected ? (
        <button
          onClick={() => navigate("/gym/add")}
          className="absolute bottom-28 right-4 z-10 flex items-center gap-1.5 rounded-full bg-accent px-4 py-3 text-sm font-bold text-bg shadow-lg"
        >
          <Plus size={18} /> Gym
        </button>
      ) : null}
    </div>
  );
}
