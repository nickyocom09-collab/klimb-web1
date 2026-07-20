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
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Directory, Filesystem } from "@capacitor/filesystem";
import type { RecapRow } from "../lib/recaps";
import type { RecapPayload } from "../lib/database.types";
import { formatGradeStyled, type GradeSystem } from "../lib/grades";
import { StreakFire } from "./StreakFire";

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

/** Stable FNV-1a hash — used as a deterministic tie-breaker so near-tied
 *  weeks rotate between archetypes instead of always landing on the same one. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Score every archetype whose condition the week actually meets, pick the
 * strongest, and break near-ties (within 8 points) with a hash of the
 * period start + the week's stats so similar weeks rotate labels.
 */
function archetypeFor(p: RecapPayload, seedKey: string): Archetype {
  const byKey = (k: string) =>
    ARCHETYPES.find((a) => a.key === k) ?? ARCHETYPES[1];
  const wall = (p.top_wall ?? "").toLowerCase();
  const ratio = p.climbs > 0 ? p.attempts / p.climbs : 0;
  const firstEver = p.prev.climbs === 0 && p.prev.sends === 0;
  const flashRate = p.flash_rate ?? 0;
  const gradeBreadth = new Set(p.pyramid.map((r) => `${r.type}:${r.ordinal}`))
    .size;
  const bothDisciplines =
    p.hardest_send.boulder !== null && p.hardest_send.toprope !== null;

  const scores: [string, number][] = [];

  // Milestone weeks dominate: a new grade is the story of the week. If it
  // came after a long-standing project, that's breaking a plateau instead.
  if (p.new_grades.length > 0)
    scores.push([
      p.oldest_project_days !== null && p.oldest_project_days >= 21
        ? "plateau"
        : "breakthrough",
      90 + p.new_grades.length * 4,
    ]);
  if (firstEver && p.climbs > 0) scores.push(["fresh", 85]);
  else if (p.prev.climbs === 0 && p.climbs > 0) scores.push(["comeback", 70]);

  // Style of the week — each keyed off a real field, scored by strength.
  if (flashRate >= 50 && p.flashes >= 3)
    scores.push(["flash", 40 + flashRate / 2]);
  if (ratio >= 2.5 && p.attempts >= 10)
    scores.push(["project", 40 + Math.min(ratio * 6, 30)]);
  if (wall.includes("overhang") || wall.includes("cave") || wall.includes("roof"))
    scores.push(["power", 55]);
  if (wall.includes("slab") || (flashRate >= 40 && ratio <= 1.5 && p.sends >= 4))
    scores.push(["technician", 52]);
  if (p.attempts >= 25 || p.climbs >= 20)
    scores.push(["endurance", 40 + Math.min(p.attempts / 2, 25)]);
  if (p.sessions >= 4) scores.push(["metronome", 42 + p.sessions * 3]);
  if (p.streak >= 3) scores.push(["ember", 38 + Math.min(p.streak * 3, 24)]);
  if (bothDisciplines || gradeBreadth >= 6) scores.push(["frontier", 46]);
  if (p.sessions >= 2 && p.climbs >= p.sessions * 5) scores.push(["crew", 44]);
  if (p.sessions >= 2 && p.climbs > 0 && p.climbs <= p.sessions * 3)
    scores.push(["dawn", 43]);
  if (p.prev.climbs > 0 && p.climbs >= p.prev.climbs * 1.4)
    scores.push(["grind", 50]);
  if (scores.length === 0) scores.push(["grind", 10]);

  scores.sort((a, b) => b[1] - a[1]);
  const pool = scores.filter(([, s]) => scores[0][1] - s <= 8);
  const seed = hashStr(
    `${seedKey}|${p.climbs}|${p.sends}|${p.attempts}|${p.sessions}|${p.streak}`,
  );
  return byKey(pool[seed % pool.length][0]);
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

/* ------- Falling rocks: 3 parallax layers, natural boulders, dust ------- */
type Rock = {
  x: number;
  y: number;
  size: number;
  pts: { x: number; y: number; round: boolean }[];
  layer: number; // 0 far, 1 mid, 2 near
  speed: number;
  rot: number;
  rotSpeed: number;
  light: number;
};
type Speck = { x: number; y: number; r: number; speed: number; phase: number; alpha: number };

const ROCK_LAYERS = [
  { min: 6, max: 14, speed: 0.45, speedVar: 0.5, blur: 1.2, alpha: 0.45 },
  { min: 14, max: 26, speed: 1.1, speedVar: 0.8, blur: 0.5, alpha: 0.8 },
  { min: 28, max: 52, speed: 2.3, speedVar: 1.8, blur: 0, alpha: 1 },
];

function RocksCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0,
      W = 0,
      H = 0,
      t = 0,
      rocks: Rock[] = [],
      specks: Speck[] = [];

    const makeRock = (layer: number, anywhere: boolean): Rock => {
      const L = ROCK_LAYERS[layer];
      const size = L.min + Math.random() * (L.max - L.min);
      // Mix of silhouettes: ~40% angular boulders, the rest rounded — round
      // vertices get midpoint-smoothed when traced, angular ones stay sharp.
      const angular = Math.random() < 0.4;
      const n = 7 + ((Math.random() * 4) | 0);
      const pts: Rock["pts"] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const r = size * (0.72 + Math.random() * 0.28);
        pts.push({
          x: Math.cos(a) * r,
          y: Math.sin(a) * r,
          round: angular ? Math.random() < 0.3 : Math.random() < 0.85,
        });
      }
      return {
        x: Math.random() * W,
        y: anywhere ? Math.random() * (H + size * 2) - size : -size * 2,
        size,
        pts,
        layer,
        speed: L.speed + Math.random() * L.speedVar,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        light: 128 + Math.random() * 44,
      };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const counts = [
        Math.round((W * H) / 30000),
        Math.round((W * H) / 46000),
        Math.round((W * H) / 78000),
      ];
      rocks = counts.flatMap((c, layer) =>
        [...Array(c)].map(() => makeRock(layer, true)),
      );
      specks = [...Array(Math.round((W * H) / 16000))].map(() => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.6 + Math.random() * 1.2,
        speed: 0.15 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.1 + Math.random() * 0.22,
      }));
    };

    const trace = (pts: Rock["pts"]) => {
      const n = pts.length;
      const mid = (a: (typeof pts)[number], b: (typeof pts)[number]) => ({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      });
      const start = mid(pts[n - 1], pts[0]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (let i = 0; i < n; i++) {
        const curr = pts[i];
        const m = mid(curr, pts[(i + 1) % n]);
        if (curr.round) ctx.quadraticCurveTo(curr.x, curr.y, m.x, m.y);
        else {
          ctx.lineTo(curr.x, curr.y);
          ctx.lineTo(m.x, m.y);
        }
      }
      ctx.closePath();
    };

    const drawRock = (r: Rock) => {
      const L = ROCK_LAYERS[r.layer];
      // Fade in over roughly the top sixth of the card — no pop-in.
      const fade = Math.min(1, Math.max(0, (r.y + r.size) / (H * 0.16)));
      ctx.save();
      ctx.globalAlpha = L.alpha * fade;
      if (L.blur) ctx.filter = `blur(${L.blur}px)`;
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rot);
      trace(r.pts);
      // Directional shading: light from the top-left, dark bottom-right.
      const l = r.layer === 0 ? r.light - 56 : r.layer === 1 ? r.light - 22 : r.light;
      const g = ctx.createLinearGradient(-r.size * 0.8, -r.size * 0.8, r.size * 0.8, r.size * 0.8);
      g.addColorStop(0, `rgb(${l},${l + 6},${l + 1})`);
      g.addColorStop(0.55, `rgb(${(l * 0.52) | 0},${(l * 0.57) | 0},${(l * 0.53) | 0})`);
      g.addColorStop(1, `rgb(${(l * 0.2) | 0},${(l * 0.24) | 0},${(l * 0.22) | 0})`);
      ctx.fillStyle = g;
      if (r.layer === 2) {
        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 8;
      }
      ctx.fill();
      ctx.shadowColor = "transparent";
      // Subtle rim light, brighter toward the lit corner.
      const rim = ctx.createLinearGradient(-r.size, -r.size, r.size, r.size);
      rim.addColorStop(0, `rgba(226,236,230,${r.layer === 2 ? 0.5 : 0.26})`);
      rim.addColorStop(0.6, "rgba(226,236,230,0.06)");
      rim.addColorStop(1, "rgba(226,236,230,0)");
      ctx.strokeStyle = rim;
      ctx.lineWidth = r.layer === 2 ? 1.5 : 0.9;
      ctx.stroke();
      ctx.restore();
    };

    const drawFrame = (dt: number) => {
      ctx.clearRect(0, 0, W, H);
      t += dt;
      for (const s of specks) {
        s.y += s.speed * dt;
        s.x += Math.sin(t * 0.01 + s.phase) * 0.12 * dt;
        if (s.y > H) {
          s.y = -2;
          s.x = Math.random() * W;
        }
        ctx.globalAlpha = s.alpha * (0.7 + 0.3 * Math.sin(t * 0.02 + s.phase));
        ctx.fillStyle = "#cfd8d2";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const r of rocks) {
        r.y += r.speed * dt;
        r.rot += r.rotSpeed * dt;
        if (r.y - r.size * 2 > H) {
          const fresh = makeRock(r.layer, false);
          Object.assign(r, fresh);
        }
        drawRock(r);
      }
    };

    const tick = () => {
      drawFrame(1);
      raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    if (reduced) {
      // Static frame: settle rocks into view once, then freeze.
      drawFrame(0);
    } else {
      tick();
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <canvas
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
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

  const arch = useMemo(
    () => archetypeFor(p, `${recap.period}:${recap.period_start}`),
    [p, recap.period, recap.period_start],
  );
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
    const shareText = "This week I was " + arch.label + " 🧗";

    if (Capacitor.isNativePlatform()) {
      // navigator.share with files is unreliable in the iOS WKWebView — write
      // the PNG to the cache dir and hand its URI to the native share sheet.
      try {
        const base64 = canvas.toDataURL("image/png").split(",")[1];
        await Filesystem.writeFile({
          path: "klimb-week.png",
          data: base64,
          directory: Directory.Cache,
        });
        const { uri } = await Filesystem.getUri({
          path: "klimb-week.png",
          directory: Directory.Cache,
        });
        await Share.share({
          title: "My Klimb week",
          text: shareText,
          files: [uri],
        });
      } catch (err) {
        // User cancelled the share sheet — nothing to do. Anything else,
        // fall back to the in-app preview so they can still save the image.
        const msg = err instanceof Error ? err.message : String(err);
        if (!/cancel/i.test(msg)) setPreview(canvas.toDataURL("image/png"));
      }
      return;
    }

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "klimb-week.png", { type: "image/png" });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "My Klimb week",
            text: shareText,
          });
          return;
        }
      } catch (err) {
        const msg =
          err instanceof Error ? `${err.name} ${err.message}` : String(err);
        if (/abort|cancel/i.test(msg)) return; // user closed the share sheet
        /* otherwise fall through to preview */
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
          <div style={{ ...S.card, background: "radial-gradient(circle at 50% 60%, #1c1008, #080B0A)" }}>
            <div style={S.cardInner}>
              <div style={S.kicker}>STREAK</div>
              <StreakFire streak={p.streak} size={190} />
              <div style={S.streakNum}>
                {p.streak}
                <span style={S.streakDays}> {periodWord}s</span>
              </div>
              <div style={S.streakDivider} />
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
  segs: { position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 12px)", left: 12, right: 12, zIndex: 20, display: "flex", gap: 5 },
  seg: { flex: 1, height: 3, borderRadius: 3, background: "rgba(255,255,255,0.16)", overflow: "hidden" },
  segFill: { height: "100%", background: "#4ADE80", transition: "width .3s ease" },
  close: { position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 24px)", right: 14, zIndex: 25, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, width: 34, height: 34, display: "grid", placeItems: "center", cursor: "pointer" },
  card: { position: "absolute", inset: 0, overflow: "hidden" },
  scrim: { position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 45%, rgba(8,11,10,0.35), rgba(8,11,10,0.86))" },
  cardInner: { position: "relative", zIndex: 5, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 30px" },
  kicker: { fontSize: 11, letterSpacing: "0.3em", color: "#7C8C84", fontWeight: 600, marginBottom: 14 },
  archTitle: { fontFamily: serif, fontSize: 52, fontWeight: 700, lineHeight: 1.02, margin: 0 },
  archSub: { fontSize: 15, color: "#B8C4BD", marginTop: 16, maxWidth: 280, lineHeight: 1.45 },
  numGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, width: "100%", maxWidth: 320, marginTop: 10 },
  num: { background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.16)", borderRadius: 16, padding: "20px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  numV: { fontFamily: serif, fontSize: 30, fontWeight: 700, color: "#E8F0EB", fontVariantNumeric: "lining-nums tabular-nums" },
  numL: { fontSize: 11.5, color: "#7C8C84", letterSpacing: "0.04em" },
  grade: { fontFamily: serif, fontSize: 92, fontWeight: 700, color: "#E4B363", textShadow: "0 0 44px rgba(228,179,99,0.4)", lineHeight: 1, fontVariantNumeric: "lining-nums tabular-nums" },
  streakNum: { fontFamily: serif, fontSize: 82, fontWeight: 700, color: "#FB923C", lineHeight: 1, textShadow: "0 0 44px rgba(251,146,60,0.55)", fontVariantNumeric: "lining-nums tabular-nums", marginTop: 18 },
  streakDays: { fontFamily: serif, fontSize: 26, color: "#B8C4BD", fontWeight: 600 },
  streakDivider: { width: 44, height: 3, borderRadius: 3, background: "rgba(251,146,60,0.45)", margin: "22px 0 16px" },
  streakNote: { fontSize: 14.5, color: "#B8C4BD", lineHeight: 1.5, maxWidth: 240, margin: 0 },
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
`;
