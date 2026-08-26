import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { REACTION_PRESETS } from "../lib/reactions";

const SIMPLE_REACTIONS = REACTION_PRESETS.slice(0, 6);

/** A lightweight reaction control. Tapping reveals a smooth fan instead of
 * permanently crowding every activity card with emoji buttons. */
export function ActivityReactions({
  mine,
  busy,
  onReact,
}: {
  mine: string | null;
  busy: boolean;
  onReact: (reaction: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const visible = mine && !SIMPLE_REACTIONS.includes(mine as typeof SIMPLE_REACTIONS[number])
    ? [mine, ...SIMPLE_REACTIONS.slice(0, 5)]
    : SIMPLE_REACTIONS;

  function showFan() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setOrigin({ x: rect.left + rect.width / 2, y: rect.top + 2 });
    setOpen(true);
    setHovered(null);
    navigator.vibrate?.(10);
  }

  function fanPoint(index: number) {
    const angle = Math.PI + (Math.PI * index) / (visible.length - 1);
    const radius = 92;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius - 12,
    };
  }

  function choose(reaction: string) {
    onReact(reaction);
    setOpen(false);
  }

  return (
    <>
      <div className="border-t border-white/[0.05] px-3 py-2.5">
        <button
          ref={triggerRef}
          type="button"
          disabled={busy}
          onClick={() => open ? setOpen(false) : showFan()}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`flex h-10 w-full touch-manipulation items-center justify-center gap-2 rounded-full text-xs font-bold transition active:scale-[0.98] disabled:opacity-50 ${
            mine ? "bg-accent/12 text-chalk ring-1 ring-accent/35" : "bg-white/[0.035] text-muted"
          }`}
        >
          {mine ? <span className="text-xl" aria-hidden>{mine}</span> : null}
          {mine ? "Tap to change" : "Tap to react"}
        </button>
      </div>
      {open ? createPortal(
        <div className="fixed inset-0 z-[90]" role="presentation" onPointerDown={() => setOpen(false)}>
          <div
            role="menu"
            aria-label="Choose a reaction"
            className="absolute"
            style={{ left: origin.x, top: origin.y }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {visible.map((reaction, index) => {
              const { x, y } = fanPoint(index);
              const selected = mine === reaction;
              const highlighted = hovered === reaction;
              return (
                <button
                  key={reaction}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  aria-label={selected ? `${reaction} reaction selected` : `React ${reaction}`}
                  onClick={() => choose(reaction)}
                  onPointerEnter={() => setHovered(reaction)}
                  onPointerLeave={() => setHovered(null)}
                  className={`absolute grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border text-[24px] shadow-2xl backdrop-blur-xl transition duration-200 ease-out active:scale-90 ${
                    selected || highlighted
                      ? "border-accent/70 bg-accent/25"
                      : "border-white/10 bg-[#1b1d1c]/95"
                  }`}
                  style={{
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                    animation: `reaction-fan-in 180ms ${index * 18}ms cubic-bezier(.2,.9,.2,1) both`,
                    scale: highlighted ? "1.18" : "1",
                  }}
                >
                  {reaction}
                </button>
              );
            })}
          </div>
          <style>{`@keyframes reaction-fan-in { from { opacity: 0; scale: .65; } to { opacity: 1; scale: 1; } }`}</style>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
