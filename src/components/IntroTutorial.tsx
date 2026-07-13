import { useRef, useState } from "react";
import {
  BookmarkPlus,
  MapPin,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { Button } from "./ui";
import { KMark } from "./KMark";

type Slide = {
  Icon: LucideIcon | null;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    Icon: null, // slide 0 uses the K mark
    title: "Welcome to Klimb",
    body: "Your logs. Your stats. All in one place.",
  },
  {
    Icon: Trophy,
    title: "Log your sends",
    body: "Flashed it or fought for it? Log every climb and watch your progress stack up.",
  },
  {
    Icon: BookmarkPlus,
    title: "Save your projects",
    body: "Working a route? Save it as a project, jot down beta notes, and track your attempts until you send.",
  },
  {
    Icon: MapPin,
    title: "Gyms around the world",
    body: "Every gym you climb at turns gold on your map. Collect them all.",
  },
  {
    Icon: Users,
    title: "See your crew",
    body: "Add friends, peek at their logs and projects, and see who's climbing what.",
  },
];

/**
 * First-launch "how Klimb works" carousel. Shows once per user (the
 * profiles.seen_intro flag follows them across devices); Skip in the
 * top-right dismisses from any slide. ~10 seconds to skim, by design.
 */
export function IntroTutorial() {
  const { updateProfile } = useAuth();
  const [slide, setSlide] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const touchX = useRef<number | null>(null);

  const last = slide === SLIDES.length - 1;

  async function dismiss() {
    setLeaving(true);
    await updateProfile({ seen_intro: true });
  }

  function next() {
    if (last) void dismiss();
    else setSlide((s) => s + 1);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (dx < -40 && !last) setSlide((s) => s + 1);
    else if (dx > 40 && slide > 0) setSlide((s) => s - 1);
  }

  if (leaving) return null;

  const { Icon, title, body } = SLIDES[slide];

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex max-w-app flex-col bg-bg pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Skip — always visible, top-right, min 44px tap target */}
      <div className="flex justify-end px-4">
        <button
          onClick={dismiss}
          className="min-h-[44px] rounded-full px-4 text-sm font-semibold text-muted transition hover:text-chalk"
        >
          Skip
        </button>
      </div>

      {/* Soft brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
      />

      {/* Slide — keyed so each entrance animates fresh */}
      <div
        key={slide}
        className="relative flex flex-1 animate-fade-up flex-col items-center justify-center gap-5 px-10 text-center"
      >
        <span className="flex h-24 w-24 animate-pop items-center justify-center rounded-3xl bg-accent/10">
          {Icon ? (
            <Icon size={44} className="text-accent" strokeWidth={1.8} />
          ) : (
            <KMark className="h-12 w-12 text-accent" />
          )}
        </span>
        {slide === 0 ? (
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">
            Klimb
          </p>
        ) : null}
        <h1 className="text-3xl font-extrabold leading-tight text-chalk">
          {title}
        </h1>
        <p className="max-w-xs text-base leading-relaxed text-muted">{body}</p>
      </div>

      {/* Dots + primary action */}
      <div className="flex flex-col items-center gap-6 px-8">
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === slide ? "w-6 bg-accent" : "w-2 bg-surface-2"
              }`}
            />
          ))}
        </div>
        <Button className="w-full" onClick={next}>
          {last ? "Let's climb" : "Next"}
        </Button>
      </div>
    </div>
  );
}
