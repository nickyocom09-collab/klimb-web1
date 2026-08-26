import { useEffect } from "react";
import { BarChart3, Check, Crown, Sparkles, Video, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEntitlements } from "../lib/entitlements";
import { STOREKIT_CONFIG } from "../lib/entitlementFeatures";

const COPY = {
  stats: {
    eyebrow: "Climb with the full picture",
    title: "See what your sessions are building.",
    body: "Unlock progress ranges, flash rate, attempts per send, records, and deeper gym insights.",
    Icon: BarChart3,
  },
  video: {
    eyebrow: "Keep the beta that mattered",
    title: "Save every Klimb video in one place.",
    body: "Attach clips while logging, then find each video beside the Klimb it belongs to.",
    Icon: Video,
  },
  customize: {
    eyebrow: "Make logging yours",
    title: "Ask only what you want to remember.",
    body: "Choose your logging questions and presets while Klimb keeps the essentials intact.",
    Icon: Sparkles,
  },
} as const;

function statusLabel(state: string) {
  if (state === "loading") return "Loading Apple pricing…";
  if (state === "purchasing") return "Waiting for Apple…";
  if (state === "verifying") return "Unlocking Pro…";
  if (state === "restoring") return "Restoring…";
  return "Working with Apple…";
}

export function ProOfferSheet() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    hasProAccess,
    monthlyProduct,
    purchaseProduct,
    purchaseState,
    error,
    restorePurchases,
    trackEvent,
  } = useEntitlements();
  const params = new URLSearchParams(location.search);
  const source = params.get("pro");
  const copy = source && source in COPY
    ? COPY[source as keyof typeof COPY]
    : null;

  const close = () => {
    const next = new URLSearchParams(location.search);
    next.delete("pro");
    navigate(
      { pathname: location.pathname, search: next.toString() ? `?${next}` : "" },
      { replace: true },
    );
  };

  useEffect(() => {
    if (!copy || hasProAccess) return;
    void trackEvent("upgrade_prompt_viewed", { source: source ?? "contextual" });
  }, [copy, hasProAccess, source, trackEvent]);

  useEffect(() => {
    if (copy && hasProAccess) close();
    // Close only when verified access changes; location changes are handled by
    // the component naturally unmounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copy, hasProAccess]);

  if (!copy || hasProAccess) return null;

  const trial = monthlyProduct?.introductoryOffer;
  const eligibleForTrial =
    monthlyProduct?.isEligibleForIntroOffer === true &&
    trial?.paymentMode === "freeTrial";
  const trialLength = trial
    ? `${trial.period.value} ${trial.period.value === 1 ? trial.period.unit : `${trial.period.unit}s`}`
    : null;
  const price = monthlyProduct?.displayPrice ?? STOREKIT_CONFIG.monthlyFallbackPrice;
  const busy = ["loading", "purchasing", "verifying", "restoring"].includes(
    purchaseState,
  );
  const Icon = copy.Icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-offer-title"
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/65 backdrop-blur-[2px]"
      onClick={close}
    >
      <section
        className="relative max-h-[82dvh] w-full max-w-app overflow-y-auto rounded-t-[2.25rem] border-x border-t border-white/10 bg-[radial-gradient(circle_at_88%_2%,rgba(57,255,136,0.14),transparent_42%),#111312] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_80px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" />
        <button
          type="button"
          onClick={close}
          aria-label="Close Pro offer"
          className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/[0.06] text-chalk transition active:scale-95"
        >
          <X size={21} />
        </button>

        <div className="pt-7">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-accent">
            <Icon size={23} />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-accent">
            {copy.eyebrow}
          </p>
          <h2 id="pro-offer-title" className="mt-2 max-w-sm text-3xl font-black leading-[1.02] tracking-[-0.04em] text-chalk">
            {copy.title}
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted">{copy.body}</p>

          <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-bold text-chalk">
            <span className="flex items-center gap-2 rounded-2xl bg-white/[0.045] px-3 py-3">
              <Check size={15} className="shrink-0 text-accent" /> All Pro tools
            </span>
            <span className="flex items-center gap-2 rounded-2xl bg-white/[0.045] px-3 py-3">
              <Crown size={15} className="shrink-0 text-accent" /> Cancel anytime
            </span>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void purchaseProduct(STOREKIT_CONFIG.monthlyProductId)}
            className="mt-5 w-full rounded-2xl bg-accent px-4 py-4 text-base font-black text-bg shadow-[0_14px_34px_rgba(57,255,136,0.2)] transition active:scale-[0.99] disabled:opacity-50"
          >
            {busy
              ? statusLabel(purchaseState)
              : eligibleForTrial && trialLength
                ? `Try Pro free for ${trialLength}`
                : `Get Pro · ${price}/month`}
          </button>
          <p className="mt-2 text-center text-[11px] leading-5 text-faint">
            {eligibleForTrial && trialLength
              ? `Nothing charged today. Then ${price}/month unless canceled.`
              : `${price}/month, billed by Apple until canceled.`}
          </p>

          {error ? (
            <p role="alert" className="mt-3 rounded-xl border border-wide/20 bg-wide/[0.07] px-3 py-2 text-center text-xs leading-5 text-wide">
              {error}
            </p>
          ) : null}
          {purchaseState === "pending" ? (
            <p className="mt-3 text-center text-xs text-muted">Apple is waiting for approval. Pro will unlock automatically afterward.</p>
          ) : null}
          {purchaseState === "sync_pending" ? (
            <p className="mt-3 text-center text-xs font-semibold text-muted">Apple completed the purchase. Klimb is retrying the secure activation.</p>
          ) : null}

          <div className="mt-2 grid grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => navigate("/upgrade")}
              className="min-h-11 text-sm font-extrabold text-accent disabled:opacity-50"
            >
              Compare plans
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void restorePurchases()}
              className="min-h-11 text-sm font-bold text-muted disabled:opacity-50"
            >
              Restore purchase
            </button>
          </div>
          <div className="flex items-center justify-center gap-5 text-[11px] font-semibold text-faint">
            <a href={STOREKIT_CONFIG.termsUrl} target="_blank" rel="noreferrer">Terms</a>
            <a href={STOREKIT_CONFIG.privacyUrl} target="_blank" rel="noreferrer">Privacy</a>
          </div>
        </div>
      </section>
    </div>
  );
}
