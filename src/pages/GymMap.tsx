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

const US_CENTER: [number, number] = [39.5, -98.35];
const US_ZOOM = 4;

// Black circular marker with a green climbing (mountain) glyph — Kilter-style.
function pinIcon(home: boolean): L.DivIcon {
  const size = home ? 46 : 38;
  const ring = home ? "rgb(var(--c-accent))" : "rgba(255,255,255,0.22)";
  const glyph = "rgb(var(--c-accent))";
  const g = Math.round(size * 0.52);
  return L.divIcon({
    className: "klimb-pin",
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:#0c110e;border:2px solid ${ring};display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,.55)">
      <svg width="${g}" height="${g}" viewBox="0 0 24 24" fill="none" stroke="${glyph}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 20 L9.5 8 L13.5 14.5 L16.5 9.5 L21 20 Z"/>
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Black count-bubble for clustered gyms — matches the pin styling.
function clusterIcon(count: number): L.DivIcon {
  const size = count < 10 ? 40 : count < 50 ? 48 : 56;
  return L.divIcon({
    className: "klimb-cluster",
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:#0c110e;border:2px solid rgb(var(--c-accent));display:flex;align-items:center;justify-content:center;color:rgb(var(--c-accent));font-weight:800;font-size:${count < 100 ? 15 : 13}px;box-shadow:0 3px 10px rgba(0,0,0,.55)">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

type GymWithCount = GymRow & { routeCount: number };

/** Adds a clustering layer to the map (vanilla leaflet.markercluster). */
function ClusterLayer({
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
    const group = (L as unknown as {
      markerClusterGroup: (opts: unknown) => L.LayerGroup;
    }).markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 48,
      iconCreateFunction: (c: { getChildCount: () => number }) =>
        clusterIcon(c.getChildCount()),
    });
    for (const gym of gyms) {
      const m = L.marker([gym.latitude!, gym.longitude!], {
        icon: pinIcon(gym.id === homeId),
      });
      m.on("click", () => onSelect(gym));
      group.addLayer(m);
    }
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
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
    if (home) mapRef.current.setView([home.latitude!, home.longitude!], 10);
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

  function focusGym(gym: GymWithCount) {
    setQuery("");
    setSelected(gym);
    mapRef.current?.flyTo([gym.latitude!, gym.longitude!], 12, {
      duration: 0.8,
    });
  }

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
    <div className="relative -mb-28 h-[calc(100%+7rem)] w-full">
      <MapContainer
        center={US_CENTER}
        zoom={US_ZOOM}
        ref={mapRef}
        zoomControl={false}
        zoomSnap={0.5}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={100}
        zoomAnimation
        markerZoomAnimation
        className="absolute inset-0 z-0 h-full w-full bg-bg"
      >
        {/* High-res satellite imagery + crisp retina place labels (Apple/Kilter look). */}
        <TileLayer
          attribution="&copy; Esri, Maxar, Earthstar Geographics"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
          detectRetina
          keepBuffer={6}
          updateWhenZooming={false}
        />
        <TileLayer
          attribution="&copy; OpenStreetMap, &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
          detectRetina
          keepBuffer={6}
          updateWhenZooming={false}
        />
        <ClusterLayer
          gyms={gyms}
          homeId={profile?.home_gym_id}
          onSelect={setSelected}
        />
      </MapContainer>

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
        className="absolute right-4 top-20 z-10 flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-2 text-xs font-semibold text-chalk shadow-lg backdrop-blur"
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
