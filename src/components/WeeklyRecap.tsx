import { useState, useRef, useEffect, useMemo } from "react";
import {
  Flame,
  Mountain,
  Zap,
  TrendingUp,
  Download,
  X,
  Check,
  Share2,
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
  const noPreviousActivity = p.prev.climbs === 0 && p.prev.sends === 0;
  const returningAfterGap =
    noPreviousActivity &&
    p.oldest_project_days !== null &&
    p.oldest_project_days >= 7;
  const firstActivePeriod = noPreviousActivity && !returningAfterGap;
  const flashRate = p.flash_rate ?? 0;
  const gradeBreadth = new Set(p.pyramid.map((r) => `${r.type}:${r.ordinal}`))
    .size;
  const bothDisciplines =
    p.hardest_send.boulder !== null && p.hardest_send.toprope !== null;

  const scores: [string, number][] = [];

  // A first active period should feel like a beginning, not claim everyone
  // had the same breakthrough. Returning weeks can earn Breakthrough, but it
  // competes with the rest of that person's actual pattern instead of
  // automatically overpowering every other archetype.
  if (firstActivePeriod && p.climbs > 0) scores.push(["fresh", 88]);
  if (returningAfterGap && p.climbs > 0) scores.push(["comeback", 82]);
  if (!firstActivePeriod && p.new_grades.length > 0)
    scores.push([
      p.oldest_project_days !== null && p.oldest_project_days >= 21
        ? "plateau"
        : "breakthrough",
      (p.oldest_project_days !== null && p.oldest_project_days >= 21 ? 76 : 62) +
        Math.min(p.new_grades.length * 3, 9),
    ]);

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

type MixItem = {
  key: "boulder" | "toprope" | "lead";
  label: string;
  n: number;
  hue: string;
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

/** The final on-screen recap card is also the thing that gets shared. */
function buildWrapCanvas(w: WeekData, mix: MixItem[]) {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1920;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#07100B";
  ctx.fillRect(0, 0, c.width, c.height);
  const glow = ctx.createRadialGradient(540, 380, 20, 540, 380, 980);
  glow.addColorStop(0, "#4ADE8038");
  glow.addColorStop(0.48, "#16322218");
  glow.addColorStop(1, "#07100B00");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.textAlign = "center";

  ctx.fillStyle = "#E8F0EB";
  ctx.font = "700 58px Georgia, serif";
  drawSpaced(ctx, "KLIMB", 540, 155, 16);

  ctx.beginPath();
  ctx.arc(540, 330, 66, 0, Math.PI * 2);
  ctx.fillStyle = "#82F0A7";
  ctx.shadowColor = "#82F0A766";
  ctx.shadowBlur = 45;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#07100B";
  ctx.lineWidth = 13;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(508, 331);
  ctx.lineTo(532, 355);
  ctx.lineTo(576, 307);
  ctx.stroke();

  ctx.fillStyle = "#7C8C84";
  ctx.font = "600 28px system-ui, sans-serif";
  drawSpaced(ctx, "THAT'S A WRAP", 540, 475, 9);

  ctx.fillStyle = "#F1F8F2";
  ctx.font = "700 92px Georgia, serif";
  ctx.fillText(`Your ${w.periodWord},`, 540, 610);
  ctx.fillText("well spent.", 540, 710);
  ctx.fillStyle = "#B8CFC0";
  ctx.font = "32px system-ui, sans-serif";
  ctx.fillText(`${w.climbs} climbs logged · ${w.sends} sends earned`, 540, 785);

  const stats: [string, string][] = [
    [String(w.climbs), "KLIMBS"],
    [String(w.sends), "SENDS"],
    [String(w.flashes), "FLASHES"],
  ];
  const statX = [245, 540, 835];
  stats.forEach(([value, label], index) => {
    ctx.fillStyle = "#101A14";
    ctx.beginPath();
    ctx.roundRect(statX[index] - 125, 890, 250, 205, 28);
    ctx.fill();
    ctx.fillStyle = "#F1F8F2";
    ctx.font = "700 64px system-ui, sans-serif";
    ctx.fillText(value, statX[index], 985);
    ctx.fillStyle = "#7C8C84";
    ctx.font = "600 23px system-ui, sans-serif";
    drawSpaced(ctx, label, statX[index], 1045, 3);
  });

  if (mix.length > 0) {
    const total = mix.reduce((sum, item) => sum + item.n, 0);
    ctx.fillStyle = "#7C8C84";
    ctx.font = "600 25px system-ui, sans-serif";
    drawSpaced(ctx, "WHAT YOU CLIMBED", 540, 1240, 7);

    let x = 130;
    const barWidth = 820;
    mix.forEach((item, index) => {
      const width =
        index === mix.length - 1
          ? 950 - x
          : Math.max(18, (item.n / total) * barWidth);
      ctx.fillStyle = item.hue;
      ctx.beginPath();
      ctx.roundRect(x, 1290, width, 34, 17);
      ctx.fill();
      x += width + 7;
    });

    const labelGap = 820 / mix.length;
    mix.forEach((item, index) => {
      const cx = 130 + labelGap * index + labelGap / 2;
      ctx.fillStyle = item.hue;
      ctx.font = "700 38px system-ui, sans-serif";
      ctx.fillText(`${Math.round((item.n / total) * 100)}%`, cx, 1415);
      ctx.fillStyle = "#B8C4BD";
      ctx.font = "27px system-ui, sans-serif";
      ctx.fillText(item.label, cx, 1460);
    });
  }

  if (w.grade !== "—") {
    ctx.fillStyle = "#7C8C84";
    ctx.font = "600 24px system-ui, sans-serif";
    drawSpaced(ctx, "HARDEST SEND", 540, 1610, 7);
    ctx.fillStyle = "#E4B363";
    ctx.font =
      '800 108px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(w.grade, 540, 1720);
  }

  ctx.fillStyle = "#4A564F";
  ctx.font = "24px system-ui, sans-serif";
  drawSpaced(ctx, "TRACK YOUR KLIMBS  ·  KLIMB", 540, 1850, 4);
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

  const fmt = (
    o: number | null | undefined,
    t: "boulder" | "toprope" | "lead",
  ): string | null =>
    o === null || o === undefined ? null : formatGradeStyled(o, t, system, "classic");
  const hardestBoulder = fmt(p.hardest_send.boulder, "boulder");
  const hardestTop = fmt(p.hardest_send.toprope, "toprope");
  const hardestLead = fmt(p.hardest_send.lead, "lead");
  const hardestPrimary = hardestBoulder ?? hardestTop ?? hardestLead ?? "—";
  const hardestBoth =
    [
      hardestBoulder && `${hardestBoulder} boulder`,
      hardestTop && `${hardestTop} TR`,
      hardestLead && `${hardestLead} lead`,
    ]
      .filter(Boolean)
      .join("  ·  ") || "—";

  // "What you climb" mix — use the direct recap counts when available and
  // gracefully derive them from the pyramid for older generated recaps.
  const derivedTypeCounts = p.pyramid.reduce(
    (counts, row) => {
      counts[row.type] += row.count;
      return counts;
    },
    { boulder: 0, toprope: 0, lead: 0 },
  );
  const typeCounts = p.type_counts ?? derivedTypeCounts;
  const mix: MixItem[] = (
    [
      { key: "boulder", label: "Boulder", hue: "#4ADE80" },
      { key: "toprope", label: "Top Rope", hue: "#60A5FA" },
      { key: "lead", label: "Lead", hue: "#E4B363" },
    ] as const
  )
    .map((item) => ({ ...item, n: typeCounts[item.key] ?? 0 }))
    .filter((item) => item.n > 0);
  const mixTotal = mix.reduce((sum, item) => sum + item.n, 0);

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
    if (mixTotal > 0) list.push("mix");
    list.push("share");
    return list;
  }, [hardestPrimary, mixTotal, p.streak]);

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

  const shareViaSheet = async (
    canvas: HTMLCanvasElement,
    shareText: string,
  ) => {
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

  // One native share surface, like Photos/YouTube: iOS shows every compatible
  // installed destination together (Instagram, Messages, WhatsApp, etc.).
  const shareRecap = async () => {
    const canvas = buildWrapCanvas(week, mix);
    await shareViaSheet(
      canvas,
      `${week.climbs} Klimbs, ${week.sends} sends — my ${periodWord} on Klimb 🧗`,
    );
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

        {card === "mix" && (
          <div
            style={{
              ...S.card,
              background:
                "radial-gradient(circle at 50% 35%, #13271c 0%, #0a100d 48%, #080B0A 100%)",
            }}
          >
            <div style={S.cardInner}>
              <div style={S.kicker}>HOW YOU SPENT YOUR {periodWord.toUpperCase()}</div>
              <h2 style={S.mixTitle}>Your climbing mix</h2>
              <p style={S.mixSub}>
                {mixTotal} {mixTotal === 1 ? "send" : "sends"} across{" "}
                {mix.length} {mix.length === 1 ? "discipline" : "disciplines"}
              </p>
              <div style={S.mixList}>
                {mix.map((item) => {
                  const percent = Math.round((item.n / mixTotal) * 100);
                  return (
                    <div key={item.key} style={S.mixRow}>
                      <div style={S.mixRowHead}>
                        <span style={S.mixLabel}>
                          <i
                            style={{
                              ...S.mixDot,
                              background: item.hue,
                              boxShadow: `0 0 16px ${item.hue}55`,
                            }}
                          />
                          {item.label}
                        </span>
                        <span style={S.mixCount}>
                          {item.n} <small style={S.mixPercent}>{percent}%</small>
                        </span>
                      </div>
                      <div style={S.mixTrack}>
                        <div
                          style={{
                            ...S.mixFill,
                            width: `${percent}%`,
                            background: item.hue,
                            boxShadow: `0 0 20px ${item.hue}33`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p style={S.mixNote}>
                {mix.length === 1
                  ? `${mix[0].label} owned the wall.`
                  : mix[0].n === Math.max(...mix.map((item) => item.n))
                    ? `${mix[0].label} led the way.`
                    : `${mix.reduce((best, item) => item.n > best.n ? item : best).label} led the way.`}
              </p>
            </div>
          </div>
        )}

        {card === "share" && (
          <div
            style={{
              ...S.card,
              background:
                "radial-gradient(circle at 50% 8%, #204d35 0%, #0d1b14 34%, #080B0A 72%)",
            }}
          >
            <div style={S.finishGlow} />
            <div style={S.finishOrbit} />
            <div style={{ ...S.cardInner, ...S.finishInner }}>
              <div style={S.finishHero}>
                <div style={S.finishMark}>
                  <Check size={24} strokeWidth={2.8} />
                </div>
                <div style={{ ...S.kicker, margin: "15px 0 10px" }}>
                  THAT&apos;S A WRAP
                </div>
                <h2 style={S.wrapTitle}>
                  Your {periodWord},
                  <br />
                  well spent.
                </h2>
                <p style={S.wrapSub}>
                  {week.climbs} climbs logged · {week.sends} sends earned
                </p>
              </div>

              <div style={S.finishPanel}>
                <div style={S.finishStats}>
                  <FinishStat value={week.climbs} label="Klimbs" />
                  <FinishStat value={week.sends} label="Sends" />
                  <FinishStat value={week.flashes} label="Flashes" />
                </div>

                {mix.length > 0 && (
                  <div style={S.finishMixBlock}>
                    <div style={S.finishSectionLabel}>WHAT YOU CLIMBED</div>
                    <div style={S.finishMixBar}>
                      {mix.map((item) => (
                        <i
                          key={item.key}
                          style={{
                            ...S.finishMixSegment,
                            background: item.hue,
                            flexGrow: item.n,
                          }}
                        />
                      ))}
                    </div>
                    <div style={S.finishMix}>
                      {mix.map((item) => (
                        <span key={item.key} style={S.finishMixItem}>
                          <i
                            style={{
                              ...S.finishMixDot,
                              background: item.hue,
                            }}
                          />
                          {Math.round((item.n / mixTotal) * 100)}% {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {hardestPrimary !== "—" && (
                  <div style={S.finishBest}>
                    <span style={S.finishBestLabel}>HARDEST SEND</span>
                    <strong style={S.finishBestGrade}>{hardestPrimary}</strong>
                  </div>
                )}
              </div>

              <button
                style={S.shareBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  void shareRecap();
                }}
              >
                <Share2 size={18} strokeWidth={2.4} /> Share your recap
              </button>
              <span style={S.shareHint}>Opens your iOS share menu</span>
            </div>
          </div>
        )}
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
              <div style={S.igNote}><Share2 size={14} color="#7C8C84" /> Save, then share anywhere</div>
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

function FinishStat({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div style={S.finishStat}>
      <strong style={S.finishStatValue}>{value}</strong>
      <span style={S.finishStatLabel}>{label}</span>
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
  grade: { fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif', fontSize: 92, fontWeight: 800, color: "#E4B363", textShadow: "0 0 44px rgba(228,179,99,0.4)", lineHeight: 1, letterSpacing: "-0.045em", whiteSpace: "nowrap", fontVariantNumeric: "lining-nums tabular-nums" },
  streakNum: { fontFamily: serif, fontSize: 82, fontWeight: 700, color: "#FB923C", lineHeight: 1, textShadow: "0 0 44px rgba(251,146,60,0.55)", fontVariantNumeric: "lining-nums tabular-nums", marginTop: 18 },
  streakDays: { fontFamily: serif, fontSize: 26, color: "#B8C4BD", fontWeight: 600 },
  streakDivider: { width: 44, height: 3, borderRadius: 3, background: "rgba(251,146,60,0.45)", margin: "22px 0 16px" },
  streakNote: { fontSize: 14.5, color: "#B8C4BD", lineHeight: 1.5, maxWidth: 240, margin: 0 },
  mixTitle: { fontFamily: serif, fontSize: 40, lineHeight: 1.06, fontWeight: 700, color: "#F1F8F2", margin: "2px 0 8px", letterSpacing: -1 },
  mixSub: { color: "#8FA096", fontSize: 13.5, lineHeight: 1.45, margin: 0 },
  mixList: { width: "100%", maxWidth: 330, display: "flex", flexDirection: "column", gap: 24, marginTop: 34 },
  mixRow: { width: "100%" },
  mixRowHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 9 },
  mixLabel: { display: "inline-flex", alignItems: "center", gap: 9, color: "#E8F0EB", fontSize: 15, fontWeight: 700 },
  mixDot: { display: "inline-block", width: 9, height: 9, borderRadius: 999 },
  mixCount: { color: "#F1F8F2", fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums" },
  mixPercent: { color: "#7C8C84", fontSize: 11, fontWeight: 650, marginLeft: 4 },
  mixTrack: { width: "100%", height: 8, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" },
  mixFill: { height: "100%", borderRadius: 999, minWidth: 8 },
  mixNote: { margin: "30px 0 0", color: "#B8C4BD", fontFamily: serif, fontSize: 16, fontStyle: "italic" },
  finishGlow: { position: "absolute", width: 310, height: 310, top: -164, left: "50%", transform: "translateX(-50%)", borderRadius: "50%", background: "rgba(74,222,128,0.14)", filter: "blur(72px)", pointerEvents: "none" },
  finishOrbit: { position: "absolute", width: 330, height: 330, top: -205, left: "50%", transform: "translateX(-50%)", borderRadius: "50%", border: "1px solid rgba(130,240,167,0.12)", boxShadow: "0 0 0 42px rgba(130,240,167,0.025), 0 0 0 84px rgba(130,240,167,0.018)", pointerEvents: "none" },
  finishInner: { justifyContent: "center", padding: "calc(env(safe-area-inset-top, 0px) + 62px) 24px calc(env(safe-area-inset-bottom, 0px) + 22px)" },
  finishHero: { display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 },
  finishMark: { width: 50, height: 50, borderRadius: 25, display: "flex", alignItems: "center", justifyContent: "center", color: "#07110B", background: "linear-gradient(145deg, #A3F7BE, #65E995)", border: "1px solid rgba(255,255,255,0.38)", boxShadow: "0 0 0 7px rgba(130,240,167,0.08), 0 14px 42px rgba(74,222,128,0.26)" },
  wrapTitle: { fontFamily: serif, fontSize: "clamp(35px, 10.4vw, 44px)", lineHeight: 1.01, fontWeight: 700, color: "#F4FAF6", margin: 0, letterSpacing: -1.35 },
  wrapSub: { color: "#ABC2B3", fontSize: "clamp(12px, 3.5vw, 14px)", margin: "11px 0 0" },
  finishPanel: { width: "100%", maxWidth: 350, margin: "clamp(20px, 4vh, 30px) 0 18px", padding: "18px 17px 16px", borderRadius: 22, background: "linear-gradient(155deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025))", border: "1px solid rgba(166,242,190,0.13)", boxShadow: "0 18px 52px rgba(0,0,0,0.22)", backdropFilter: "blur(14px)" },
  finishStats: { width: "100%", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 },
  finishStat: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "2px 6px 15px", borderBottom: "1px solid rgba(255,255,255,0.075)" },
  finishStatValue: { color: "#F1F8F2", fontFamily: serif, fontSize: 24, lineHeight: 1, fontVariantNumeric: "tabular-nums" },
  finishStatLabel: { color: "#7C8C84", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" },
  finishMixBlock: { marginTop: 15 },
  finishSectionLabel: { color: "#6F8177", fontSize: 8.5, fontWeight: 750, letterSpacing: "0.2em", textAlign: "left" },
  finishMixBar: { display: "flex", gap: 4, width: "100%", height: 7, marginTop: 10 },
  finishMixSegment: { display: "block", minWidth: 8, borderRadius: 999, boxShadow: "0 0 14px rgba(255,255,255,0.05)" },
  finishMix: { width: "100%", display: "flex", flexWrap: "wrap", justifyContent: "flex-start", gap: "7px 13px", marginTop: 10 },
  finishMixItem: { display: "inline-flex", alignItems: "center", gap: 5, color: "#9EAEA4", fontSize: 10, fontWeight: 650 },
  finishMixDot: { display: "inline-block", width: 6, height: 6, borderRadius: 999 },
  finishBest: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 14, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,0.075)" },
  finishBestLabel: { color: "#6F8177", fontSize: 8.5, fontWeight: 750, letterSpacing: "0.18em" },
  finishBestGrade: { color: "#E4B363", fontSize: 20, lineHeight: 1, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" },
  shareBtn: { width: "100%", maxWidth: 350, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 15, fontWeight: 800, color: "#07110B", background: "linear-gradient(135deg, #64E992, #43D979)", border: "1px solid rgba(255,255,255,0.24)", padding: "15px 18px", borderRadius: 17, boxShadow: "0 14px 34px rgba(74,222,128,0.19)", cursor: "pointer" },
  shareHint: { color: "#607168", fontSize: 10.5, marginTop: 8, letterSpacing: "0.01em" },
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
