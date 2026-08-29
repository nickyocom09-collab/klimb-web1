import { useEffect, useRef, useState } from "react";
import { BarChart3, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useEntitlements } from "../lib/entitlements";
import { STOREKIT_CONFIG } from "../lib/entitlementFeatures";

const DISCOVERY_COPY = {
  eyebrow: "Climb with the full picture",
  title: "See what your sessions are building.",
  body: "Unlock progress ranges, flash rate, attempts per send, records, deeper gym insights, and more.",
} as const;

function localSeenKey(profileId: string) {
  return `klimb.pro-intro-seen.${profileId}`;
}

function tabProgressKey(profileId: string) {
  return `klimb.pro-intro-tabs.${profileId}`;
}

function statusLabel(state: string) {
  if (state === "loading") return "Loading Apple pricing…";
  if (state === "purchasing") return "Waiting for Apple…";
  if (state === "verifying") return "Unlocking Pro…";
  if (state === "restoring") return "Restoring…";
  return "Working with Apple…";
}

/**
 * A one-time, contextual Pro introduction. It appears only after a new free
 * account has explored two different primary tabs, never as the direct result
 * of tapping a locked feature. The grabber is functional: drag down to dismiss.
 */
export function ProOfferSheet() {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const {
    hasProAccess,
    monthlyProduct,
    purchaseState,
    error,
    restorePurchases,
    trackEvent,
  } = useEntitlements();
  const [open, setOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const dragStart = useRef<{ y: number; at: number } | null>(null);
  const openTimer = useRef<number | null>(null);
  const enterTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const close = () => {
    if (dismissing) return;
    setDragging(false);
    setDismissing(true);
    setDragY(Math.max(window.innerHeight, 720));
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setDragY(0);
      setDismissing(false);
    }, 280);
  };

  useEffect(() => {
    if (
      !profile?.onboarded ||
      profile.pro_intro_seen_at ||
      hasProAccess ||
      window.location.pathname.startsWith("/upgrade")
    ) {
      return;
    }
    try {
      if (localStorage.getItem(localSeenKey(profile.id))) return;
    } catch {
      // The server timestamp remains the cross-device source of truth.
    }

    const progressKey = tabProgressKey(profile.id);
    const onPrimaryTabClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const tab = target.closest<HTMLAnchorElement>(
        'nav[aria-label="Primary"] a[href]',
      );
      if (!tab) return;

      let visited: string[] = [];
      try {
        visited = JSON.parse(
          sessionStorage.getItem(progressKey) ?? "[]",
        ) as string[];
      } catch {
        visited = [];
      }
      const destination = tab.getAttribute("href") ?? "";
      if (!destination || visited.includes(destination)) return;
      const next = [...visited, destination].slice(-2);
      try {
        sessionStorage.setItem(progressKey, JSON.stringify(next));
      } catch {
        // The in-memory interaction can still open the sheet below.
      }
      if (next.length < 2) return;

      try {
        localStorage.setItem(localSeenKey(profile.id), "1");
        sessionStorage.removeItem(progressKey);
      } catch {
        // Best effort; the profile update below also prevents repeats.
      }
      openTimer.current = window.setTimeout(() => {
        setDragY(Math.max(window.innerHeight, 720));
        setOpen(true);
        enterTimer.current = window.setTimeout(() => setDragY(0), 20);
        void updateProfile({ pro_intro_seen_at: new Date().toISOString() });
      }, 420);
      document.removeEventListener("click", onPrimaryTabClick, true);
    };

    document.addEventListener("click", onPrimaryTabClick, true);
    return () => {
      document.removeEventListener("click", onPrimaryTabClick, true);
      if (openTimer.current !== null) window.clearTimeout(openTimer.current);
      if (enterTimer.current !== null) window.clearTimeout(enterTimer.current);
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, [hasProAccess, profile, updateProfile]);

  useEffect(() => {
    if (!open || hasProAccess) {
      if (hasProAccess) {
        setOpen(false);
        setDragY(0);
        setDragging(false);
        setDismissing(false);
      }
      return;
    }
    void trackEvent("upgrade_prompt_viewed", {
      source: "first_use_tab_discovery",
    });
  }, [hasProAccess, open, trackEvent]);

  if (!open || !profile || hasProAccess) return null;

  const trial = monthlyProduct?.introductoryOffer;
  const eligibleForTrial =
    monthlyProduct?.isEligibleForIntroOffer === true &&
    trial?.paymentMode === "freeTrial";
  const trialLength = trial
    ? `${trial.period.value} ${trial.period.value === 1 ? trial.period.unit : `${trial.period.unit}s`}`
    : null;
  const price =
    monthlyProduct?.displayPrice ?? STOREKIT_CONFIG.monthlyFallbackPrice;
  const busy = ["loading", "purchasing", "verifying", "restoring"].includes(
    purchaseState,
  );

  const finishDrag = (clientY?: number) => {
    const started = dragStart.current;
    dragStart.current = null;
    setDragging(false);
    const elapsed = started ? Math.max(performance.now() - started.at, 1) : 1;
    const velocity = started && clientY !== undefined
      ? Math.max(0, clientY - started.y) / elapsed
      : 0;
    if (dragY > 92 || velocity > 0.55) close();
    else setDragY(0);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-offer-title"
      className={`fixed inset-0 z-[95] flex items-end justify-center transition-colors duration-300 ${dismissing ? "bg-black/0" : "bg-black/80"}`}
      onClick={close}
    >
      <section
        className={`klimb-pro-sheet relative isolate max-h-[72dvh] w-full max-w-app transform-gpu overflow-y-auto overscroll-contain rounded-t-[2rem] border-x border-t border-white/10 bg-[#101310] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-28px_90px_rgba(0,0,0,0.72)] will-change-transform ${
          !dragging
            ? "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)]"
            : ""
        }`}
        style={{ transform: `translateY(${dragY}px)` }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 opacity-70"
          style={{
            background:
              "radial-gradient(circle at 82% 0%, rgba(57, 255, 136, 0.16), transparent 54%)",
          }}
        />
        <div
          role="button"
          tabIndex={0}
          aria-label="Drag down to close"
          className="mx-auto flex h-6 w-20 touch-none cursor-grab items-start justify-center active:cursor-grabbing"
          onPointerDown={(event) => {
            dragStart.current = { y: event.clientY, at: performance.now() };
            setDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragStart.current === null) return;
            setDragY(Math.max(0, event.clientY - dragStart.current.y));
          }}
          onPointerUp={(event) => finishDrag(event.clientY)}
          onPointerCancel={() => finishDrag()}
          onKeyDown={(event) => {
            if (
              event.key === "Escape" ||
              event.key === "Enter" ||
              event.key === " "
            ) {
              close();
            }
          }}
        >
          <span className="mt-0.5 h-1 w-11 rounded-full bg-white/30" />
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close Pro offer"
          className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/[0.06] bg-[#1b1e1c] text-chalk transition active:scale-95"
        >
          <X size={21} />
        </button>

        <div className="relative z-10 pt-3">
          <div className="flex items-center gap-3 pr-12">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
              <BarChart3 size={20} />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.17em] text-accent">
              {DISCOVERY_COPY.eyebrow}
            </p>
          </div>
          <h2
            id="pro-offer-title"
            className="mt-4 max-w-sm text-[1.75rem] font-black leading-[1.02] tracking-[-0.035em] text-chalk"
          >
            {DISCOVERY_COPY.title}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-5 text-muted">
            {DISCOVERY_COPY.body}
          </p>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-[#181b19] px-4 py-3">
            <span className="text-sm font-extrabold text-chalk">
              {eligibleForTrial && trialLength
                ? `${trialLength} free`
                : "Klimb Pro"}
            </span>
            <span className="text-right text-xs font-semibold text-muted">
              {eligibleForTrial ? `then ${price}/month` : `${price}/month`}
            </span>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => navigate("/upgrade/trial")}
            className="mt-3 w-full rounded-2xl bg-accent px-4 py-4 text-base font-black text-bg shadow-[0_14px_34px_rgba(57,255,136,0.18)] transition active:scale-[0.99] disabled:opacity-50"
          >
            {busy
              ? statusLabel(purchaseState)
              : eligibleForTrial && trialLength
                ? "Start free trial"
                : `Get Pro · ${price}/month`}
          </button>
          <p className="mt-2 text-center text-[11px] leading-4 text-faint">
            {eligibleForTrial && trialLength
              ? `Nothing charged today. Then ${price}/month unless canceled.`
              : `${price}/month, billed by Apple until canceled.`}
          </p>

          {error || purchaseState === "sync_pending" ? (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-wide/20 bg-[#1c1710] px-3 py-2.5 text-center text-xs leading-5 text-wide"
            >
              {error ??
                "Apple confirmed the purchase, but Klimb is still finishing activation."}
              {purchaseState === "sync_pending"
                ? " Tap Restore Purchase to retry now."
                : ""}
            </p>
          ) : null}
          {purchaseState === "pending" ? (
            <p className="mt-3 text-center text-xs text-muted">
              Apple is waiting for approval. Pro will unlock automatically afterward.
            </p>
          ) : null}
          <div className="mt-1 grid grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => navigate("/upgrade")}
              className="min-h-11 text-sm font-extrabold text-accent disabled:opacity-50"
            >
              See all plans
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void restorePurchases()}
              className="min-h-11 text-sm font-bold text-muted disabled:opacity-50"
            >
              Restore Purchase
            </button>
          </div>
          <div className="flex items-center justify-center gap-5 pt-0.5 text-[11px] font-semibold text-faint">
            <a href={STOREKIT_CONFIG.termsUrl} target="_blank" rel="noreferrer">
              Terms
            </a>
            <a href={STOREKIT_CONFIG.privacyUrl} target="_blank" rel="noreferrer">
              Privacy
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
