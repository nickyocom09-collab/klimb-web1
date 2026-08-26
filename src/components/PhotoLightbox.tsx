import { useRef, useState, type TouchEvent, type WheelEvent } from "react";
import { X } from "lucide-react";

type Point = { x: number; y: number };
type Gesture = {
  distance: number;
  center: Point;
  scale: number;
  offset: Point;
};

const clampScale = (value: number) => Math.min(5, Math.max(1, value));
const distance = (a: React.Touch, b: React.Touch) =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
const center = (a: React.Touch, b: React.Touch): Point => ({
  x: (a.clientX + b.clientX) / 2,
  y: (a.clientY + b.clientY) / 2,
});

export function PhotoLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [settling, setSettling] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const dragStart = useRef<{ touch: Point; offset: Point } | null>(null);
  const moved = useRef(false);
  const lastTap = useRef(0);

  const boundedOffset = (point: Point, atScale = scale): Point => {
    const rect = viewport.current?.getBoundingClientRect();
    if (!rect || atScale <= 1) return { x: 0, y: 0 };
    const maxX = (rect.width * (atScale - 1)) / 2;
    const maxY = (rect.height * (atScale - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, point.x)),
      y: Math.max(-maxY, Math.min(maxY, point.y)),
    };
  };

  const animateTo = (nextScale: number, nextOffset: Point = offset) => {
    const boundedScale = clampScale(nextScale);
    setSettling(true);
    setScale(boundedScale);
    setOffset(boundedOffset(nextOffset, boundedScale));
    window.setTimeout(() => setSettling(false), 240);
  };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    moved.current = false;
    setSettling(false);
    if (event.touches.length === 2) {
      const a = event.touches[0];
      const b = event.touches[1];
      gesture.current = {
        distance: distance(a, b),
        center: center(a, b),
        scale,
        offset,
      };
      dragStart.current = null;
    } else if (event.touches.length === 1 && scale > 1) {
      dragStart.current = {
        touch: { x: event.touches[0].clientX, y: event.touches[0].clientY },
        offset,
      };
    }
  };

  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (event.cancelable) event.preventDefault();
    moved.current = true;
    if (event.touches.length === 2 && gesture.current) {
      const a = event.touches[0];
      const b = event.touches[1];
      const nextCenter = center(a, b);
      const nextScale = clampScale(
        gesture.current.scale * (distance(a, b) / gesture.current.distance),
      );
      setScale(nextScale);
      setOffset(
        boundedOffset(
          {
            x: gesture.current.offset.x + nextCenter.x - gesture.current.center.x,
            y: gesture.current.offset.y + nextCenter.y - gesture.current.center.y,
          },
          nextScale,
        ),
      );
    } else if (event.touches.length === 1 && dragStart.current && scale > 1) {
      setOffset(
        boundedOffset({
          x: dragStart.current.offset.x + event.touches[0].clientX - dragStart.current.touch.x,
          y: dragStart.current.offset.y + event.touches[0].clientY - dragStart.current.touch.y,
        }),
      );
    }
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length > 0) return;
    gesture.current = null;
    dragStart.current = null;
    if (!moved.current) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        animateTo(scale > 1 ? 1 : 2.5, { x: 0, y: 0 });
        lastTap.current = 0;
        return;
      }
      lastTap.current = now;
    }
    if (scale <= 1.04) {
      animateTo(1, { x: 0, y: 0 });
      return;
    }
    setOffset((value) => boundedOffset(value));
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    animateTo(scale + (event.deltaY < 0 ? 0.35 : -0.35));
  };

  return (
    <div
      ref={viewport}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Route photo"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
      onDoubleClick={() => animateTo(scale > 1 ? 1 : 2.5, { x: 0, y: 0 })}
      style={{ touchAction: "none" }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        onContextMenu={(event) => event.preventDefault()}
        className={`max-h-full max-w-full select-none object-contain ${settling ? "transition-transform duration-200 ease-out" : ""}`}
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
          WebkitTouchCallout: "none",
          willChange: "transform",
        }}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition active:scale-95"
      >
        <X size={23} />
      </button>
    </div>
  );
}
