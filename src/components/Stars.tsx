import { useState } from "react";
import { Star } from "lucide-react";

/**
 * Green 5-star "fun factor" rating.
 * - Read-only when no onChange: renders a fractional average (partial fill).
 * - Interactive when onChange is set: tap or hover to rate, accent green.
 */
export function Stars({
  value,
  onChange,
  size = 22,
  className = "",
}: {
  value: number | null;
  onChange?: (stars: number) => void;
  size?: number;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const interactive = !!onChange;
  const shown = interactive ? (hover ?? value ?? 0) : (value ?? 0);

  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      onMouseLeave={() => setHover(null)}
      role={interactive ? "radiogroup" : "img"}
      aria-label={
        value === null ? "Not rated" : `${value.toFixed(1)} out of 5 stars`
      }
    >
      {[1, 2, 3, 4, 5].map((star) => {
        // Fill fraction for this star (supports read-only fractional averages).
        const fill = Math.max(0, Math.min(1, shown - (star - 1)));
        const inner = (
          <span
            className="relative block"
            style={{ width: size, height: size }}
          >
            <Star
              size={size}
              className="absolute inset-0 text-border"
              fill="currentColor"
              strokeWidth={0}
            />
            <span
              className="absolute inset-0 overflow-hidden transition-[width] duration-200"
              style={{ width: `${fill * 100}%` }}
            >
              <Star
                size={size}
                className="text-accent drop-shadow-[0_0_5px_rgb(57_255_136_/_0.45)]"
                fill="currentColor"
                strokeWidth={0}
              />
            </span>
          </span>
        );
        return interactive ? (
          <button
            key={star}
            type="button"
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onMouseEnter={() => setHover(star)}
            onClick={() => onChange!(star)}
            className="transition-transform duration-150 hover:scale-125 active:scale-95"
          >
            {inner}
          </button>
        ) : (
          <span key={star}>{inner}</span>
        );
      })}
    </div>
  );
}
