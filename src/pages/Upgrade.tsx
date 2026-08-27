import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, RefreshCw, ShieldCheck } from "lucide-react";
import { useEntitlements } from "../lib/entitlements";
import { STOREKIT_CONFIG } from "../lib/entitlementFeatures";
import type { StoreKitPeriod, StoreKitProduct } from "../lib/storeKit";

function periodLabel(period?: StoreKitPeriod) {
  if (!period) return "month";
  const plural = period.value === 1 ? period.unit : `${period.unit}s`;
  return period.value === 1 ? plural : `${period.value} ${plural}`;
}

function trialLabel(period?: StoreKitPeriod) {
  if (!period) return null;
  const unit = period.value === 1 ? period.unit : `${period.unit}s`;
  return `${period.value} ${unit}`;
}

function annualSavingsLabel(
  monthlyProduct: StoreKitProduct | null,
  annualProduct: StoreKitProduct | null,
) {
  if (
    monthlyProduct?.price === undefined ||
    annualProduct?.price === undefined
  ) {
    return null;
  }
  const savings = monthlyProduct.price * 12 - annualProduct.price;
  const currencyCode = annualProduct.currencyCode ?? monthlyProduct.currencyCode;
  if (!Number.isFinite(savings) || savings <= 0 || !currencyCode) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(savings);
  } catch {
    return null;
  }
}

function appleStatusLabel(state: string) {
  if (state === "loading") return "Loading Apple pricing…";
  if (state === "purchasing") return "Waiting for Apple…";
  if (state === "verifying") return "Activating Pro…";
  if (state === "restoring") return "Restoring purchases…";
  return "Working with Apple…";
}

const FREE_INCLUDED = [
  "Unlimited Klimb logs, notes, photos, gyms, and routes",
  "Friends, map, profile, and your complete logbook",
  "Core totals, hardest send, streak, and grade distribution",
  "Your current weekly recap",
] as const;

const PRO_ADDS = [
  "Complete weekly, monthly, and yearly recap history",
  "Progress ranges, flash rate, and attempts per send",
  "Personal records and deeper gym insights",
  "A logbook customized around your questions",
  "Video attachments and your personal video library",
  "Every new Pro insight as it is released",
] as const;

export function Upgrade() {
  const navigate = useNavigate();
  const {
    hasProAccess,
    monthlyProduct,
    annualProduct,
    purchaseState,
    error,
    purchaseProduct,
    restorePurchases,
    trackEvent,
  } = useEntitlements();
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");

  useEffect(() => {
    if (hasProAccess) {
      navigate("/", { replace: true });
      return;
    }
    void trackEvent("pricing_screen_viewed", { source: "main_pro_page" });
  }, [hasProAccess, navigate, trackEvent]);

  if (hasProAccess) return <div className="min-h-full bg-bg" />;

  const selectedProduct =
    billing === "annual" ? annualProduct : monthlyProduct;
  const selectedProductId =
    billing === "annual"
      ? STOREKIT_CONFIG.annualProductId
      : STOREKIT_CONFIG.monthlyProductId;
  const displayedPrice =
    selectedProduct?.displayPrice ??
    (billing === "annual"
      ? STOREKIT_CONFIG.annualFallbackPrice
      : STOREKIT_CONFIG.monthlyFallbackPrice);
  const displayedPeriod = selectedProduct?.period ?? {
    value: 1,
    unit: billing === "annual" ? ("year" as const) : ("month" as const),
  };
  const intro = selectedProduct?.introductoryOffer;
  const hasEligibleTrial =
    selectedProduct?.isEligibleForIntroOffer === true &&
    intro?.paymentMode === "freeTrial";
  const introLength = trialLabel(intro?.period);
  const annualSavings = annualSavingsLabel(monthlyProduct, annualProduct);
  const isBusy = ["loading", "purchasing", "verifying", "restoring"].includes(
    purchaseState,
  );

  return (
    <div className="min-h-full bg-bg px-5 pb-10 pt-safe">
      <header className="flex items-center justify-between py-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-chalk active:scale-95"
        >
          <ArrowLeft size={21} />
        </button>
        <span className="text-xs font-black uppercase tracking-[0.28em] text-accent">
          Klimb Pro
        </span>
        <div className="h-11 w-11" />
      </header>

      <main className="relative mt-3 overflow-hidden rounded-[2rem] border border-accent/30 bg-[radial-gradient(circle_at_85%_0%,rgba(57,255,136,0.16),transparent_40%),linear-gradient(155deg,#07130e,#0b0e0c_62%)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.4)]">
        <div className="relative">
          <h1 className="max-w-[18rem] text-[2.15rem] font-black leading-[0.98] tracking-[-0.045em] text-chalk">
            Keep the full picture of every Klimb.
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
            Free is a complete climbing logbook. Pro adds the history, insights,
            customization, and videos that make it grow with you.
          </p>

          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/25 p-1">
            <div className="grid grid-cols-2">
              <button
                type="button"
                onClick={() => setBilling("monthly")}
                className={`rounded-xl px-3 py-3 text-sm font-black transition-colors ${
                  billing === "monthly"
                    ? "bg-surface-2 text-chalk"
                    : "text-muted"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBilling("annual")}
                className={`rounded-xl px-3 py-3 text-sm font-black transition-colors ${
                  billing === "annual"
                    ? "bg-accent text-bg"
                    : "text-muted"
                }`}
              >
                Yearly
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-black tracking-[-0.035em] text-chalk">
                {displayedPrice}
                <span className="ml-1 text-sm font-semibold text-muted">
                  / {periodLabel(displayedPeriod)}
                </span>
              </p>
              {billing === "annual" ? (
                <p className="mt-1 text-xs font-bold text-accent">
                  {annualSavings
                    ? `Save ${annualSavings} each year`
                    : "Lower yearly price"}
                </p>
              ) : null}
            </div>
            <ShieldCheck size={24} className="mb-1 shrink-0 text-accent" />
          </div>

          {hasEligibleTrial && introLength ? (
            <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3">
              <p className="font-extrabold text-chalk">
                {introLength} free, then {displayedPrice}/{periodLabel(displayedPeriod)}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Apple shows the renewal date and price before you confirm.
                Cancel anytime in your Apple subscription settings.
              </p>
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111512]">
            <section className="border-b border-white/[0.07] p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-black text-chalk">Free includes</h2>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-muted">
                  Always free
                </span>
              </div>
              <ul className="mt-3 grid gap-2 text-xs leading-5 text-muted">
                {FREE_INCLUDED.map((label) => (
                  <li key={label} className="flex items-start gap-2.5">
                    <Check size={15} strokeWidth={3} className="mt-0.5 shrink-0 text-accent" />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="p-4">
              <h2 className="font-black text-accent">Pro adds</h2>
              <ul className="mt-3 grid gap-2 text-xs leading-5 text-chalk">
                {PRO_ADDS.map((label) => (
                  <li key={label} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent text-bg">
                      <Check size={11} strokeWidth={3.5} />
                    </span>
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => void purchaseProduct(selectedProductId)}
            className="mt-5 w-full rounded-2xl bg-accent py-4 text-base font-black text-bg shadow-[0_12px_32px_rgba(57,255,136,0.18)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isBusy
              ? appleStatusLabel(purchaseState)
              : hasEligibleTrial && introLength
                ? "Start free trial"
                : "Continue with Pro"}
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => void restorePurchases()}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 text-sm font-bold text-muted disabled:opacity-45"
          >
            <RefreshCw size={15} /> Restore Purchase
          </button>

          {error ? (
            <p role="alert" className="mt-2 rounded-xl bg-wide/10 px-3 py-2 text-center text-xs leading-5 text-wide">
              {error}
            </p>
          ) : null}
          {purchaseState === "pending" ? (
            <p className="mt-2 text-center text-xs text-muted">
              Apple is waiting for approval. Pro unlocks automatically afterward.
            </p>
          ) : null}
          {purchaseState === "sync_pending" ? (
            <p className="mt-2 text-center text-xs font-semibold text-muted">
              Apple completed the purchase. Klimb is securely finishing activation.
            </p>
          ) : null}
        </div>
      </main>

      <p className="mt-5 text-center text-[11px] leading-5 text-faint">
        Payment is charged to your Apple ID and renews automatically unless
        canceled at least 24 hours before the end of the current period.
      </p>
      <div className="mt-3 flex items-center justify-center gap-5 text-xs font-semibold text-muted">
        <a href={STOREKIT_CONFIG.termsUrl} target="_blank" rel="noreferrer">
          Terms of Use
        </a>
        <a href={STOREKIT_CONFIG.privacyUrl} target="_blank" rel="noreferrer">
          Privacy Policy
        </a>
      </div>
    </div>
  );
}
