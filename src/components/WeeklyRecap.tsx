import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Flame,
  Mountain,
  Zap,
  TrendingUp,
  Download,
  X,
  Check,
  Share2,
  ChevronDown,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Directory, Filesystem } from "@capacitor/filesystem";
import type { RecapRow } from "../lib/recaps";
import { formatGradeStyled, type GradeSystem } from "../lib/grades";
import { archetypeFor } from "../lib/weeklyRecapArchetype";
import { StreakFire } from "./StreakFire";

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
    () => archetypeFor(p),
    [p],
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((index: number) => {
    const nextIndex = Math.max(0, Math.min(index, cards.length - 1));
    setI(nextIndex);
    const scroller = scrollRef.current;
    if (scroller) {
      scroller.scrollTo({ top: scroller.clientHeight * nextIndex, behavior: "smooth" });
    }
  }, [cards.length]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "PageUp") goTo(i - 1);
      if (e.key === "ArrowDown" || e.key === "PageDown") goTo(i + 1);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [goTo, i, onClose]);

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

  return (
    <div style={S.root}>
      <style>{CSS}</style>
      <div style={S.phone}>
        <button style={S.close} onClick={onClose} aria-label="Close recap">
          <X size={18} color="#B8C4BD" />
        </button>

        <div
          ref={scrollRef}
          className="klimb-recap-pages"
          style={S.pages}
          onScroll={(event) => {
            const element = event.currentTarget;
            const nextIndex = Math.round(element.scrollTop / Math.max(1, element.clientHeight));
            if (nextIndex !== i) setI(nextIndex);
          }}
        >
        {cards.map((card) => (
          <section key={card} style={S.page} aria-label={`${cards.indexOf(card) + 1} of ${cards.length}`}>
        {card === "arch" && (
          <div style={S.card}>
            <RocksCanvas />
            <div style={S.scrim} />
            <div style={S.cardInner}>
              <div style={S.kicker}>THIS {periodWord.toUpperCase()} YOU WERE</div>
              <h1 style={{ ...S.archTitle, color: arch.hue, textShadow: `0 0 34px ${arch.hue}66` }}>{arch.label}</h1>
              <p style={S.archSub}>{arch.sub}</p>
            </div>
            <div className="klimb-recap-cue" style={S.scrollCue} aria-hidden="true">
              <span style={S.scrollCueLabel}>Scroll</span>
              <ChevronDown size={19} />
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
                "radial-gradient(circle at 50% -2%, #235f3e 0%, #113522 30%, #08140e 58%, #050807 100%)",
            }}
          >
            <div style={S.finishOrbit} />
            <div className="klimb-recap-finish" style={{ ...S.cardInner, ...S.finishInner }}>
              <div style={S.finishHero}>
                <div style={S.finishMark}>
                  <Check size={30} strokeWidth={3.1} />
                </div>
                <div style={S.finishKicker}>
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
                <Share2 size={20} strokeWidth={2.5} /> Share your recap
              </button>
              <span style={S.shareHint}>Opens your iOS share menu</span>
            </div>
          </div>
        )}
          </section>
        ))}
        </div>
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
  phone: { position: "relative", width: "100%", maxWidth: 480, height: "100%", overflow: "hidden", background: "#080B0A", userSelect: "none", margin: "0 auto" },
  pages: { width: "100%", height: "100%", display: "flex", flexDirection: "column", overflowX: "hidden", overflowY: "auto", scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch", touchAction: "pan-y", overscrollBehaviorY: "contain" },
  page: { position: "relative", width: "100%", minHeight: "100%", height: "100%", flex: "0 0 100%", scrollSnapAlign: "start", scrollSnapStop: "always", overflow: "hidden" },
  close: { position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 24px)", right: 14, zIndex: 25, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, width: 34, height: 34, display: "grid", placeItems: "center", cursor: "pointer" },
  card: { position: "absolute", inset: 0, overflow: "hidden" },
  scrim: { position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 45%, rgba(8,11,10,0.35), rgba(8,11,10,0.86))" },
  cardInner: { position: "relative", zIndex: 5, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 30px" },
  kicker: { fontSize: 11, letterSpacing: "0.3em", color: "#7C8C84", fontWeight: 600, marginBottom: 14 },
  archTitle: { fontFamily: serif, fontSize: 52, fontWeight: 700, lineHeight: 1.02, margin: 0 },
  archSub: { fontSize: 15, color: "#B8C4BD", marginTop: 16, maxWidth: 280, lineHeight: 1.45 },
  scrollCue: { position: "absolute", zIndex: 8, left: "50%", bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: "rgba(184,196,189,.74)", animation: "klimb-recap-cue 1.7s ease-in-out infinite", pointerEvents: "none" },
  scrollCueLabel: { fontSize: 9, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase" },
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
  finishOrbit: { position: "absolute", width: "118vw", maxWidth: 560, height: "118vw", maxHeight: 560, top: "calc(env(safe-area-inset-top, 0px) - 53vw)", left: "50%", transform: "translateX(-50%)", borderRadius: "50%", border: "1px solid rgba(130,240,167,0.12)", boxShadow: "0 0 0 42px rgba(130,240,167,0.028), 0 0 0 86px rgba(130,240,167,0.018)", pointerEvents: "none" },
  finishInner: { justifyContent: "flex-start", overflow: "hidden", padding: "calc(env(safe-area-inset-top, 0px) + clamp(98px, 13vh, 138px)) 24px calc(env(safe-area-inset-bottom, 0px) + 18px)" },
  finishHero: { display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 },
  finishMark: { width: 60, height: 60, borderRadius: 30, display: "flex", alignItems: "center", justifyContent: "center", color: "#07110B", background: "linear-gradient(145deg, #A3F7BE, #65E995)", border: "1px solid rgba(255,255,255,0.45)", boxShadow: "0 0 0 8px rgba(130,240,167,0.08), 0 14px 42px rgba(74,222,128,0.24)" },
  finishKicker: { color: "#7C8C84", fontSize: 11, fontWeight: 700, letterSpacing: "0.3em", margin: "22px 0 14px" },
  wrapTitle: { fontFamily: serif, fontSize: "clamp(43px, 12vw, 54px)", lineHeight: 0.95, fontWeight: 700, color: "#F4FAF6", margin: 0, letterSpacing: -1.65 },
  wrapSub: { color: "#ABC2B3", fontSize: "clamp(13px, 3.8vw, 16px)", margin: "18px 0 0", letterSpacing: "0.01em" },
  finishPanel: { width: "100%", maxWidth: 390, margin: "clamp(18px, 3.2vh, 30px) 0 16px", padding: "clamp(16px, 2.6vh, 22px) 20px 18px", borderRadius: 24, background: "rgba(18,29,23,0.8)", border: "1px solid rgba(166,242,190,0.18)", boxShadow: "0 18px 52px rgba(0,0,0,0.18)", backdropFilter: "blur(14px)" },
  finishStats: { width: "100%", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 },
  finishStat: { display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "2px 6px 21px", borderBottom: "1px solid rgba(255,255,255,0.09)" },
  finishStatValue: { color: "#F1F8F2", fontFamily: serif, fontSize: 29, lineHeight: 1, fontVariantNumeric: "tabular-nums" },
  finishStatLabel: { color: "#7C8C84", fontSize: 10.5, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.1em" },
  finishMixBlock: { marginTop: 20 },
  finishSectionLabel: { color: "#7D9085", fontSize: 9.5, fontWeight: 750, letterSpacing: "0.24em", textAlign: "left" },
  finishMixBar: { display: "flex", gap: 5, width: "100%", height: 8, marginTop: 13 },
  finishMixSegment: { display: "block", minWidth: 8, borderRadius: 999, boxShadow: "0 0 14px rgba(255,255,255,0.05)" },
  finishMix: { width: "100%", display: "flex", flexWrap: "wrap", justifyContent: "flex-start", gap: "8px 16px", marginTop: 13 },
  finishMixItem: { display: "inline-flex", alignItems: "center", gap: 6, color: "#A8B7AE", fontSize: 11.5, fontWeight: 650 },
  finishMixDot: { display: "inline-block", width: 7, height: 7, borderRadius: 999 },
  finishBest: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 18, paddingTop: 17, borderTop: "1px solid rgba(255,255,255,0.09)" },
  finishBestLabel: { color: "#7D9085", fontSize: 9.5, fontWeight: 750, letterSpacing: "0.22em" },
  finishBestGrade: { color: "#E4B363", fontSize: 24, lineHeight: 1, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" },
  shareBtn: { width: "100%", maxWidth: 390, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 17, fontWeight: 800, color: "#07110B", background: "linear-gradient(135deg, #64E992, #43D979)", border: "1px solid rgba(255,255,255,0.3)", padding: "18px 20px", borderRadius: 22, boxShadow: "0 14px 38px rgba(74,222,128,0.21)", cursor: "pointer", flexShrink: 0 },
  shareHint: { color: "#607168", fontSize: 11.5, marginTop: 10, letterSpacing: "0.01em", flexShrink: 0 },
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
.klimb-recap-pages{scrollbar-width:none;overscroll-behavior-y:contain;}
.klimb-recap-pages::-webkit-scrollbar{display:none;}
@keyframes klimb-recap-cue {
  0%, 100% { transform: translate(-50%, 0); opacity: .55; }
  50% { transform: translate(-50%, 7px); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .klimb-recap-cue { animation: none !important; }
}
@media (max-height: 760px) {
  .klimb-recap-finish { padding-top: calc(env(safe-area-inset-top, 0px) + 76px) !important; }
  .klimb-recap-finish h2 { font-size: 38px !important; }
  .klimb-recap-finish > div:nth-child(2) { margin-top: 14px !important; padding-top: 14px !important; padding-bottom: 14px !important; }
}
`;
