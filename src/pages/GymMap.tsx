import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import {
  BookOpen,
  Bookmark,
  Check,
  Home,
  LocateFixed,
  MapPin,
  Plane,
  Search,
  Stamp,
  Trophy,
  X,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { formatGradeStyled } from "../lib/grades";
import { Button, CenterSpinner } from "../components/ui";
import type { GymRow } from "../lib/database.types";

type GymWithCount = GymRow & { routeCount: number };

/** ISO 3166-1 alpha-2 code -> emoji flag (no image assets needed). */
function flagEmoji(cc: string | null | undefined): string {
  if (!cc || cc.length !== 2) return "🏳️";
  return cc
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

/** Everything you've done at one gym — the "what have I done here?" answer. */
type MyGymStats = {
  sends: number;
  hardestLabel: string | null;
  firstVisit: string;
  lastVisit: string;
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

const US_CENTER: [number, number] = [39.5, -98.35];

// You have to actually be at a gym to make it yours / log there.
// You need to be reasonably close to a gym to make it home or log there.
const MAX_LOG_MILES = 30;

/** Great-circle distance in miles between two lat/lng points. */
function milesBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

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

/** Dot + name pill. Home = green pulse, collected = gold glow, else dim. */
function pinIcon(name: string, home: boolean, collected: boolean): L.DivIcon {
  const mod = home
    ? " klimb-pin--home"
    : collected
      ? " klimb-pin--collected"
      : " klimb-pin--dim";
  return L.divIcon({
    className: "klimb-pin-wrap",
    html: `<div class="klimb-pin${mod}">
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
  collected,
  onSelect,
}: {
  gyms: GymWithCount[];
  homeId: string | null | undefined;
  collected: Set<string>;
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
        icon: pinIcon(gym.name, isHome, collected.has(gym.id)),
        zIndexOffset: isHome ? 1000 : collected.has(gym.id) ? 500 : 0,
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
  }, [map, gyms, homeId, collected, onSelect]);
  return null;
}

export function GymMap() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const [locating, setLocating] = useState(false);
  const [gyms, setGyms] = useState<GymWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GymWithCount | null>(null);
  const [saving, setSaving] = useState<"home" | "visit" | null>(null);
  // Gyms you've logged a send at — your "collected" gyms — plus what you've
  // actually done at each (sends, hardest, first/last visit) and your open
  // projects there.
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [myStats, setMyStats] = useState<Map<string, MyGymStats>>(new Map());
  const [projectsByGym, setProjectsByGym] = useState<Map<string, string[]>>(
    new Map(),
  );
  // Passport: the at-a-glance stamp book (state → collected gyms).

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

  // Which gyms you've collected (a send there), plus per-gym stats and your
  // open projects — all derived from your own sends/bookmarks/grades.
  useEffect(() => {
    if (!profile) return;
    let active = true;
    (async () => {
      const [{ data: mySends }, { data: myBms }, { data: myGrades }] =
        await Promise.all([
          supabase
            .from("sends")
            .select("route_id, send_type, created_at")
            .eq("user_id", profile.id),
          supabase
            .from("bookmarks")
            .select("route_id")
            .eq("user_id", profile.id)
            .eq("kind", "project"),
          supabase
            .from("grades")
            .select("route_id, grade")
            .eq("user_id", profile.id),
        ]);
      const sendRows = (mySends ?? []).filter(
        (s) => s.send_type !== "attempt",
      );
      const allRouteIds = [
        ...new Set([
          ...(mySends ?? []).map((s) => s.route_id),
          ...(myBms ?? []).map((b) => b.route_id),
        ]),
      ];
      if (allRouteIds.length === 0) {
        if (active) {
          setCollected(new Set());
          setMyStats(new Map());
          setProjectsByGym(new Map());
        }
        return;
      }
      const { data: routeRows } = await supabase
        .from("routes")
        .select(
          "id, gym_id, hold_color, wall_section, climbing_type, community_grade_cached, gym_grade, gyms(grading_style)",
        )
        .in("id", allRouteIds);
      type RR = {
        id: string;
        gym_id: string;
        hold_color: string;
        wall_section: string;
        climbing_type: "boulder" | "toprope";
        community_grade_cached: number | null;
        gym_grade: number | null;
        gyms: { grading_style: "classic" | "bands" } | null;
      };
      const routeMap = new Map(
        ((routeRows ?? []) as unknown as RR[]).map((r) => [r.id, r]),
      );
      const gradeMap = new Map(
        (myGrades ?? []).map((g) => [g.route_id, g.grade]),
      );

      // Per-gym: sends count, hardest send (best label), first + last visit.
      const stats = new Map<
        string,
        MyGymStats & { hardestOrd: number; hardestType: string }
      >();
      for (const s of sendRows) {
        const r = routeMap.get(s.route_id);
        if (!r) continue;
        const ord =
          gradeMap.get(s.route_id) ??
          r.community_grade_cached ??
          r.gym_grade ??
          -1;
        const cur = stats.get(r.gym_id);
        if (!cur) {
          stats.set(r.gym_id, {
            sends: 1,
            hardestOrd: ord,
            hardestType: r.climbing_type,
            hardestLabel:
              ord >= 0
                ? formatGradeStyled(
                    ord,
                    r.climbing_type,
                    profile.grade_system,
                    r.gyms?.grading_style ?? "classic",
                  )
                : null,
            firstVisit: s.created_at,
            lastVisit: s.created_at,
          });
        } else {
          cur.sends += 1;
          if (s.created_at < cur.firstVisit) cur.firstVisit = s.created_at;
          if (s.created_at > cur.lastVisit) cur.lastVisit = s.created_at;
          // Compare within climbing type only (V vs 5.x aren't comparable);
          // boulders win ties for the headline.
          if (
            ord > cur.hardestOrd &&
            (r.climbing_type === cur.hardestType || cur.hardestOrd < 0)
          ) {
            cur.hardestOrd = ord;
            cur.hardestType = r.climbing_type;
            cur.hardestLabel = formatGradeStyled(
              ord,
              r.climbing_type,
              profile.grade_system,
              r.gyms?.grading_style ?? "classic",
            );
          }
        }
      }

      // Open projects per gym (not yet sent).
      const sentRouteIds = new Set(sendRows.map((s) => s.route_id));
      const projects = new Map<string, string[]>();
      for (const b of myBms ?? []) {
        if (sentRouteIds.has(b.route_id)) continue;
        const r = routeMap.get(b.route_id);
        if (!r) continue;
        const list = projects.get(r.gym_id) ?? [];
        list.push(`${r.hold_color} · ${r.wall_section}`);
        projects.set(r.gym_id, list);
      }

      if (active) {
        setMyStats(stats);
        setCollected(new Set(stats.keys()));
        setProjectsByGym(projects);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const home = useMemo(
    () => gyms.find((g) => g.id === profile?.home_gym_id) ?? null,
    [gyms, profile?.home_gym_id],
  );

  // Collection progress: gyms collected + distinct states stamped.
  const collectedStats = useMemo(() => {
    const states = new Set<string>();
    const countries = new Map<string, string>(); // cc -> country name
    for (const g of gyms) {
      if (!collected.has(g.id)) continue;
      if (g.state) states.add(g.state);
      if (g.cc) countries.set(g.cc, g.country ?? g.cc.toUpperCase());
    }
    return {
      gyms: collected.size,
      states: states.size,
      countries: countries.size,
      countryList: [...countries.entries()].sort((a, b) =>
        a[1].localeCompare(b[1]),
      ),
    };
  }, [gyms, collected]);

  function focusGym(gym: GymWithCount, zoom = 13) {
    setSelected(gym);
    mapRef.current?.flyTo([gym.latitude!, gym.longitude!], zoom, {
      duration: 0.9,
      easeLinearity: 0.22,
    });
  }

  // "Recenter on me" — fly to the device's location.
  function recenterOnMe() {
    if (!navigator.geolocation) {
      window.alert("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        mapRef.current?.flyTo(
          [pos.coords.latitude, pos.coords.longitude],
          11,
          { duration: 0.9, easeLinearity: 0.22 },
        );
      },
      () => {
        setLocating(false);
        window.alert(
          "Couldn't get your location — check location permissions for this app.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
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

  // Best-effort device location, so we can gate logging to gyms you're at.
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setMyLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  function milesAway(gym: GymWithCount): number | null {
    if (!myLoc || gym.latitude == null || gym.longitude == null) return null;
    return milesBetween(myLoc.lat, myLoc.lng, gym.latitude, gym.longitude);
  }

  /** Block making a gym yours unless you're within range. Returns true if OK. */
  function withinRange(gym: GymWithCount): boolean {
    const away = milesAway(gym);
    if (away !== null && away > MAX_LOG_MILES) {
      window.alert(
        `You're about ${Math.round(away)} mi from ${gym.name}. You need to be within ${MAX_LOG_MILES} miles to make it yours.`,
      );
      return false;
    }
    return true;
  }

  async function setHome(gym: GymWithCount) {
    if (!profile) return;
    if (gym.id === profile.home_gym_id && !profile.visiting_gym_id) {
      navigate("/");
      return;
    }
    if (!withinRange(gym)) return;
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
    if (!withinRange(gym)) return;
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
  const selectedAway = selected ? milesAway(selected) : null;
  const tooFar = selectedAway !== null && selectedAway > MAX_LOG_MILES;

  return (
    <div className="relative -mb-28 h-[calc(100%+7rem)] w-full bg-bg">
      {/* Mount the map only once gyms are in — it initializes directly on the
          home gym at full size, instead of jumping there after a re-render. */}
      {!loading ? (
        <MapContainer
          center={home ? [home.latitude!, home.longitude!] : US_CENTER}
          zoom={home ? 10 : 4}
          minZoom={2}
          maxZoom={19}
          ref={mapRef}
          zoomControl={false}
          attributionControl={false}
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
            url={`https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`}
            subdomains="abcd"
            maxZoom={19}
            keepBuffer={4}
            updateWhenZooming={false}
          />
          <GymLayer
            gyms={gyms}
            homeId={profile?.home_gym_id}
            collected={collected}
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

      {/* Collection progress — how many gyms you've stamped */}
      {!loading ? (
        <div className="absolute left-4 top-20 z-10">
          <div className="flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-2 text-xs font-bold text-chalk shadow-lg backdrop-blur">
            <Trophy size={14} style={{ color: "#ffc24b" }} />
            <span className="tabular-nums">
              {collectedStats.gyms}/{gyms.length}
            </span>{" "}
            gyms
            {collectedStats.states > 0 ? (
              <span className="text-muted">
                · {collectedStats.states} state
                {collectedStats.states === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Quick actions: passport, home, me — uniform width */}
      <div className="absolute right-4 top-20 z-10 flex flex-col items-end gap-2 [&>button]:w-32 [&>button]:justify-center">
        <button
          onClick={() => navigate("/passport")}
          className="flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-2 text-xs font-semibold text-chalk shadow-lg backdrop-blur transition active:scale-95"
        >
          <Stamp size={15} style={{ color: "#ffc24b" }} /> Passport
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
        <button
          onClick={recenterOnMe}
          aria-label="Recenter on my location"
          className="flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-2 text-xs font-semibold text-chalk shadow-lg backdrop-blur transition active:scale-95 disabled:opacity-50"
          disabled={locating}
        >
          <LocateFixed size={15} className={locating ? "animate-spin" : ""} />{" "}
          Me
        </button>
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
                {selected.city || selected.state || selected.country ? (
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                    <MapPin size={13} />
                    {[selected.city, selected.state].filter(Boolean).join(", ")}
                    {selected.cc ? (
                      <span className="ml-1 text-base leading-none">
                        {flagEmoji(selected.cc)}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-full p-1 text-faint hover:text-chalk"
              >
                <X size={20} />
              </button>
            </div>
            {/* What have I done here? */}
            {(() => {
              const s = myStats.get(selected.id);
              const projs = projectsByGym.get(selected.id) ?? [];
              if (!s && projs.length === 0) {
                return (
                  <p className="mt-3 rounded-2xl bg-surface-2 px-3 py-2.5 text-xs text-muted">
                    You haven't climbed here yet. Set it as home or log a visit
                    to stamp it gold.
                  </p>
                );
              }
              return (
                <div className="mt-3 flex flex-col gap-2">
                  {s ? (
                    <div
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-3 py-2.5 text-xs font-semibold"
                      style={{
                        color: "#ffc24b",
                        backgroundColor: "rgba(255,194,75,0.10)",
                      }}
                    >
                      <span className="flex items-center gap-1">
                        <Trophy size={12} /> {s.sends} send
                        {s.sends === 1 ? "" : "s"}
                      </span>
                      {s.hardestLabel ? (
                        <span>hardest {s.hardestLabel}</span>
                      ) : null}
                      <span className="font-normal opacity-80">
                        {shortDate(s.firstVisit) === shortDate(s.lastVisit)
                          ? shortDate(s.firstVisit)
                          : `${shortDate(s.firstVisit)} → ${shortDate(s.lastVisit)}`}
                      </span>
                    </div>
                  ) : null}
                  {projs.length > 0 ? (
                    <p className="flex items-start gap-1.5 rounded-2xl bg-surface-2 px-3 py-2.5 text-xs text-muted">
                      <Bookmark
                        size={13}
                        className="mt-0.5 shrink-0 text-accent"
                      />
                      <span>
                        <span className="font-semibold text-chalk">
                          Projecting here:
                        </span>{" "}
                        {projs.slice(0, 3).join(", ")}
                        {projs.length > 3 ? ` +${projs.length - 3} more` : ""}
                      </span>
                    </p>
                  ) : null}
                </div>
              );
            })()}

            {tooFar && !isHome ? (
              <p className="mt-3 rounded-2xl bg-wide/10 px-3 py-2.5 text-xs font-semibold text-wide">
                You're about {Math.round(selectedAway!)} mi away — get within{" "}
                {MAX_LOG_MILES} miles to make it yours.
              </p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1"
                loading={saving === "home"}
                disabled={tooFar && !isHome}
                onClick={() => setHome(selected)}
              >
                {isHome ? (
                  <>
                    <Check size={16} className="mr-1.5" /> View logbook
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
                  disabled={tooFar && !collected.has(selected.id)}
                  onClick={() => visitGym(selected)}
                >
                  {collected.has(selected.id) ? (
                    <>
                      <BookOpen size={16} className="mr-1.5" /> View log
                    </>
                  ) : (
                    <>
                      <Plane size={16} className="mr-1.5" /> I'm visiting
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
