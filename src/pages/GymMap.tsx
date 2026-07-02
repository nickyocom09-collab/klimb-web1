import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { Check, Home, List, MapPin, Plane, Search, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Button, CenterSpinner } from "../components/ui";
import type { GymRow } from "../lib/database.types";

type GymWithCount = GymRow & { routeCount: number };

const US_CENTER: [number, number] = [39.5, -98.35];

// Gym names come from the DB (user-suggestable), so escape before injecting
// into marker HTML.
function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

const HOUSE_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>`;

/** Green glowing dot with the gym's name on a pill underneath. */
function pinIcon(name: string, home: boolean): L.DivIcon {
  return L.divIcon({
    className: "klimb-pin-wrap",
    html: `<div class="klimb-pin${home ? " klimb-pin--home" : ""}">
      <div class="klimb-pin__dot"></div>
      <div class="klimb-pin__label">${home ? HOUSE_SVG : ""}<span>${esc(name)}</span></div>
    </div>`,
    iconSize: [0, 0],
  });
}

/** Dark count-bubble for clustered gyms. */
function clusterIcon(count: number): L.DivIcon {
  const size = count < 10 ? 40 : count < 50 ? 48 : 56;
  return L.divIcon({
    className: "klimb-cluster",
    html: `<div class="klimb-cluster__bubble" style="width:${size}px;height:${size}px;font-size:${count < 100 ? 15 : 13}px">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Keeps Leaflet's internal size in sync with the container. iOS Safari can
 * settle the flex layout after the map mounts, which otherwise leaves tiles
 * rendered in a narrow strip until the next resize.
 */
function MapSizeSync() {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => map.invalidateSize({ animate: false });
    // One immediate pass for post-mount layout settling…
    const t = setTimeout(invalidate, 60);
    // …then track every real container resize (rotation, keyboard, etc.).
    const ro = new ResizeObserver(invalidate);
    ro.observe(map.getContainer());
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

/**
 * Clustered gym markers (vanilla leaflet.markercluster). The home gym is kept
 * OUT of the cluster group as a standalone always-visible marker, so you can
 * spot it at any zoom level.
 */
function GymLayer({
  gyms,
  homeId,
  onSelect,
}: {
  gyms: GymWithCount[];
  homeId: string | null | undefined;
  onSelect: (g: GymWithCount) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const group = (
      L as unknown as {
        markerClusterGroup: (opts: unknown) => L.LayerGroup;
      }
    ).markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      animate: true,
      maxClusterRadius: 56,
      iconCreateFunction: (c: { getChildCount: () => number }) =>
        clusterIcon(c.getChildCount()),
    });
    let homeMarker: L.Marker | null = null;
    for (const gym of gyms) {
      const isHome = gym.id === homeId;
      const m = L.marker([gym.latitude!, gym.longitude!], {
        icon: pinIcon(gym.name, isHome),
        zIndexOffset: isHome ? 1000 : 0,
        riseOnHover: true,
      });
      m.on("click", () => onSelect(gym));
      if (isHome) {
        homeMarker = m;
        m.addTo(map);
      } else {
        group.addLayer(m);
      }
    }
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      homeMarker?.remove();
    };
  }, [map, gyms, homeId, onSelect]);
  return null;
}

export function GymMap() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const [gyms, setGyms] = useState<GymWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GymWithCount | null>(null);
  const [saving, setSaving] = useState<"home" | "visit" | null>(null);

  // Match the tiles to the app theme.
  const dark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") !== "light";

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
      setGyms(
        (g ?? [])
          .filter((x) => x.latitude != null && x.longitude != null)
          .map((x) => ({ ...x, routeCount: counts.get(x.id) ?? 0 })),
      );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const home = useMemo(
    () => gyms.find((g) => g.id === profile?.home_gym_id) ?? null,
    [gyms, profile?.home_gym_id],
  );

  function focusGym(gym: GymWithCount, zoom = 13) {
    setSelected(gym);
    mapRef.current?.flyTo([gym.latitude!, gym.longitude!], zoom, {
      duration: 0.9,
      easeLinearity: 0.22,
    });
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
    <div className="relative -mb-28 h-[calc(100%+7rem)] w-full bg-bg">
      {/* Mount the map only once gyms are in — it initializes directly on the
          home gym at full size, instead of jumping there after a re-render. */}
      {!loading ? (
        <MapContainer
          center={home ? [home.latitude!, home.longitude!] : US_CENTER}
          zoom={home ? 10 : 4}
          minZoom={4}
          maxZoom={19}
          ref={mapRef}
          zoomControl={false}
          zoomSnap={0.5}
          zoomDelta={0.5}
          wheelPxPerZoomLevel={120}
          zoomAnimation
          fadeAnimation
          markerZoomAnimation
          worldCopyJump
          className="klimb-map absolute inset-0 z-0 h-full w-full"
        >
          <MapSizeSync />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url={`https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "voyager"}/{z}/{x}/{y}{r}.png`}
            subdomains="abcd"
            maxZoom={19}
            keepBuffer={4}
            updateWhenZooming={false}
          />
          <GymLayer
            gyms={gyms}
            homeId={profile?.home_gym_id}
            onSelect={(g) =>
              focusGym(g, Math.max(mapRef.current?.getZoom() ?? 12, 12))
            }
          />
        </MapContainer>
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
            className="h-12 w-full rounded-2xl bg-surface/95 pl-11 pr-4 text-chalk shadow-lg backdrop-blur placeholder:text-faint outline-none focus:ring-1 focus:ring-accent"
          />
          {matches.length > 0 ? (
            <ul className="mt-2 overflow-hidden rounded-2xl bg-surface/95 shadow-lg backdrop-blur">
              {matches.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => {
                      setQuery("");
                      focusGym(g);
                    }}
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

      {/* Quick actions: jump home + browse as list */}
      <div className="absolute right-4 top-20 z-10 flex flex-col items-end gap-2">
        <button
          onClick={() => navigate("/gyms")}
          className="flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-2 text-xs font-semibold text-chalk shadow-lg backdrop-blur transition active:scale-95"
        >
          <List size={15} /> List
        </button>
        {home ? (
          <button
            onClick={() => focusGym(home, 12)}
            aria-label="Go to my home gym"
            className="flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-2 text-xs font-semibold text-accent shadow-lg backdrop-blur transition active:scale-95"
          >
            <Home size={15} /> My gym
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/40">
          <CenterSpinner />
        </div>
      ) : null}

      {/* Selected-gym card */}
      {selected ? (
        <div className="absolute inset-x-0 bottom-24 z-10 animate-fade-up p-4">
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
