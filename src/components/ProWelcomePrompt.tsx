import { useEffect, useState } from "react";
import { BarChart3, Check, Crown, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useEntitlements } from "../lib/entitlements";
import { STOREKIT_CONFIG } from "../lib/entitlementFeatures";

function localSeenKey(profileId: string) {
  return `klimb.pro-intro-seen.${profileId}`;
}

function appleStatusLabel(state: string) {
  if (state === "loading") return "Loading Apple pricing…";
  if (state === "purchasing") return "Waiting for Apple…";
  if (state === "verifying") return "Activating Pro…";
  if (state === "restoring") return "Restoring purchases…";
  return "Working with Apple…";
}

export function ProWelcomePrompt({ blocked = false }: { blocked?: boolean }) {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const {
    entitlement,
    hasProAccess,
    product,
    purchaseProduct,
    purchaseState,
    error,
  } = useEntitlements();
  const [open, setOpen] = useState(false);
  const [dismissedLocally, setDismissedLocally] = useState(false);

  const trial = product?.introductoryOffer;
  const hasEligibleTrial =
    product?.isEligibleForIntroOffer === true &&
    trial?.paymentMode === "freeTrial";
  const trialLabel = trial
    ? `${trial.period.value} ${trial.period.value === 1 ? trial.period.unit : `${trial.period.unit}s`}`
    : null;
  const price = product?.displayPrice ?? STOREKIT_CONFIG.monthlyFallbackPrice;
  const hasNonFreeEntitlement =
    entitlement !== null && entitlement.plan !== "free";
  const purchaseBusy = ["loading", "purchasing", "verifying", "restoring"].includes(
    purchaseState,
  );

  useEffect(() => {
    if (
      blocked ||
      !profile?.onboarded ||
      profile.pro_intro_seen_at ||
      dismissedLocally ||
      hasProAccess ||
      hasNonFreeEntitlement
    ) {
      setOpen(false);
      return;
    }
    try {
      if (localStorage.getItem(localSeenKey(profile.id))) {
        setOpen(false);
        return;
      }
    } catch {
      // The server profile flag remains the source of truth when storage is
      // unavailable (private browsing, full storage, or an OS restriction).
    }
    const timer = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [blocked, dismissedLocally, hasNonFreeEntitlement, hasProAccess, profile]);

  useEffect(() => {
    if (!open || !profile || !hasProAccess || profile.pro_intro_seen_at) return;
    setDismissedLocally(true);
    setOpen(false);
    try {
      localStorage.setItem(localSeenKey(profile.id), "1");
    } catch {
      // The server timestamp below remains authoritative across devices.
    }
    void updateProfile({ pro_intro_seen_at: new Date().toISOString() });
  }, [hasProAccess, open, profile, updateProfile]);

  if (!open || !profile) return null;

  async function markSeen() {
    setDismissedLocally(true);
    setOpen(false);
    try {
      localStorage.setItem(localSeenKey(profile.id), "1");
    } catch {
      // The profile timestamp below still prevents the prompt repeating.
    }
    await updateProfile({ pro_intro_seen_at: new Date().toISOString() });
  }

  async function viewPro() {
    await markSeen();
    navigate("/upgrade");
  }

  async function startPro() {
    // Keep the introduction visible if Apple is canceled so the climber can
    // still compare plans or explicitly choose Free. Successful verification
    // flips hasProAccess and closes this automatically in the effect above.
    await purchaseProduct(STOREKIT_CONFIG.monthlyProductId);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-welcome-title"
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center"
    >
      <section className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[2rem] bg-[radial-gradient(circle_at_88%_8%,rgba(57,255,136,0.16),transparent_46%),linear-gradient(145deg,#07130e,#06100b)] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.65)]">
        <button
          type="button"
          onClick={() => void markSeen()}
          aria-label="Maybe later"
          className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-muted"
        >
          <X size={19} />
        </button>

        <div className="relative">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-accent/35 bg-accent/10 text-accent">
            <Crown size={27} />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.26em] text-accent">
            Meet Klimb Pro
          </p>
          <h2 id="pro-welcome-title" className="mt-2 max-w-xs text-3xl font-black leading-tight tracking-tight text-chalk">
            Go deeper without changing how you Klimb.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Start with a free trial, keep every recap, and see the patterns in
            your climbing. You can keep using Klimb Free whenever you want.
          </p>

          <ul className="mt-5 grid gap-3 text-sm font-semibold text-chalk">
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/10 text-accent"><BarChart3 size={17} /></span>
              Advanced progress and gym insights
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/10 text-accent"><Check size={17} /></span>
              Recap history, custom logging, and video library
            </li>
          </ul>

          <button
            type="button"
            disabled={purchaseBusy}
            onClick={() => void startPro()}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-base font-black text-bg shadow-[0_14px_38px_rgba(57,255,136,0.2)] transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-55"
          >
            <Sparkles size={17} />
            {purchaseBusy
              ? appleStatusLabel(purchaseState)
              : hasEligibleTrial && trialLabel
                ? `Start ${trialLabel} free trial`
                : `Get Pro · ${price}/month`}
          </button>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-faint">
            {hasEligibleTrial && trialLabel
              ? `Then ${price}/month. `
              : `${price}/month. `}
            Auto-renews until canceled in your Apple account.
          </p>
          {hasEligibleTrial ? (
            <p className="mt-1 text-center text-[11px] font-semibold leading-relaxed text-muted">
              Apple&apos;s secure confirmation sheet starts the trial. You pay
              nothing today, and Apple shows the renewal price before you confirm.
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 rounded-xl border border-wide/20 bg-wide/[0.07] px-3 py-2 text-center text-xs leading-relaxed text-wide">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void viewPro()}
            className="mt-2 w-full py-2 text-sm font-bold text-accent"
          >
            Compare monthly and yearly
          </button>
          <button
            type="button"
            onClick={() => void markSeen()}
            className="w-full py-2 text-sm font-bold text-muted"
          >
            Keep using Free
          </button>
          <div className="mt-1 flex items-center justify-center gap-4 text-[11px] font-semibold text-faint">
            <a
              href={STOREKIT_CONFIG.termsUrl}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-white/20 underline-offset-2"
            >
              Terms
            </a>
            <a
              href={STOREKIT_CONFIG.privacyUrl}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-white/20 underline-offset-2"
            >
              Privacy
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
