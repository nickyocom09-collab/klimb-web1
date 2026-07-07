import { useEffect, useMemo, useState } from "react";
import { Flame, Star, TrendingDown, TrendingUp, X, Zap } from "lucide-react";
import type { RecapRow } from "../lib/recaps";
import { superlative } from "../lib/recaps";
import { formatGradeStyled, type GradeSystem } from "../lib/grades";
import { holdHex } from "../lib/constants";

/** rAF count-up for the big hero numbers. */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min((t - start) / duration, 1);
      // ease-out cubic
      setValue(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function BigNumber({ n }: { n: number }) {
  const v = useCountUp(n);
  return (
    <span className="text-7xl font-extrabold leading-none tabular-nums text-accent">
      {v}
    </span>
  );
}

const CONFETTI_COLORS = ["#39FF88", "#FF9F45", "#EC4899", "#14B8A6", "#FFD23F"];

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 9) * 0.14}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 5 + ((i * 13) % 6),
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute -top-3 animate-confetti rounded-sm"
          style={{
            left: b.left,
            width: b.size,
            height: b.size * 1.6,
            backgroundColor: b.color,
            animationDelay: b.delay,
          }}
        />
      ))}
    </div>
  );
}

/**
 * The recap story — a full-screen, tap-through, animated summary of a week
 * or month of climbing. Numbers count up, the pyramid draws in, confetti
 * flies when a new grade got unlocked. Built to be screenshot-worthy.
 */
export function RecapStory({
  recap,
  system,
  onClose,
}: {
  recap: RecapRow;
  system: GradeSystem;
  onClose: () => void;
}) {
  const p = recap.payload;
  const [card, setCard] = useState(0);
  const label = recap.period === "weekly" ? "week" : "month";
  const sup = superlative(p);

  const fmtOrd = (
    o: number | null | undefined,
    t: "boulder" | "toprope",
  ): string | null =>
    o === null || o === undefined
      ? null
      : formatGradeStyled(o, t, system, "classic");

  const hardestSend = [
    fmtOrd(p.hardest_send.boulder, "boulder"),
    fmtOrd(p.hardest_send.toprope, "toprope"),
  ]
    .filter(Boolean)
    .join(" · ");
  const hardestFlash = [
    fmtOrd(p.hardest_flash.boulder, "boulder"),
    fmtOrd(p.hardest_flash.toprope, "toprope"),
  ]
    .filter(Boolean)
    .join(" · ");

  const delta = p.climbs - p.prev.climbs;
  const maxPyr = Math.max(...p.pyramid.map((b) => b.count), 1);

  // Card definitions — each renders fresh (keyed) so animations replay.
  const cards: (() => React.ReactNode)[] = [
    () => (
      <>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Your {label} in climbing
        </p>
        <BigNumber n={p.climbs} />
        <p className="text-lg font-semibold text-chalk">
          climb{p.climbs === 1 ? "" : "s"} logged
        </p>
        <p className="text-sm text-muted">
          across {p.sessions} session{p.sessions === 1 ? "" : "s"}
        </p>
      </>
    ),
    () => (
      <>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
          Sends
        </p>
        <BigNumber n={p.sends} />
        <div className="flex items-center gap-2 text-lg font-semibold text-chalk">
          <Zap size={20} className="text-accent" /> {p.flashes} flash
          {p.flashes === 1 ? "" : "es"}
          {p.flash_rate !== null ? (
            <span className="text-muted">· {p.flash_rate}% flash rate</span>
          ) : null}
        </div>
        <p className="text-sm text-muted">{p.attempts} total tries</p>
      </>
    ),
    () => (
      <>
        {p.new_grades.length > 0 ? <Confetti /> : null}
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
          Hardest
        </p>
        <span className="animate-pop text-6xl font-extrabold leading-none text-accent">
          {hardestSend || "—"}
        </span>
        {hardestFlash ? (
          <p className="flex items-center gap-1.5 text-lg font-semibold text-chalk">
            <Zap size={18} className="text-accent" /> flashed up to{" "}
            {hardestFlash}
          </p>
        ) : null}
        {p.new_grades.length > 0 ? (
          <p className="rounded-full bg-accent/15 px-4 py-1.5 text-sm font-bold text-accent">
            🎉 New grade{p.new_grades.length === 1 ? "" : "s"} unlocked:{" "}
            {p.new_grades
              .map((g) => fmtOrd(g.ordinal, g.type))
              .filter(Boolean)
              .join(", ")}
          </p>
        ) : null}
      </>
    ),
    () => (
      <>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
          The {label}'s pyramid
        </p>
        <div className="flex w-full max-w-[260px] flex-col gap-1.5">
          {p.pyramid.length === 0 ? (
            <p className="text-center text-muted">No graded sends this {label}</p>
          ) : (
            p.pyramid.map((b, i) => (
              <div key={`${b.type}-${b.ordinal}`} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-right text-xs font-semibold text-muted">
                  {fmtOrd(b.ordinal, b.type)}
                </span>
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full animate-grow-bar rounded-full bg-accent"
                    style={{
                      width: `${(b.count / maxPyr) * 100}%`,
                      animationDelay: `${i * 120}ms`,
                    }}
                  />
                </div>
                <span className="w-5 shrink-0 text-xs tabular-nums text-faint">
                  {b.count}
                </span>
              </div>
            ))
          )}
        </div>
        {p.top_wall ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            Favorite spot:{" "}
            <span className="font-semibold text-chalk">{p.top_wall}</span>
            {p.top_color ? (
              <span className="flex items-center gap-1 font-semibold text-chalk">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-white/10"
                  style={{ backgroundColor: holdHex(p.top_color) }}
                />
                {p.top_color}
              </span>
            ) : null}
          </p>
        ) : null}
      </>
    ),
    () => (
      <>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
          This {label} you were
        </p>
        <span className="animate-pop bg-gradient-to-b from-chalk to-accent bg-clip-text text-5xl font-extrabold leading-tight text-transparent">
          {sup.title}
        </span>
        <p className="text-sm text-muted">{sup.why}</p>
        <div className="mt-2 flex flex-col items-center gap-1.5 text-sm text-muted">
          <p className="flex items-center gap-1.5">
            {delta >= 0 ? (
              <TrendingUp size={16} className="text-accent" />
            ) : (
              <TrendingDown size={16} className="text-wide" />
            )}
            {delta === 0
              ? `Same volume as last ${label}`
              : `${delta > 0 ? "+" : ""}${delta} climbs vs last ${label}`}
          </p>
          {p.streak > 1 ? (
            <p className="flex items-center gap-1.5">
              <Flame size={16} className="text-wide" /> {p.streak}-{label} streak
              — keep it alive
            </p>
          ) : null}
          {p.projects_open > 0 ? (
            <p className="flex items-center gap-1.5">
              <Star size={15} className="text-accent" />
              {p.projects_open} open project
              {p.projects_open === 1 ? "" : "s"}
              {p.oldest_project_days
                ? ` — oldest ${p.oldest_project_days}d and counting`
                : ""}
            </p>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-faint">See you on the wall 🧗</p>
      </>
    ),
  ];

  function advance() {
    if (card < cards.length - 1) setCard(card + 1);
    else onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex max-w-app cursor-pointer flex-col bg-bg"
      onClick={advance}
    >
      {/* progress */}
      <div className="flex gap-1.5 px-5 pt-5">
        {cards.map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= card ? "bg-accent" : "bg-surface-2"
            }`}
          />
        ))}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close recap"
        className="absolute right-4 top-9 z-10 rounded-full bg-surface/80 p-2 text-muted backdrop-blur transition hover:text-chalk"
      >
        <X size={20} />
      </button>

      {/* glow backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
      />

      {/* card content — keyed so entering a card replays its animations */}
      <div
        key={card}
        className="relative flex flex-1 animate-fade-up flex-col items-center justify-center gap-4 px-8 text-center"
      >
        {cards[card]()}
      </div>

      <p className="pb-8 text-center text-xs text-faint">
        Tap to continue · {card + 1}/{cards.length}
      </p>
    </div>
  );
}
