import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Globe, Lock, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Button, CenterSpinner } from "../components/ui";

const flag = (cc: string) =>
  cc.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

// cc -> continent (covers the seeded set + common codes).
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
const CONTINENT_ORDER = ["North America", "South America", "Europe", "Asia", "Oceania", "Africa"];

type Country = { cc: string; name: string; continent: string; gyms: number };

export function Passport() {
  const { profile } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const targetId = id ?? profile?.id ?? null;
  const isMe = !id || id === profile?.id;
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<Country[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [personName, setPersonName] = useState<string | null>(null);
  const [locked, setLocked] = useState(false); // viewing a private profile

  useEffect(() => {
    if (!targetId) return;
    let active = true;
    setLoading(true);
    (async () => {
      // Viewing someone else? Only if their profile is public.
      if (!isMe) {
        const { data: p } = await supabase
          .from("profiles")
          .select("display_name, sends_public")
          .eq("id", targetId)
          .maybeSingle();
        if (!active) return;
        setPersonName(p?.display_name ?? null);
        if (!p?.sends_public) {
          setLocked(true);
          setLoading(false);
          return;
        }
      }
      // All countries that have gyms + a total gym count each.
      const { data: gyms } = await supabase
        .from("gyms")
        .select("id, cc, country")
        .eq("status", "approved");
      const byCc = new Map<string, { name: string; gyms: number }>();
      const gymCc = new Map<string, string>();
      for (const g of gyms ?? []) {
        const cc = (g.cc ?? "xx").toLowerCase();
        gymCc.set(g.id, cc);
        const e = byCc.get(cc) ?? { name: g.country ?? cc.toUpperCase(), gyms: 0 };
        e.gyms += 1;
        byCc.set(cc, e);
      }
      const list: Country[] = [...byCc.entries()]
        .map(([cc, v]) => ({
          cc,
          name: v.name,
          gyms: v.gyms,
          continent: CONTINENT[cc] ?? "Elsewhere",
        }))
        .sort(
          (a, b) =>
            CONTINENT_ORDER.indexOf(a.continent) - CONTINENT_ORDER.indexOf(b.continent) ||
            b.gyms - a.gyms ||
            a.name.localeCompare(b.name),
        );

      // Which countries the user has actually climbed in.
      const { data: sends } = await supabase
        .from("sends")
        .select("route_id")
        .eq("user_id", targetId)
        .neq("send_type", "attempt");
      const routeIds = [...new Set((sends ?? []).map((s) => s.route_id))];
      const { data: routes } = routeIds.length
        ? await supabase.from("routes").select("id, gym_id").in("id", routeIds)
        : { data: [] as { id: string; gym_id: string }[] };
      const got = new Set<string>();
      for (const r of routes ?? []) {
        const cc = gymCc.get(r.gym_id);
        if (cc) got.add(cc);
      }

      if (!active) return;
      setCountries(list);
      setUnlocked(got);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [targetId, isMe]);

  const total = countries.length;
  const gotN = countries.filter((c) => unlocked.has(c.cc)).length;
  const pct = total ? Math.round((gotN / total) * 100) : 0;
  const continentsGot = new Set(
    countries.filter((c) => unlocked.has(c.cc)).map((c) => c.continent),
  ).size;

  const grouped = useMemo(() => {
    const m: Record<string, Country[]> = {};
    for (const c of countries) (m[c.continent] ||= []).push(c);
    return m;
  }, [countries]);

  if (loading) {
    return (
      <div style={{ ...S.root, minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <CenterSpinner />
      </div>
    );
  }

  if (locked) {
    return (
      <div style={{ ...S.root, minHeight: "100vh" }}>
        <div style={S.shell}>
          <button onClick={() => navigate(-1)} aria-label="Close" style={S.close}>
            <X size={20} color="#7C8C84" />
          </button>
          <div style={{ display: "grid", placeItems: "center", gap: 12, padding: "100px 20px", textAlign: "center" }}>
            <Lock size={26} color="#5f7069" />
            <p style={{ color: "#7C8C84", fontSize: 14 }}>
              {personName ?? "This climber"}'s passport is private.
            </p>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...S.root, minHeight: "100vh" }}>
      <div style={S.shell}>
        {/* Close */}
        <button onClick={() => navigate(-1)} aria-label="Close" style={S.close}>
          <X size={20} color="#7C8C84" />
        </button>

        {/* Header */}
        <div style={S.head}>
          <div>
            <div style={S.kicker}>
              {isMe ? "PASSPORT" : `${(personName ?? "CLIMBER").toUpperCase()}`}
            </div>
            <h1 style={S.title}>
              <span style={S.big}>{gotN}</span>
              <span style={S.slash}> / {total}</span>
            </h1>
            <div style={S.sub}>
              countries climbed · {continentsGot} continents
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <Ring pct={pct} />
          </div>
        </div>
        <div style={S.bar}>
          <div style={{ ...S.barFill, width: `${pct}%` }} />
        </div>
        <p style={S.hint}>
          A country unlocks the first time you log a climb at a gym there.
        </p>

        {/* Grid by continent */}
        {CONTINENT_ORDER.filter((k) => grouped[k]).map((cont) => {
          const cl = grouped[cont];
          const gotHere = cl.filter((c) => unlocked.has(c.cc)).length;
          return (
            <section key={cont} style={{ marginBottom: 30 }}>
              <div style={S.contHead}>
                <span style={S.contName}>{cont}</span>
                <span style={S.contCount}>
                  {gotHere}/{cl.length}
                </span>
              </div>
              <div style={S.grid}>
                {cl.map((c) => {
                  const on = unlocked.has(c.cc);
                  return (
                    <div
                      key={c.cc}
                      style={{ ...S.tile, ...(on ? S.tileOn : S.tileOff) }}
                    >
                      <div style={S.flagWrap}>
                        <span style={{ ...S.flag, ...(on ? {} : S.flagLocked) }}>
                          {flag(c.cc)}
                        </span>
                        {on ? (
                          <span style={S.checkChip}>
                            <Check size={12} strokeWidth={3} color="#080B0A" />
                          </span>
                        ) : (
                          <span style={S.lockChip}>
                            <Lock size={13} color="#5f7069" />
                          </span>
                        )}
                      </div>
                      <div style={{ ...S.cName, color: on ? "#E8F0EB" : "#5a6862" }}>
                        {c.name}
                      </div>
                      <div style={S.cGyms}>
                        {c.gyms} {c.gyms > 1 ? "gyms" : "gym"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <div style={S.footer}>
          <Globe size={13} color="#3f4b44" /> {total} countries have Klimb gyms —
          collect them all.
        </div>
      </div>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 26,
    c = 2 * Math.PI * r,
    off = c - (pct / 100) * c;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(74,222,128,0.14)" strokeWidth="5" />
      <circle
        cx="32" cy="32" r={r} fill="none" stroke="#4ADE80" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 32 32)"
        style={{ transition: "stroke-dashoffset .5s ease" }}
      />
      <text x="32" y="36" textAnchor="middle" fontSize="15" fontWeight="700" fill="#E8F0EB" fontFamily="Cambria, Georgia, serif">
        {pct}%
      </text>
    </svg>
  );
}

const serif = 'Cambria, Georgia, "Times New Roman", serif';
const sans = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const S: Record<string, CSSProperties> = {
  // Fixed full-viewport cover (incl. the status-bar safe area) so the page is
  // fully dark regardless of the app's light/dark theme — no white bar.
  root: { position: "fixed", inset: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", zIndex: 40, background: "#080B0A", color: "#E8F0EB", fontFamily: sans },
  shell: { position: "relative", maxWidth: 760, margin: "0 auto", padding: "calc(28px + env(safe-area-inset-top)) 20px calc(44px + env(safe-area-inset-bottom))" },
  close: { position: "absolute", top: "calc(20px + env(safe-area-inset-top))", right: 18, width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "none", display: "grid", placeItems: "center", cursor: "pointer" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, paddingRight: 44 },
  kicker: { fontSize: 11, letterSpacing: "0.28em", color: "#4ADE80", fontWeight: 600 },
  title: { margin: "8px 0 4px", fontFamily: serif, lineHeight: 1 },
  big: { fontSize: 46, fontWeight: 700 },
  slash: { fontSize: 26, color: "#5f7069" },
  sub: { fontSize: 13, color: "#7C8C84" },
  bar: { height: 5, borderRadius: 999, background: "rgba(74,222,128,0.1)", overflow: "hidden", margin: "18px 0 10px" },
  barFill: { height: "100%", background: "linear-gradient(90deg,#2FA867,#4ADE80)", borderRadius: 999, transition: "width .5s ease" },
  hint: { fontSize: 12, color: "#5f7069", marginBottom: 26 },
  contHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid rgba(74,222,128,0.1)" },
  contName: { fontFamily: serif, fontSize: 17, fontWeight: 700 },
  contCount: { fontSize: 12, color: "#4ADE80", letterSpacing: "0.06em" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 12 },
  tile: { position: "relative", overflow: "hidden", textAlign: "left", borderRadius: 16, padding: "16px 14px", fontFamily: sans, display: "flex", flexDirection: "column", gap: 4 },
  tileOff: { background: "#0b110e", border: "1px solid rgba(120,140,132,0.12)" },
  tileOn: { background: "radial-gradient(circle at 100% 0%, rgba(74,222,128,0.1), #0E1512 62%)", border: "1px solid rgba(74,222,128,0.42)" },
  flagWrap: { position: "relative", marginBottom: 8 },
  flag: { fontSize: 38, lineHeight: 1, display: "inline-block" },
  flagLocked: { filter: "grayscale(1)", opacity: 0.22 },
  lockChip: { position: "absolute", top: 4, right: 0, width: 24, height: 24, borderRadius: "50%", background: "#11170f", border: "1px solid rgba(120,140,132,0.2)", display: "grid", placeItems: "center" },
  checkChip: { position: "absolute", top: 4, right: 0, width: 22, height: 22, borderRadius: "50%", background: "#4ADE80", display: "grid", placeItems: "center", boxShadow: "0 0 12px rgba(74,222,128,0.5)" },
  cName: { fontFamily: serif, fontSize: 15, fontWeight: 700, lineHeight: 1.15 },
  cGyms: { fontSize: 11.5, color: "#7C8C84", letterSpacing: "0.04em" },
  footer: { marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, color: "#3f4b44" },
};
