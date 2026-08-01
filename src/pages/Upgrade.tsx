import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Crown,
  Infinity as InfinityIcon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEntitlements } from "../lib/entitlements";
import { STOREKIT_CONFIG } from "../lib/entitlementFeatures";
import type { StoreKitPeriod } from "../lib/storeKit";

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

export function Upgrade() {
  const navigate = useNavigate();
  const {
    entitlement,
    hasProAccess,
    hasLifetimeAccess,
    isTrialActive,
    product,
    purchaseState,
    error,
    purchaseMonthly,
    restorePurchases,
    manageSubscription,
    trackEvent,
  } = useEntitlements();

  useEffect(() => {
    void trackEvent("pricing_screen_viewed");
  }, [trackEvent]);

  const intro = product?.introductoryOffer;
  const hasEligibleTrial =
    product?.isEligibleForIntroOffer === true &&
    intro?.paymentMode === "freeTrial";
  const introLength = trialLabel(intro?.period);
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

      <section className="relative mt-4 overflow-hidden rounded-[2rem] border border-accent/25 bg-[#07130e] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-accent/15 blur-3xl" />
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
        <section className="rounded-3xl border border-border bg-surface p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-faint">
                Free
              </p>
              <h2 className="mt-1 text-xl font-bold text-chalk">Keep climbing</h2>
            </div>
            <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-muted">
              Included
            </span>
          </div>
          <ul className="mt-4 grid gap-2 text-sm text-muted">
            {["Log Klimbs", "Your logbook", "Core stats and weekly recap"].map(
              (label) => (
                <li key={label} className="flex items-center gap-2">
                  <Check size={16} className="text-accent" /> {label}
                </li>
              ),
            )}
          </ul>
        </section>

        <section className="rounded-3xl border border-accent/40 bg-gradient-to-b from-accent/10 to-surface p-5 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-accent">
                <Sparkles size={14} /> Pro Monthly
              </p>
              <h2 className="mt-1 text-2xl font-black text-chalk">
                {product?.displayPrice ?? "Price loading…"}
                {product ? (
                  <span className="ml-1 text-sm font-semibold text-muted">
                    / {periodLabel(product.period)}
                  </span>
                ) : null}
              </h2>
            </div>
            <ShieldCheck size={23} className="text-accent" />
          </div>

          {hasEligibleTrial && introLength ? (
            <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3">
              <p className="font-bold text-chalk">
                Try Pro free for {introLength}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Then {product?.displayPrice} every{" "}
                {periodLabel(product?.period)} unless canceled.
              </p>
            </div>
          ) : null}

          <ul className="mt-4 grid gap-2.5 text-sm text-chalk">
            {[
              "Your complete weekly recap archive",
              "Personal bests and grade pyramids",
              "Eight-week climbing volume trends",
            ].map((label) => (
              <li key={label} className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                  <Check size={13} strokeWidth={3} />
                </span>
                {label}
              </li>
            ))}
          </ul>

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
              disabled={!product || isBusy}
              onClick={() => void purchaseMonthly()}
              className="mt-5 w-full rounded-2xl bg-accent py-4 text-base font-black text-bg shadow-[0_12px_32px_rgba(57,255,136,0.18)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isBusy
                ? "Checking with Apple…"
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
          {purchaseState === "success" ? (
            <p className="mt-2 text-center text-xs font-semibold text-accent">
              Your Apple purchase is verified and synced.
            </p>
          ) : null}
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
