import { useState, useRef, useEffect, useMemo } from "react";
import {
  Flame,
  ChevronLeft,
  ChevronRight,
  Share2,
  Mountain,
  Zap,
  TrendingUp,
  Download,
  X,
  Camera,
} from "lucide-react";
import type { RecapRow } from "../lib/recaps";
import type { RecapPayload } from "../lib/database.types";
import { formatGradeStyled, type GradeSystem } from "../lib/grades";

/* ---------------- 15 archetypes ---------------- */
type Archetype = { key: string; label: string; sub: string; hue: string };

const ARCHETYPES: Archetype[] = [
  { key: "breakthrough", label: "Breakthrough", sub: "You sent a new personal best.", hue: "#4ADE80" },
  { key: "grind", label: "The Grind", sub: "More time on the wall than ever.", hue: "#7CC5FF" },
  { key: "project", label: "Project Hunter", sub: "You threw yourself at one line, again and again.", hue: "#E4B363" },
  { key: "flash", label: "Flash Machine", sub: "First try, first send — over and over.", hue: "#FFD166" },
  { key: "comeback", label: "Comeback Kid", sub: "You came back stronger.", hue: "#4ADE80" },
  { key: "frontier", label: "Frontier", sub: "New gym, new ground.", hue: "#8EE6C8" },
  { key: "endurance", label: "Endurance Beast", sub: "You just wouldn't come down.", hue: "#5EEAD4" },
  { key: "technician", label: "The Technician", sub: "Precision over power all week.", hue: "#A5B4FC" },
  { key: "power", label: "Power House", sub: "Steep, savage, and sent.", hue: "#F87171" },
  { key: "metronome", label: "Metronome", sub: "You showed up day after day.", hue: "#4ADE80" },
  { key: "crew", label: "Crew Leader", sub: "The best sessions are with the crew.", hue: "#C4B5FD" },
  { key: "dawn", label: "Dawn Patrol", sub: "First on the wall, before the world woke up.", hue: "#FDBA74" },
  { key: "plateau", label: "Plateau Breaker", sub: "You cracked the grade that's been haunting you.", hue: "#4ADE80" },
  { key: "fresh", label: "Fresh Chalk", sub: "Welcome. Week one is in the books.", hue: "#94E2C4" },
  { key: "ember", label: "Ember Keeper", sub: "You kept the streak alive.", hue: "#FB923C" },
];

function archetypeFor(p: RecapPayload): Archetype {
  const byKey = (k: string) =>
    ARCHETYPES.find((a) => a.key === k) ?? ARCHETYPES[1];
  const wall = (p.top_wall ?? "").toLowerCase();
  const ratio = p.climbs > 0 ? p.attempts / p.climbs : 0;
  const firstEver = p.prev.climbs === 0 && p.prev.sends === 0;

  if (p.new_grades.length > 0) return byKey("breakthrough");
  if (firstEver && p.sessions <= 1 && p.climbs > 0) return byKey("fresh");
  if (p.prev.climbs === 0 && p.climbs > 0) return byKey("comeback");
  if ((p.flash_rate ?? 0) >= 60 && p.flashes >= 3) return byKey("flash");
  if (ratio >= 3 && p.attempts >= 8) return byKey("project");
  if (wall.includes("overhang") || wall.includes("cave") || wall.includes("roof"))
    return byKey("power");
  if (wall.includes("slab")) return byKey("technician");
  if (p.attempts >= 30) return byKey("endurance");
  if (p.streak >= 3) return byKey("ember");
  if (p.sessions >= 4) return byKey("metronome");
  if (p.prev.climbs > 0 && p.climbs >= p.prev.climbs * 1.5)
    return byKey("grind");
  return byKey("grind");
}

/* The numbers a recap card / story image needs, pulled from the payload. */
type WeekData = {
  climbs: number;
  sends: number;
  flashes: number;
  sessions: number;
  streak: number;
  grade: string;
  periodWord: string;
};

/* ---------------- Falling rocks (sharp, big, parallax) ---------------- */
function RocksCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number,
      W: number,
      H: number,
      dpr: number,
      rocks: {
        x: number;
        y: number;
        size: number;
        verts: number[][];
        layer: number;
        speed: number;
        rot: number;
        rotSpeed: number;
        light: number;
      }[] = [];
    const makeRock = (layer: number) => {
      const near = layer === 1;
      const size = near ? 26 + Math.random() * 34 : 10 + Math.random() * 16;
      const n = 6 + ((Math.random() * 3) | 0);
      const verts: number[][] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = size * (0.62 + Math.random() * 0.46);
        verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      return {
        x: Math.random() * W,
        y: Math.random() * -H,
        size,
        verts,
        layer,
        speed: near ? 2.6 + Math.random() * 2.2 : 1.0 + Math.random() * 1.1,
        rot: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.03,
        light: 148 + Math.random() * 40,
      };
    };
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const far = Math.round((W * H) / 26000);
      const near = Math.round((W * H) / 44000);
      rocks = [...Array(far)]
        .map(() => makeRock(0))
        .concat([...Array(near)].map(() => makeRock(1)));
    };
    const drawRock = (r: (typeof rocks)[number]) => {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rot);
      ctx.beginPath();
      r.verts.forEach((v, i) =>
        i ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1]),
      );
      ctx.closePath();
      const g = ctx.createLinearGradient(-r.size, -r.size, r.size, r.size);
      const l = r.layer ? r.light : r.light - 46;
      g.addColorStop(0, `rgb(${l},${l + 6},${l - 2})`);
      g.addColorStop(0.5, `rgb(${l * 0.5},${l * 0.55},${l * 0.5})`);
      g.addColorStop(1, `rgb(${l * 0.22},${l * 0.26},${l * 0.24})`);
      ctx.fillStyle = g;
      if (r.layer) {
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 6;
      }
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.lineWidth = r.layer ? 1.4 : 0.8;
      ctx.strokeStyle = `rgba(210,220,214,${r.layer ? 0.5 : 0.28})`;
      ctx.stroke();
      ctx.restore();
    };
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      for (const r of rocks)
        if (r.layer === 0) {
          r.y += r.speed;
          r.rot += r.rotSpeed;
          if (r.y - r.size > H) {
            r.y = -r.size;
            r.x = Math.random() * W;
          }
          drawRock(r);
        }
      ctx.save();
      ctx.filter = "blur(0.6px)";
      for (const r of rocks)
        if (r.layer === 1) {
          r.y += r.speed;
          r.rot += r.rotSpeed;
          if (r.y - r.size > H) {
            r.y = -r.size;
            r.x = Math.random() * W;
          }
          drawRock(r);
        }
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };
    resize();
    window.addEventListener("resize", resize);
    tick();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}

/* ---------------- Simple flame (clean, not busy) ---------------- */
function SimpleFlame({ streak }: { streak: number }) {
  const t = Math.min(1, streak / 12); // grows across a season of periods
  const scale = 0.85 + t * 0.7;
  const glow = 0.25 + t * 0.4;
  return (
    <div style={{ position: "relative", width: 160, height: 200, display: "grid", placeItems: "center" }}>
      <div
        style={{
          position: "absolute",
          width: 150,
          height: 150,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(251,146,60,${glow}), transparent 70%)`,
          filter: "blur(4px)",
        }}
      />
      <div className="klimb-flame" style={{ transform: `scale(${scale})`, transformOrigin: "bottom center" }}>
        <svg width="110" height="150" viewBox="0 0 110 150">
          <defs>
            <linearGradient id="fOuter" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFB454" />
              <stop offset="55%" stopColor="#FB7A28" />
              <stop offset="100%" stopColor="#E4572E" />
            </linearGradient>
            <linearGradient id="fInner" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFF1C2" />
              <stop offset="100%" stopColor="#FFC24B" />
            </linearGradient>
          </defs>
          <path d="M55 6 C 82 46, 96 66, 90 98 C 84 128, 62 144, 55 144 C 48 144, 26 128, 20 98 C 14 66, 28 46, 55 6 Z" fill="url(#fOuter)" />
          <path className="klimb-flame-inner" d="M55 52 C 68 74, 74 86, 70 104 C 66 124, 58 134, 55 134 C 52 134, 44 124, 40 104 C 36 86, 42 74, 55 52 Z" fill="url(#fInner)" />
        </svg>
      </div>
    </div>
  );
}

/* ---------------- Story image generator ---------------- */
function drawSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  spacing: number,
) {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  ctx.textAlign = "left";
  for (let k = 0; k < chars.length; k++) {
    ctx.fillText(chars[k], x, y);
    x += widths[k] + spacing;
  }
  ctx.textAlign = "center";
}

function buildStoryCanvas(arch: Archetype, w: WeekData) {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1920;
  const ctx = c.getContext("2d")!;
  // bg
  ctx.fillStyle = "#080B0A";
  ctx.fillRect(0, 0, 1080, 1920);
  const glow = ctx.createRadialGradient(540, 520, 40, 540, 520, 900);
  glow.addColorStop(0, arch.hue + "22");
  glow.addColorStop(1, "#080B0A00");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // wordmark
  ctx.fillStyle = "#E8F0EB";
  ctx.font = "700 58px Georgia, serif";
  drawSpaced(ctx, "KLIMB", 540, 190, 16);
  ctx.strokeStyle = arch.hue;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(490, 220);
  ctx.lineTo(590, 220);
  ctx.stroke();

  // kicker
  ctx.fillStyle = "#7C8C84";
  ctx.font = "600 30px system-ui, sans-serif";
  drawSpaced(ctx, `THIS ${w.periodWord.toUpperCase()} YOU WERE`, 540, 560, 8);

  // archetype label (shrink for long names)
  const fs = arch.label.length > 13 ? 96 : 118;
  ctx.fillStyle = arch.hue;
  ctx.font = `700 ${fs}px Georgia, serif`;
  ctx.shadowColor = arch.hue + "66";
  ctx.shadowBlur = 40;
  ctx.fillText(arch.label, 540, 680);
  ctx.shadowBlur = 0;

  // subtitle (wrap)
  ctx.fillStyle = "#B8C4BD";
  ctx.font = "34px system-ui, sans-serif";
  const words = arch.sub.split(" ");
  let line = "",
    ly = 760;
  for (const word of words) {
    if (ctx.measureText(line + word).width > 820) {
      ctx.fillText(line.trim(), 540, ly);
      line = "";
      ly += 48;
    }
    line += word + " ";
  }
  ctx.fillText(line.trim(), 540, ly);

  // stats row
  const stats: [string, string][] = [
    [String(w.climbs), "climbs"],
    [String(w.sends), "sends"],
    [String(w.sessions), "sessions"],
    [String(w.streak), `${w.periodWord} streak`],
  ];
  const cols = [202, 427, 652, 877];
  const sy = 1120;
  stats.forEach((s, k) => {
    ctx.fillStyle = "#E8F0EB";
    ctx.font = "700 68px Georgia, serif";
    ctx.fillText(s[0], cols[k], sy);
    ctx.fillStyle = "#7C8C84";
    ctx.font = "24px system-ui, sans-serif";
    ctx.fillText(s[1], cols[k], sy + 44);
  });

  // hardest send
  ctx.fillStyle = "#7C8C84";
  ctx.font = "600 28px system-ui, sans-serif";
  drawSpaced(ctx, "HARDEST SEND", 540, 1400, 8);
  ctx.fillStyle = "#E4B363";
  ctx.font = "700 200px Georgia, serif";
  ctx.shadowColor = "#E4B36355";
  ctx.shadowBlur = 50;
  ctx.fillText(w.grade, 540, 1600);
  ctx.shadowBlur = 0;

  // footer
  ctx.fillStyle = "#4a564f";
  ctx.font = "26px system-ui, sans-serif";
  drawSpaced(ctx, "TRACK YOUR CLIMBS  ·  KLIMB", 540, 1820, 4);
  return c;
}

/* ---------------- Recap shell ---------------- */
export function WeeklyRecap({
  recap,
  system,
  onClose,
}: {
  recap: RecapRow;
  system: GradeSystem;
  onClose: () => void;
}) {
  const p = recap.payload;
  const periodWord = recap.period === "weekly" ? "week" : "month";

  const fmt = (o: number | null, t: "boulder" | "toprope"): string | null =>
    o === null || o === undefined ? null : formatGradeStyled(o, t, system, "classic");
  const hardestBoulder = fmt(p.hardest_send.boulder, "boulder");
  const hardestTop = fmt(p.hardest_send.toprope, "toprope");
  const hardestPrimary = hardestBoulder ?? hardestTop ?? "—";
  const hardestBoth =
    [hardestBoulder, hardestTop].filter(Boolean).join(" · ") || "—";

  const arch = useMemo(() => archetypeFor(p), [p]);
  const week: WeekData = {
    climbs: p.climbs,
    sends: p.sends,
    flashes: p.flashes,
    sessions: p.sessions,
    streak: p.streak,
    grade: hardestPrimary,
    periodWord,
  };

  // Which cards to show — skip the ones with no data to celebrate.
  const cards = useMemo(() => {
    const list = ["arch", "numbers"];
    if (hardestPrimary !== "—") list.push("hardest");
    if (p.streak >= 2) list.push("streak");
    list.push("share");
    return list;
  }, [hardestPrimary, p.streak]);

  const [i, setI] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  const next = () => setI((v) => Math.min(v + 1, cards.length - 1));
  const prev = () => setI((v) => Math.max(v - 1, 0));
  const onTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.3) prev();
    else next();
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length]);

  const shareStory = async () => {
    const canvas = buildStoryCanvas(arch, week);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "klimb-week.png", { type: "image/png" });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "My Klimb week",
            text: "This week I was " + arch.label + " 🧗",
          });
          return;
        }
      } catch {
        /* fall through to preview */
      }
      setPreview(canvas.toDataURL("image/png"));
    }, "image/png");
  };

  const card = cards[i];

  return (
    <div style={S.root}>
      <style>{CSS}</style>
      <div style={S.phone} onClick={onTap}>
        <div style={S.segs} onClick={(e) => e.stopPropagation()}>
          {cards.map((_, k) => (
            <div key={k} style={S.seg}>
              <div style={{ ...S.segFill, width: k <= i ? "100%" : "0%", opacity: k <= i ? 1 : 0.25 }} />
            </div>
          ))}
        </div>

        <button style={S.close} onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close recap">
          <X size={18} color="#B8C4BD" />
        </button>

        {card === "arch" && (
          <div style={S.card}>
            <RocksCanvas />
            <div style={S.scrim} />
            <div style={S.cardInner}>
              <div style={S.kicker}>THIS {periodWord.toUpperCase()} YOU WERE</div>
              <h1 style={{ ...S.archTitle, color: arch.hue, textShadow: `0 0 34px ${arch.hue}66` }}>{arch.label}</h1>
              <p style={S.archSub}>{arch.sub}</p>
            </div>
          </div>
        )}

        {card === "numbers" && (
          <div style={{ ...S.card, background: "radial-gradient(circle at 30% 10%, #12201a, #080B0A)" }}>
            <div style={S.cardInner}>
              <div style={S.kicker}>BY THE NUMBERS</div>
              <div style={S.numGrid}>
                <Num icon={Mountain} v={week.climbs} l="climbs logged" />
                <Num icon={Flame} v={week.sends} l="sends" />
                <Num icon={Zap} v={week.flashes} l="flashes" />
                <Num icon={TrendingUp} v={week.sessions} l="sessions" />
              </div>
            </div>
          </div>
        )}

        {card === "hardest" && (
          <div style={{ ...S.card, background: "radial-gradient(circle at 70% 20%, #1a1410, #080B0A)" }}>
            <div style={S.cardInner}>
              <div style={S.kicker}>HARDEST SEND</div>
              <div style={S.grade}>{hardestPrimary}</div>
              <p style={S.archSub}>
                {p.new_grades.length > 0
                  ? `A new personal best${hardestBoth !== hardestPrimary ? ` — ${hardestBoth}` : ""}.`
                  : `Your hardest this ${periodWord}${hardestBoth !== hardestPrimary ? ` — ${hardestBoth}` : ""}.`}
              </p>
            </div>
          </div>
        )}

        {card === "streak" && (
          <div style={{ ...S.card, background: "radial-gradient(circle at 50% 88%, #1a0f08, #080B0A)" }}>
            <div style={{ ...S.cardInner, justifyContent: "flex-start", paddingTop: 60 }}>
              <div style={S.kicker}>STREAK</div>
              <div style={S.streakNum}>
                {p.streak}
                <span style={S.streakDays}> {periodWord}s</span>
              </div>
              <SimpleFlame streak={p.streak} />
              <p style={S.streakNote}>
                {p.streak >= 8
                  ? "Roaring. Keep feeding it."
                  : p.streak >= 3
                    ? "Burning strong — don't let it go out."
                    : "Just getting started."}
              </p>
            </div>
          </div>
        )}

        {card === "share" && (
          <div style={{ ...S.card, background: "radial-gradient(circle at 50% 30%, #12201a, #080B0A)" }}>
            <div style={S.cardInner}>
              <div style={S.kicker}>THAT'S A WRAP</div>
              <h2 style={S.wrapTitle}>Your {periodWord}, sent.</h2>
              <button style={S.shareBtn} onClick={(e) => { e.stopPropagation(); shareStory(); }}>
                <Share2 size={16} /> Share recap
              </button>
              <p style={S.shareHelp}>Generates a story image and opens your share sheet — pick Instagram Stories.</p>
            </div>
          </div>
        )}

        <div style={{ ...S.navHint, left: 12 }}><ChevronLeft size={18} color="rgba(255,255,255,0.25)" /></div>
        <div style={{ ...S.navHint, right: 12 }}><ChevronRight size={18} color="rgba(255,255,255,0.25)" /></div>
      </div>

      {preview && (
        <div style={S.overlay} onClick={() => setPreview(null)}>
          <div style={S.previewCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.previewHead}>
              <span style={S.previewTitle}>Your shareable story</span>
              <button style={S.iconBtn} onClick={() => setPreview(null)}><X size={16} color="#7C8C84" /></button>
            </div>
            <img src={preview} alt="Klimb weekly story" style={S.previewImg} />
            <div style={S.previewActions}>
              <a href={preview} download="klimb-week.png" style={S.dlBtn}><Download size={15} /> Save image</a>
              <div style={S.igNote}><Camera size={14} color="#7C8C84" /> Save, then post to your IG story</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Num({
  icon: Icon,
  v,
  l,
}: {
  icon: typeof Mountain;
  v: number | string;
  l: string;
}) {
  return (
    <div style={S.num}>
      <Icon size={18} color="#4ADE80" />
      <div style={S.numV}>{v}</div>
      <div style={S.numL}>{l}</div>
    </div>
  );
}

const serif = 'Cambria, Georgia, "Times New Roman", serif';
const sans = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const S: Record<string, React.CSSProperties> = {
  root: { position: "fixed", inset: 0, zIndex: 50, background: "#050706", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: sans },
  phone: { position: "relative", width: "100%", maxWidth: 480, height: "100%", overflow: "hidden", background: "#080B0A", cursor: "pointer", userSelect: "none", margin: "0 auto" },
  segs: { position: "absolute", top: 12, left: 12, right: 12, zIndex: 20, display: "flex", gap: 5 },
  seg: { flex: 1, height: 3, borderRadius: 3, background: "rgba(255,255,255,0.16)", overflow: "hidden" },
  segFill: { height: "100%", background: "#4ADE80", transition: "width .3s ease" },
  close: { position: "absolute", top: 26, right: 14, zIndex: 25, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, width: 34, height: 34, display: "grid", placeItems: "center", cursor: "pointer" },
  card: { position: "absolute", inset: 0, overflow: "hidden" },
  scrim: { position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 45%, rgba(8,11,10,0.35), rgba(8,11,10,0.86))" },
  cardInner: { position: "relative", zIndex: 5, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 30px" },
  kicker: { fontSize: 11, letterSpacing: "0.3em", color: "#7C8C84", fontWeight: 600, marginBottom: 14 },
  archTitle: { fontFamily: serif, fontSize: 52, fontWeight: 700, lineHeight: 1.02, margin: 0 },
  archSub: { fontSize: 15, color: "#B8C4BD", marginTop: 16, maxWidth: 280, lineHeight: 1.45 },
  numGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, width: "100%", maxWidth: 320, marginTop: 10 },
  num: { background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.16)", borderRadius: 16, padding: "20px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  numV: { fontFamily: serif, fontSize: 30, fontWeight: 700, color: "#E8F0EB" },
  numL: { fontSize: 11.5, color: "#7C8C84", letterSpacing: "0.04em" },
  grade: { fontFamily: serif, fontSize: 96, fontWeight: 700, color: "#E4B363", textShadow: "0 0 44px rgba(228,179,99,0.4)", lineHeight: 1 },
  streakNum: { fontFamily: serif, fontSize: 74, fontWeight: 700, color: "#FB923C", lineHeight: 1, textShadow: "0 0 40px rgba(251,146,60,0.5)" },
  streakDays: { fontSize: 22, color: "#B8C4BD" },
  streakNote: { fontSize: 14, color: "#B8C4BD", marginTop: 4 },
  wrapTitle: { fontFamily: serif, fontSize: 38, fontWeight: 700, color: "#E8F0EB", margin: "6px 0 26px" },
  shareBtn: { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#080B0A", background: "#4ADE80", border: "none", padding: "13px 22px", borderRadius: 12, cursor: "pointer" },
  shareHelp: { fontSize: 12, color: "#7C8C84", marginTop: 16, maxWidth: 250, lineHeight: 1.45 },
  navHint: { position: "absolute", top: "50%", transform: "translateY(-50%)", zIndex: 15, pointerEvents: "none" },
  overlay: { position: "fixed", inset: 0, background: "rgba(4,6,5,0.85)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", zIndex: 60, padding: 20 },
  previewCard: { width: "100%", maxWidth: 300, background: "#0E1512", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 18, padding: 14 },
  previewHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  previewTitle: { fontFamily: serif, fontSize: 16, fontWeight: 700, color: "#E8F0EB" },
  iconBtn: { background: "transparent", border: "none", cursor: "pointer", display: "grid", placeItems: "center" },
  previewImg: { width: "100%", borderRadius: 12, display: "block", border: "1px solid rgba(255,255,255,0.08)" },
  previewActions: { marginTop: 14, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" },
  dlBtn: { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: "#080B0A", background: "#4ADE80", padding: "11px 20px", borderRadius: 11, textDecoration: "none" },
  igNote: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#7C8C84" },
};

const CSS = `
button:hover{filter:brightness(1.08);}
@keyframes klimb-flick { 0%,100%{transform:scaleY(1) scaleX(1) skewX(0deg)} 25%{transform:scaleY(1.05) scaleX(0.98) skewX(1.2deg)} 50%{transform:scaleY(0.97) scaleX(1.02) skewX(-1deg)} 75%{transform:scaleY(1.03) scaleX(0.99) skewX(0.6deg)} }
.klimb-flame > svg { animation: klimb-flick 1.5s ease-in-out infinite; transform-origin: bottom center; }
@keyframes klimb-inner { 0%,100%{opacity:0.85; transform:translateY(0)} 50%{opacity:1; transform:translateY(-3px)} }
.klimb-flame-inner { animation: klimb-inner 1.1s ease-in-out infinite; transform-origin: bottom center; }
`;
