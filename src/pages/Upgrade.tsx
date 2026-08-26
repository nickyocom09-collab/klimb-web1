import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Crown,
  Infinity as InfinityIcon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
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
  if (!Number.isFinite(savings) || savings <= 0) return null;

  const currencyCode =
    annualProduct.currencyCode ?? monthlyProduct.currencyCode;
  if (!currencyCode) return null;

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

const PRO_PERKS = [
  "Everything in Free",
  "Complete weekly recap history",
  "Monthly and yearly recaps",
  "Grade progression and grade pyramids",
  "Progress graphs for 8 weeks, 6 months, 1 year, and all time",
  "Flash rate, send rate, and attempts per send",
  "Insights by gym, climbing style, wall angle, and time of day",
  "Personal records and advanced climbing trends",
  "A logbook customized around the questions you want to answer",
  "Video attachments and your personal video library",
] as const;

const FREE_INCLUDED = [
  "Unlimited Klimb logs, notes, photos, gyms, and routes",
  "Friends, reactions, comments, map, profile, and full logbook",
  "Totals, hardest send, current streak, favorite gym, and grade distribution",
  "This week, this month, and your current weekly recap",
] as const;

const FREE_LOCKED = [
  "Past recap archive, monthly recaps, and yearly recaps",
  "Advanced trends, rates, records, and detailed insights",
  "Customize Logbook controls",
  "Video uploads and personal video library",
] as const;

export function Upgrade() {
  const navigate = useNavigate();
  const {
    entitlement,
    hasProAccess,
    hasLifetimeAccess,
    isTrialActive,
    monthlyProduct,
    annualProduct,
    purchaseState,
    error,
    purchaseProduct,
    restorePurchases,
    manageSubscription,
    trackEvent,
  } = useEntitlements();
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  useEffect(() => {
    void trackEvent("pricing_screen_viewed");
  }, [trackEvent]);

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
  const isBusy = [
    "loading",
    "purchasing",
    "verifying",
    "restoring",
  ].includes(purchaseState);

  return (
    <div className="min-h-full bg-bg px-5 pb-10 pt-safe">
      <header className="flex items-center justify-between py-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-chalk"
        >
          <ArrowLeft size={21} />
        </button>
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-accent">
          Klimb Pro
        </span>
        <div className="h-11 w-11" />
      </header>

      <section className="relative mt-4 overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_88%_8%,rgba(57,255,136,0.16),transparent_46%),linear-gradient(145deg,#07130e,#06100b)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="relative">
          <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl border border-accent/35 bg-accent/10 text-accent">
            {hasLifetimeAccess ? <InfinityIcon size={30} /> : <Crown size={28} />}
          </div>
          <p className="text-sm font-semibold text-accent">
            {hasLifetimeAccess
              ? "Lifetime Pro — Founding Member"
              : isTrialActive
                ? "Your Pro trial is active"
                : hasProAccess
                  ? "Klimb Pro is active"
                  : "More from every session"}
          </p>
          <h1 className="mt-2 max-w-[16rem] text-4xl font-black leading-[0.95] tracking-[-0.05em] text-chalk">
            Your climbing, with the full picture.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            Keep every recap, see the shape of your progress, and turn your
            climbing history into insights that get better every week.
          </p>
        </div>
      </section>

      <div className="mt-5 grid gap-3">
        <section className="rounded-3xl border border-accent/40 bg-gradient-to-b from-accent/10 to-surface p-5 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-accent">
                <Sparkles size={14} /> Klimb Pro
              </p>
              <div className="mt-3 flex rounded-full border border-border bg-bg/70 p-1">
                <button
                  type="button"
                  onClick={() => setBilling("monthly")}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-black transition ${
                    billing === "monthly"
                      ? "bg-surface-2 text-chalk shadow-sm"
                      : "text-muted"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBilling("annual")}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-black transition ${
                    billing === "annual"
                      ? "bg-accent text-bg shadow-sm"
                      : "text-muted"
                  }`}
                >
                  <span>Yearly</span>
                </button>
              </div>
              <h2 className="mt-1 text-2xl font-black text-chalk">
                {displayedPrice}
                <span className="ml-1 text-sm font-semibold text-muted">
                  / {periodLabel(displayedPeriod)}
                </span>
              </h2>
              {billing === "annual" ? (
                <p className="mt-1 text-xs font-bold text-accent">
                  {annualSavings
                    ? `Save ${annualSavings} every year`
                    : "Save with yearly billing"}
                </p>
              ) : null}
            </div>
            <ShieldCheck size={23} className="text-accent" />
          </div>

          {hasEligibleTrial && introLength ? (
            <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3">
              <p className="font-bold text-chalk">
                Try Pro free for {introLength}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Then {displayedPrice} every {periodLabel(displayedPeriod)} unless
                canceled.
              </p>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-chalk">
                Apple&apos;s confirmation sheet activates the trial. Nothing is
                charged today, and the renewal price appears before you confirm.
              </p>
            </div>
          ) : null}

          <ul className="mt-4 grid gap-2.5 text-sm text-chalk">
            {PRO_PERKS.map((label) => (
              <li key={label} className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                  <Check size={13} strokeWidth={3} />
                </span>
                {label}
              </li>
            ))}
          </ul>

          <p className="mt-4 rounded-2xl border border-border/70 bg-bg/45 px-4 py-3 text-xs leading-relaxed text-muted">
            Pro keeps growing. New analytics and recap tools will roll out over
            time and appear here when they are ready—never as half-finished
            features.
          </p>

          {hasLifetimeAccess ? (
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-accent px-4 py-4 text-bg">
              <InfinityIcon size={25} />
              <div>
                <p className="font-black">You have Pro for life.</p>
                <p className="text-xs font-semibold opacity-75">
                  No subscription or renewal needed.
                </p>
              </div>
            </div>
          ) : hasProAccess ? (
            <button
              type="button"
              onClick={() => void manageSubscription()}
              className="mt-5 w-full rounded-2xl border border-border bg-surface-2 py-4 text-sm font-bold text-chalk"
            >
              Manage subscription
            </button>
          ) : (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void purchaseProduct(selectedProductId)}
              className="mt-5 w-full rounded-2xl bg-accent py-4 text-base font-black text-bg shadow-[0_12px_32px_rgba(57,255,136,0.18)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isBusy
                ? appleStatusLabel(purchaseState)
                : hasEligibleTrial && introLength
                  ? `Start ${introLength} free trial`
                  : "Continue with Pro"}
            </button>
          )}

          {!hasLifetimeAccess ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void restorePurchases()}
              className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-sm font-bold text-muted disabled:opacity-45"
            >
              <RefreshCw size={15} /> Restore Purchases
            </button>
          ) : null}

          {error ? (
            <p className="mt-2 rounded-xl bg-wide/10 px-3 py-2 text-center text-xs text-wide">
              {error}
            </p>
          ) : null}
          {purchaseState === "pending" ? (
            <p className="mt-2 text-center text-xs text-muted">
              Apple is waiting for approval. Pro will unlock automatically once
              the purchase completes.
            </p>
          ) : null}
          {purchaseState === "sync_pending" ? (
            <p className="mt-2 text-center text-xs font-semibold text-muted">
              Apple completed the purchase. Klimb will keep retrying the secure
              account sync automatically.
            </p>
          ) : null}
          {purchaseState === "success" ? (
            <p className="mt-2 text-center text-xs font-semibold text-accent">
              Your Apple purchase is verified and synced.
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-border bg-surface p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-faint">
                Free
              </p>
              <h2 className="mt-1 text-xl font-bold text-chalk">A complete logbook</h2>
            </div>
            <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-muted">
              Included
            </span>
          </div>
          <ul className="mt-4 grid gap-2.5 text-sm text-muted">
            {FREE_INCLUDED.map((label) => (
              <li key={label} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                  <Check size={13} strokeWidth={3} />
                </span>
                <span>{label}</span>
              </li>
            ))}
            {FREE_LOCKED.map((label) => (
              <li key={label} className="flex items-start gap-2.5 text-faint">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-wide/10 text-wide">
                  <X size={13} strokeWidth={3} />
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-faint">
        Payment is charged to your Apple ID. The subscription renews
        automatically unless canceled at least 24 hours before the end of the
        current period. You can manage or cancel it in your App Store account.
      </p>
      <div className="mt-4 flex items-center justify-center gap-5 text-xs font-semibold text-muted">
        <a href={STOREKIT_CONFIG.termsUrl} target="_blank" rel="noreferrer">
          Terms of Use
        </a>
        <a href={STOREKIT_CONFIG.privacyUrl} target="_blank" rel="noreferrer">
          Privacy Policy
        </a>
      </div>

      {entitlement?.last_verified_at ? (
        <p className="mt-4 text-center text-[10px] text-faint">
          Access checked{" "}
          {new Date(entitlement.last_verified_at).toLocaleDateString()}.
        </p>
      ) : null}
    </div>
  );
}
