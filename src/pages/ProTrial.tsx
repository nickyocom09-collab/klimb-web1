import { useEffect } from "react";
import { CalendarDays, Check, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEntitlements } from "../lib/entitlements";
import { STOREKIT_CONFIG } from "../lib/entitlementFeatures";
import type { StoreKitPeriod, StoreKitProduct } from "../lib/storeKit";

function periodLabel(period?: StoreKitPeriod) {
  if (!period) return "7 days";
  const unit = period.value === 1 ? period.unit : `${period.unit}s`;
  return `${period.value} ${unit}`;
}

function renewalLabel(product: StoreKitProduct) {
  const period = product.period;
  if (!period) return "month";
  if (period.value === 1) return period.unit;
  return `${period.value} ${period.unit}s`;
}

function hasFreeTrial(product: StoreKitProduct | null) {
  return product?.isEligibleForIntroOffer === true &&
    product.introductoryOffer?.paymentMode === "freeTrial";
}

function workingLabel(state: string) {
  if (state === "loading") return "Loading Apple pricing…";
  if (state === "purchasing") return "Waiting for Apple…";
  if (state === "verifying") return "Unlocking Pro…";
  if (state === "restoring") return "Restoring…";
  return "Working with Apple…";
}

export function ProTrial() {
  const navigate = useNavigate();
  const {
    hasProAccess,
    monthlyProduct,
    annualProduct,
    purchaseProduct,
    purchaseState,
    error,
    restorePurchases,
    trackEvent,
  } = useEntitlements();

  // Prefer the yearly trial when Apple actually offers one; otherwise the
  // monthly product remains the honest trial entry point. Apple owns final
  // eligibility and localized pricing for each Apple ID and storefront.
  const trialProduct = hasFreeTrial(annualProduct)
    ? annualProduct
    : hasFreeTrial(monthlyProduct)
      ? monthlyProduct
      : annualProduct ?? monthlyProduct;
  const trial = trialProduct?.introductoryOffer;
  const eligibleForTrial = hasFreeTrial(trialProduct);
  const duration = periodLabel(trial?.period);
  const price = trialProduct?.displayPrice ??
    (trialProduct?.id === STOREKIT_CONFIG.annualProductId
      ? STOREKIT_CONFIG.annualFallbackPrice
      : STOREKIT_CONFIG.monthlyFallbackPrice);
  const renewalPeriod = trialProduct ? renewalLabel(trialProduct) : "month";
  const productId = trialProduct?.id ?? STOREKIT_CONFIG.monthlyProductId;
  const busy = ["loading", "purchasing", "verifying", "restoring"].includes(
    purchaseState,
  );

  useEffect(() => {
    if (hasProAccess) navigate("/", { replace: true });
  }, [hasProAccess, navigate]);

  useEffect(() => {
    void trackEvent("pricing_screen_viewed", { source: "trial_timeline" });
  }, [trackEvent]);

  if (hasProAccess) return <div className="min-h-full bg-bg" />;

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#070908] text-chalk">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background:
            "radial-gradient(circle at 50% -15%, rgba(57,255,136,0.19), transparent 66%)",
        }}
      />

      <main className="relative mx-auto w-full max-w-app px-6 pb-80 pt-safe">
        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Close trial details"
            className="grid h-12 w-12 place-items-center rounded-full border border-white/[0.06] bg-[#171a18] text-chalk active:scale-95"
          >
            <X size={24} />
          </button>
        </div>

        <section className="mx-auto mt-8 max-w-sm text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-accent">
            Klimb Pro
          </p>
          <h1 className="mt-4 text-[2.35rem] font-black leading-[1.04] tracking-[-0.045em]">
            {eligibleForTrial
              ? `Try the full Klimb experience. Your first ${duration} are free.`
              : "Unlock the complete picture of your climbing."}
          </h1>
        </section>

        <section className="mx-auto mt-12 max-w-sm" aria-label="Trial timeline">
          <div className="grid grid-cols-[2rem_1fr] gap-x-5">
            <div className="flex flex-col items-center">
              <span className="mt-1 h-3 w-3 rounded-full bg-accent shadow-[0_0_20px_rgba(57,255,136,0.7)]" />
              <span className="my-2 w-1 flex-1 rounded-full bg-accent" />
            </div>
            <div className="pb-8">
              <h2 className="text-xl font-black">Today</h2>
              <p className="mt-2 text-base leading-6 text-muted">
                Unlock every Pro tool: advanced stats, full recap history,
                custom logging, and your climbing video library.
              </p>
            </div>

            <div className="flex flex-col items-center">
              <span className="mt-1 h-3 w-3 rounded-full bg-accent" />
              <span className="my-2 w-1 flex-1 rounded-full bg-accent" />
            </div>
            <div className="pb-8">
              <h2 className="text-xl font-black">2 days before</h2>
              <p className="mt-2 text-base leading-6 text-muted">
                Review the end date or cancel anytime from your Apple
                subscription settings.
              </p>
            </div>

            <div className="flex flex-col items-center">
              <span className="mt-1 h-3 w-3 rounded-full bg-accent" />
              <span className="my-2 w-1 flex-1 rounded-full bg-white/30" />
              <CalendarDays size={26} className="mb-1 text-white/55" />
            </div>
            <div>
              <h2 className="text-xl font-black">
                {eligibleForTrial ? `In ${duration}` : "After confirmation"}
              </h2>
              <p className="mt-2 text-base leading-6 text-muted">
                {eligibleForTrial
                  ? `Apple charges ${price} every ${renewalPeriod} unless you cancel at least 24 hours before the trial ends.`
                  : `Apple charges ${price} every ${renewalPeriod}. The exact price appears before you confirm.`}
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-app border-t border-white/[0.07] bg-[#151816] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-20px_55px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-black text-chalk">
              <Sparkles size={15} className="text-accent" /> Klimb Pro
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {eligibleForTrial
                ? `${price}/${renewalPeriod} after ${duration}`
                : `${price}/${renewalPeriod}`}
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-bold text-accent">
            <Check size={14} strokeWidth={3} /> Cancel anytime
          </span>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => navigate("/upgrade")}
          className="mt-4 w-full rounded-2xl border border-accent/55 py-3 text-sm font-black text-accent disabled:opacity-50"
        >
          See all plans
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void purchaseProduct(productId)}
          className="mt-2.5 w-full rounded-2xl bg-accent py-4 text-base font-black text-bg shadow-[0_12px_34px_rgba(57,255,136,0.2)] active:scale-[0.99] disabled:opacity-50"
        >
          {busy
            ? workingLabel(purchaseState)
            : eligibleForTrial
              ? "Start free trial"
              : "Continue with Pro"}
        </button>

        {error || purchaseState === "sync_pending" ? (
          <p role="alert" className="mt-2.5 rounded-xl bg-wide/10 px-3 py-2 text-center text-xs leading-5 text-wide">
            {error ?? "Apple confirmed the purchase. Klimb is finishing activation."}
          </p>
        ) : null}
        {purchaseState === "pending" ? (
          <p className="mt-2 text-center text-xs text-muted">
            Apple is waiting for approval. Pro unlocks automatically afterward.
          </p>
        ) : null}

        <div className="mt-2 flex items-center justify-center gap-5 text-[11px] font-semibold text-faint">
          <button type="button" disabled={busy} onClick={() => void restorePurchases()}>
            Restore Purchase
          </button>
          <a href={STOREKIT_CONFIG.termsUrl} target="_blank" rel="noreferrer">Terms</a>
          <a href={STOREKIT_CONFIG.privacyUrl} target="_blank" rel="noreferrer">Privacy</a>
        </div>
      </footer>
    </div>
  );
}
