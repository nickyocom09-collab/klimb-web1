import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

type Point = { x: number; y: number };
type Transform = { scale: number; x: number; y: number };

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Full-screen, Photos-style image viewer with pinch, pan and double-tap zoom. */
export function ZoomPhotoViewer({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, Point>());
  const gestureStart = useRef<{
    transform: Transform;
    point?: Point;
    distance?: number;
    midpoint?: Point;
  } | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  function beginGesture() {
    const points = [...pointers.current.values()];
    if (points.length === 1) {
      gestureStart.current = { transform, point: points[0] };
    } else if (points.length >= 2) {
      gestureStart.current = {
        transform,
        distance: Math.max(distance(points[0], points[1]), 1),
        midpoint: midpoint(points[0], points[1]),
      };
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    beginGesture();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gestureStart.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    const start = gestureStart.current;

    if (points.length >= 2 && start.distance && start.midpoint) {
      const nextMidpoint = midpoint(points[0], points[1]);
      const nextScale = clamp(
        start.transform.scale * (distance(points[0], points[1]) / start.distance),
        1,
        5,
      );
      setTransform({
        scale: nextScale,
        x: start.transform.x + nextMidpoint.x - start.midpoint.x,
        y: start.transform.y + nextMidpoint.y - start.midpoint.y,
      });
    } else if (points.length === 1 && start.point && start.transform.scale > 1) {
      setTransform({
        ...start.transform,
        x: start.transform.x + points[0].x - start.point.x,
        y: start.transform.y + points[0].y - start.point.y,
      });
    }
  }

  function finishPointer(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) {
      gestureStart.current = null;
      setTransform((current) =>
        current.scale <= 1.02 ? { scale: 1, x: 0, y: 0 } : current,
      );
    } else {
      beginGesture();
    }
  }

  function toggleZoom(event: ReactPointerEvent<HTMLImageElement>) {
    event.stopPropagation();
    setTransform((current) =>
      current.scale > 1
        ? { scale: 1, x: 0, y: 0 }
        : { scale: 2.5, x: 0, y: 0 },
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-[100] flex touch-none select-none items-center justify-center overflow-hidden bg-black"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onContextMenu={(event) => event.preventDefault()}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        onDoubleClick={toggleZoom}
        className="max-h-full max-w-full object-contain will-change-transform"
        style={{
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
          transition: pointers.current.size === 0 ? "transform 180ms ease-out" : "none",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/75 to-transparent px-5 pb-[max(22px,env(safe-area-inset-bottom))] pt-16">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
          className="pointer-events-auto min-w-32 rounded-full bg-white px-7 py-3 text-sm font-extrabold text-black transition active:scale-95"
        >
          Done
        </button>
      </div>
    </div>,
    document.body,
  );
}
