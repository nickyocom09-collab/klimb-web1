import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useAuth } from "./auth";
import { supabase } from "./supabase";
import {
  accessFromEntitlement,
  shouldReplaceCachedEntitlement,
  type EntitlementRecord,
  type EntitlementStatus,
} from "./entitlementLogic";
import {
  ENTITLEMENT_FEATURES,
  STOREKIT_CONFIG,
  type EntitlementFeature,
} from "./entitlementFeatures";
import {
  canUseStoreKit,
  KlimbStoreKit,
  type StoreKitProduct,
  type StoreKitSubscriptionRenewalStatus,
  type StoreKitTransaction,
} from "./storeKit";
import { OperationTimeoutError, withTimeout } from "./asyncTimeout";

const PRODUCT_LOAD_TIMEOUT_MS = 20_000;
const PURCHASE_TIMEOUT_MS = 120_000;
const VERIFICATION_TIMEOUT_MS = 30_000;
const RESTORE_TIMEOUT_MS = 120_000;
const ENTITLEMENT_SYNC_TIMEOUT_MS = 30_000;
const VERIFICATION_RETRY_DELAYS_MS = [0, 1_200, 3_500] as const;
const ENTITLEMENT_REFRESH_INTERVAL_MS = 5 * 60_000;

type PurchaseState =
  | "idle"
  | "loading"
  | "purchasing"
  | "verifying"
  | "restoring"
  | "success"
  | "pending"
  | "sync_pending"
  | "canceled"
  | "error";

export type ProUnlockCelebration = {
  productId: string;
  isTrial: boolean;
};

type EntitlementContextValue = {
  entitlement: EntitlementRecord | null;
  hasProAccess: boolean;
  hasLifetimeAccess: boolean;
  isTrialActive: boolean;
  subscriptionStatus: EntitlementStatus;
  products: StoreKitProduct[];
  product: StoreKitProduct | null;
  monthlyProduct: StoreKitProduct | null;
  annualProduct: StoreKitProduct | null;
  subscriptionRenewal: StoreKitSubscriptionRenewalStatus | null;
  purchaseState: PurchaseState;
  unlockCelebration: ProUnlockCelebration | null;
  error: string | null;
  canUseFeature: (feature: EntitlementFeature) => boolean;
  refreshEntitlements: () => Promise<void>;
  refreshSubscriptionStatus: () => Promise<void>;
  purchaseProduct: (productId: string) => Promise<void>;
  restorePurchases: () => Promise<void>;
  manageSubscription: () => Promise<void>;
  dismissUnlockCelebration: () => void;
  trackEvent: (
    eventName:
      | "pricing_screen_viewed"
      | "trial_started"
      | "subscription_purchased"
      | "purchase_canceled"
      | "purchase_pending"
      | "purchase_failed"
      | "purchase_restored"
      | "upgrade_prompt_viewed",
    properties?: Record<string, string | number | boolean>,
  ) => Promise<void>;
};

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

function cacheKey(userId: string) {
  return `klimb.entitlement.${userId}`;
}

function unlockSeenKey(userId: string) {
  return `klimb.pro-unlocked-seen.${userId}`;
}

function readCache(userId: string): EntitlementRecord | null {
  try {
    const value = localStorage.getItem(cacheKey(userId));
    return value ? (JSON.parse(value) as EntitlementRecord) : null;
  } catch {
    return null;
  }
}

function writeCache(record: EntitlementRecord) {
  try {
    localStorage.setItem(cacheKey(record.user_id), JSON.stringify(record));
  } catch {
    // Server-verified access remains valid even when device storage is full or
    // unavailable. The next online launch will simply fetch it again.
  }
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

async function verificationErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response | undefined;
    if (response) {
      try {
        const payload = (await response.clone().json()) as { error?: unknown };
        if (typeof payload.error === "string" && payload.error.trim()) {
          return payload.error;
        }
      } catch {
        // Fall through to a stable, user-facing message when the relay does
        // not return JSON (for example during a temporary platform outage).
      }
      if (response.status === 401) {
        return "Your Klimb sign-in expired. Sign in again, then use Restore Purchases.";
      }
    }
    return "Apple confirmed the purchase, but Klimb could not activate Pro yet.";
  }
  return error instanceof Error
    ? error.message
    : "Apple confirmed the purchase, but Klimb could not activate Pro yet.";
}

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [entitlement, setEntitlement] = useState<EntitlementRecord | null>(null);
  const [products, setProducts] = useState<StoreKitProduct[]>([]);
  const [subscriptionRenewal, setSubscriptionRenewal] =
    useState<StoreKitSubscriptionRenewalStatus | null>(null);
  const [purchaseState, setPurchaseState] = useState<PurchaseState>("idle");
  const [unlockCelebration, setUnlockCelebration] =
    useState<ProUnlockCelebration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessClock, setAccessClock] = useState(() => Date.now());
  const entitlementRef = useRef<EntitlementRecord | null>(null);
  const verificationInFlight = useRef(
    new Map<string, Promise<EntitlementRecord>>(),
  );

  const celebrateVerifiedUnlock = useCallback(
    (verified: EntitlementRecord, force = false) => {
      if (!userId || !accessFromEntitlement(verified).hasProAccess) return;
      if (
        verified.entitlement_type !== "subscription" &&
        verified.entitlement_type !== "trial"
      ) {
        return;
      }
      try {
        if (
          !force &&
          localStorage.getItem(unlockSeenKey(userId)) === "true"
        ) {
          return;
        }
        localStorage.setItem(unlockSeenKey(userId), "true");
      } catch {
        // The celebration is cosmetic. Verified Pro access must still activate
        // when WebKit storage is unavailable.
      }
      setUnlockCelebration({
        productId: verified.subscription_product_id ?? "",
        isTrial: verified.entitlement_status === "trial",
      });
    },
    [userId],
  );

  const acceptEntitlement = useCallback((incoming: EntitlementRecord) => {
    const current = entitlementRef.current;
    if (!shouldReplaceCachedEntitlement({ current, incoming })) return;
    entitlementRef.current = incoming;
    writeCache(incoming);
    setEntitlement(incoming);
  }, []);

  const refreshEntitlements = useCallback(async () => {
    if (!userId) {
      entitlementRef.current = null;
      setEntitlement(null);
      return;
    }
    const { data, error: readError } = await supabase
      .from("user_entitlements")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) {
      // A temporary network failure must not remove a previously verified
      // entitlement. Keep the per-account cache until the server is reachable.
      const cached = readCache(userId);
      if (cached) {
        entitlementRef.current = cached;
        setEntitlement(cached);
      }
      return;
    }
    if (data) acceptEntitlement(data as EntitlementRecord);
    else {
      entitlementRef.current = null;
      setEntitlement(null);
    }
  }, [acceptEntitlement, userId]);

  const refreshSubscriptionStatus = useCallback(async () => {
    if (!userId || !canUseStoreKit()) {
      setSubscriptionRenewal(null);
      return;
    }
    try {
      const { statuses } = await withTimeout(
        KlimbStoreKit.subscriptionStatuses({
          productIds: [
            STOREKIT_CONFIG.monthlyProductId,
            STOREKIT_CONFIG.annualProductId,
          ],
        }),
        ENTITLEMENT_SYNC_TIMEOUT_MS,
        "Apple subscription status took too long to load.",
      );
      const currentEntitlement = entitlementRef.current;
      const exactStatus = currentEntitlement?.original_transaction_id
        ? statuses.find(
            (status) =>
              status.originalTransactionId ===
              currentEntitlement.original_transaction_id,
          )
        : null;
      const productStatus = currentEntitlement?.subscription_product_id
        ? statuses.find(
            (status) =>
              status.productId === currentEntitlement.subscription_product_id,
          )
        : null;
      const activeStatus = statuses.find((status) =>
        ["subscribed", "inGracePeriod", "inBillingRetryPeriod"].includes(
          status.state,
        ),
      );
      setSubscriptionRenewal(exactStatus ?? productStatus ?? activeStatus ?? null);
    } catch (statusError) {
      // Renewal state is supporting account-management information. Keep Pro
      // access driven by the server-verified entitlement if Apple is briefly
      // unavailable, and retry the status on the next foreground event.
      console.warn("StoreKit subscription status refresh deferred", statusError);
    }
  }, [userId]);

  const verifyWithBackend = useCallback(
    async (
      transaction: StoreKitTransaction,
      showProgress = true,
    ) => {
      const existing = verificationInFlight.current.get(
        transaction.transactionId,
      );
      if (existing) return existing;
      if (showProgress) setPurchaseState("verifying");
      const verification = (async () => {
        if (!session?.access_token) {
          throw new Error(
            "Your Klimb sign-in expired. Sign in again, then use Restore Purchases.",
          );
        }
        const { data, error: verifyError } = await withTimeout(
          supabase.functions.invoke("verify-app-store-transaction", {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            body: { signedTransaction: transaction.signedTransaction },
          }),
          VERIFICATION_TIMEOUT_MS,
          "Apple completed the purchase, but account activation took too long.",
        );
        if (verifyError) throw verifyError;
        const verified = data?.entitlement as EntitlementRecord | undefined;
        if (!verified) {
          throw new Error("The entitlement server returned no result.");
        }
        acceptEntitlement(verified);
        try {
          await withTimeout(
            KlimbStoreKit.finishTransaction({
              transactionId: transaction.transactionId,
            }),
            VERIFICATION_TIMEOUT_MS,
            "Apple transaction finalization took too long.",
          );
        } catch (finishError) {
          // Server verification has already granted access. StoreKit will
          // safely replay an unfinished transaction on the next launch.
          console.warn("StoreKit transaction finalization deferred", finishError);
        }
        return verified;
      })();
      verificationInFlight.current.set(transaction.transactionId, verification);
      try {
        return await verification;
      } finally {
        verificationInFlight.current.delete(transaction.transactionId);
      }
    },
    [acceptEntitlement, session?.access_token],
  );

  const verifyWithRetries = useCallback(
    async (transaction: StoreKitTransaction, showProgress = true) => {
      let lastError: unknown;
      for (const [attempt, delay] of VERIFICATION_RETRY_DELAYS_MS.entries()) {
        if (delay > 0) await wait(delay);
        try {
          return await verifyWithBackend(
            transaction,
            showProgress && attempt === 0,
          );
        } catch (verificationError) {
          lastError = verificationError;
        }
      }
      throw lastError;
    },
    [verifyWithBackend],
  );

  const trackEvent = useCallback<
    EntitlementContextValue["trackEvent"]
  >(async (eventName, properties = {}) => {
    if (!userId) return;
    await supabase.rpc("record_entitlement_event", {
      p_event_name: eventName,
      p_properties: properties,
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      entitlementRef.current = null;
      setEntitlement(null);
      setSubscriptionRenewal(null);
      setUnlockCelebration(null);
      return;
    }
    const cached = readCache(userId);
    // Never carry one account's cached access across an account switch.
    entitlementRef.current = cached;
    setEntitlement(cached);
    setUnlockCelebration(null);
    void refreshEntitlements().then(() => {
      const verified = entitlementRef.current;
      if (verified) celebrateVerifiedUnlock(verified);
    });
    void refreshSubscriptionStatus();
  }, [
    celebrateVerifiedUnlock,
    refreshEntitlements,
    refreshSubscriptionStatus,
    userId,
  ]);

  useEffect(() => {
    if (!canUseStoreKit()) return;
    let canceled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    setPurchaseState("loading");
    const loadProducts = async () => {
      try {
        const { products: loadedProducts } = await withTimeout(
          KlimbStoreKit.loadProducts({
            productIds: [
              STOREKIT_CONFIG.monthlyProductId,
              STOREKIT_CONFIG.annualProductId,
            ],
          }),
          PRODUCT_LOAD_TIMEOUT_MS,
          "Apple pricing took too long to load. You can retry by reopening this screen.",
        );
        if (canceled) return;
        setProducts(loadedProducts);
        setPurchaseState("idle");
        setError(null);

        const hasEveryProduct = [
          STOREKIT_CONFIG.monthlyProductId,
          STOREKIT_CONFIG.annualProductId,
        ].every((productId) =>
          loadedProducts.some((product) => product.id === productId),
        );
        if (!hasEveryProduct && retryCount < 2) {
          retryCount += 1;
          retryTimer = setTimeout(() => void loadProducts(), retryCount * 2500);
        }
      } catch (loadError: unknown) {
        if (canceled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Apple pricing is temporarily unavailable.",
        );
        setPurchaseState("error");
      }
    };
    void loadProducts();
    return () => {
      canceled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    if (!userId || !canUseStoreKit()) return;
    let updateHandle: { remove: () => Promise<void> } | null = null;
    let failureHandle: { remove: () => Promise<void> } | null = null;
    void KlimbStoreKit.addListener("transactionUpdated", (transaction) => {
      void verifyWithRetries(transaction)
        .then((verified) => {
          setPurchaseState("success");
          celebrateVerifiedUnlock(verified);
          void refreshEntitlements();
          void refreshSubscriptionStatus();
        })
        .catch(async (verificationError: unknown) => {
          setError(await verificationErrorMessage(verificationError));
          setPurchaseState("sync_pending");
        });
    }).then((handle) => {
      updateHandle = handle;
    });
    void KlimbStoreKit.addListener(
      "transactionVerificationFailed",
      (event) => {
        setError(event.message);
        setPurchaseState("error");
      },
    ).then((handle) => {
      failureHandle = handle;
    });
    return () => {
      void updateHandle?.remove();
      void failureHandle?.remove();
    };
  }, [
    celebrateVerifiedUnlock,
    refreshEntitlements,
    refreshSubscriptionStatus,
    userId,
    verifyWithRetries,
  ]);

  useEffect(() => {
    if (!userId || !canUseStoreKit()) return;

    // Reconcile verified StoreKit state on every signed-in app launch. This
    // covers renewals and purchases made on another device even when the user
    // never opens the pricing screen. Lifetime access remains authoritative on
    // the backend and cannot be downgraded by subscription reconciliation.
    void withTimeout(
      KlimbStoreKit.currentEntitlements(),
      ENTITLEMENT_SYNC_TIMEOUT_MS,
      "Apple entitlement sync took too long.",
    )
      .then(async ({ transactions }) => {
        let latestVerified: EntitlementRecord | null = null;
        for (const transaction of transactions) {
          latestVerified = await verifyWithBackend(transaction, false);
        }
        if (latestVerified) celebrateVerifiedUnlock(latestVerified);
        if (transactions.length > 0) await refreshEntitlements();
        await refreshSubscriptionStatus();
        setPurchaseState("idle");
      })
      .catch((syncError: unknown) => {
        console.warn("StoreKit entitlement sync deferred", syncError);
        // Keep the last server-verified cache during temporary Apple or network
        // failures. A failed refresh must never remove valid access.
      });
  }, [
    celebrateVerifiedUnlock,
    refreshEntitlements,
    refreshSubscriptionStatus,
    userId,
    verifyWithBackend,
  ]);

  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      setAccessClock(Date.now());
      void refreshEntitlements();
      void refreshSubscriptionStatus();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const interval = window.setInterval(
      refresh,
      ENTITLEMENT_REFRESH_INTERVAL_MS,
    );
    let appStateHandle: { remove: () => Promise<void> } | null = null;
    if (Capacitor.isNativePlatform()) {
      void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) refresh();
      }).then((handle) => {
        appStateHandle = handle;
      });
    }
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(interval);
      void appStateHandle?.remove();
    };
  }, [refreshEntitlements, refreshSubscriptionStatus, userId]);

  useEffect(() => {
    const expiresAt = entitlement?.expiration_date
      ? new Date(entitlement.expiration_date).getTime()
      : null;
    if (expiresAt === null) return;
    const delay = Math.max(0, expiresAt - Date.now() + 250);
    // Browsers clamp longer timeouts. The foreground/5-minute refresh above
    // handles long subscriptions; this timer gives trials and near-term
    // expirations an exact transition back to Free.
    if (delay > 2_147_000_000) return;
    const timer = window.setTimeout(() => setAccessClock(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [entitlement?.expiration_date]);

  const access = useMemo(
    () => accessFromEntitlement(entitlement, accessClock),
    [accessClock, entitlement],
  );
  const monthlyProduct =
    products.find(
      (candidate) => candidate.id === STOREKIT_CONFIG.monthlyProductId,
    ) ?? null;
  const annualProduct =
    products.find(
      (candidate) => candidate.id === STOREKIT_CONFIG.annualProductId,
    ) ?? null;

  const value = useMemo<EntitlementContextValue>(
    () => ({
      entitlement,
      ...access,
      products,
      product: monthlyProduct,
      monthlyProduct,
      annualProduct,
      subscriptionRenewal,
      purchaseState,
      unlockCelebration,
      error,
      canUseFeature(feature) {
        if (
          ENTITLEMENT_FEATURES.freeFeatures.includes(
            feature as (typeof ENTITLEMENT_FEATURES.freeFeatures)[number],
          )
        ) {
          return true;
        }
        return access.hasProAccess;
      },
      refreshEntitlements,
      refreshSubscriptionStatus,
      async purchaseProduct(productId) {
        if (!userId || access.hasLifetimeAccess) return;
        const allowedProductIds = new Set([
          STOREKIT_CONFIG.monthlyProductId,
          STOREKIT_CONFIG.annualProductId,
        ]);
        if (!allowedProductIds.has(productId)) {
          setError("That Klimb Pro plan is unavailable.");
          setPurchaseState("error");
          return;
        }
        if (!canUseStoreKit()) {
          setError("Subscriptions are available in the Klimb iOS app.");
          setPurchaseState("error");
          return;
        }
        if (access.hasProAccess) {
          // A canceled subscription remains active through the purchased end
          // date. Apple does not sell an overlapping period; resuming happens
          // in Apple's subscription-management sheet instead.
          setPurchaseState("idle");
          setError(null);
          await KlimbStoreKit.manageSubscriptions();
          await refreshSubscriptionStatus();
          return;
        }
        setError(null);
        setPurchaseState("purchasing");
        let applePurchaseCompleted = false;
        try {
          // If Apple already has an active subscription (including one whose
          // renewal was canceled), restore that paid-through entitlement
          // before asking StoreKit to sell anything. Apple will not create an
          // overlapping subscription period.
          const { transactions: currentTransactions } = await withTimeout(
            KlimbStoreKit.currentEntitlements(),
            ENTITLEMENT_SYNC_TIMEOUT_MS,
            "Apple subscription status took too long to load.",
          );
          let restoredEntitlement: EntitlementRecord | null = null;
          for (const transaction of currentTransactions) {
            restoredEntitlement = await verifyWithRetries(transaction);
          }
          if (
            restoredEntitlement &&
            accessFromEntitlement(restoredEntitlement).hasProAccess
          ) {
            setPurchaseState("success");
            // A user-initiated purchase action always deserves an explicit
            // success confirmation, even if this account saw the celebration
            // for an earlier subscription period.
            celebrateVerifiedUnlock(restoredEntitlement, true);
            await refreshEntitlements();
            await refreshSubscriptionStatus();
            return;
          }

          const result = await withTimeout(
            KlimbStoreKit.purchase({
              productId,
              appAccountToken: userId,
            }),
            PURCHASE_TIMEOUT_MS,
            "Apple did not respond in time. No Pro access was activated. Try again or use Restore Purchases if Apple later confirms it.",
          );
          if (result.state === "canceled") {
            setPurchaseState("canceled");
            await trackEvent("purchase_canceled", { product_id: productId });
            return;
          }
          if (result.state === "pending") {
            setPurchaseState("pending");
            await trackEvent("purchase_pending", { product_id: productId });
            return;
          }
          applePurchaseCompleted = true;
          const verified = await verifyWithRetries(result);
          setPurchaseState("success");
          celebrateVerifiedUnlock(verified, true);
          void trackEvent(
            verified.entitlement_status === "trial"
              ? "trial_started"
              : "subscription_purchased",
            { product_id: productId },
          );
          void refreshEntitlements();
          void refreshSubscriptionStatus();
        } catch (purchaseError) {
          if (
            applePurchaseCompleted ||
            (purchaseError instanceof Error &&
              /edge function|failed to send|verification|network|fetch/i.test(
                purchaseError.message,
              ))
          ) {
            setError(await verificationErrorMessage(purchaseError));
            setPurchaseState("sync_pending");
            return;
          }
          setError(
            purchaseError instanceof OperationTimeoutError
              ? purchaseError.message
              : purchaseError instanceof Error
              ? purchaseError.message
              : "The purchase could not be completed.",
          );
          setPurchaseState("error");
          await trackEvent("purchase_failed", {
            product_id: productId,
            reason:
              purchaseError instanceof Error
                ? purchaseError.message.slice(0, 240)
                : "unknown",
          });
        }
      },
      async restorePurchases() {
        if (!userId || !canUseStoreKit()) return;
        setError(null);
        setPurchaseState("restoring");
        try {
          const { transactions } = await withTimeout(
            KlimbStoreKit.restorePurchases(),
            RESTORE_TIMEOUT_MS,
            "Apple did not finish restoring in time. Please try Restore Purchases again.",
          );
          let latestRestored: EntitlementRecord | null = null;
          for (const transaction of transactions) {
            latestRestored = await verifyWithRetries(transaction);
          }
          if (latestRestored) {
            celebrateVerifiedUnlock(latestRestored, true);
          }
          await refreshEntitlements();
          await refreshSubscriptionStatus();
          setPurchaseState("success");
          await trackEvent("purchase_restored", {
            transaction_count: transactions.length,
          });
        } catch (restoreError) {
          setError(await verificationErrorMessage(restoreError));
          setPurchaseState("error");
        }
      },
      async manageSubscription() {
        if (!canUseStoreKit()) {
          window.open(
            "https://apps.apple.com/account/subscriptions",
            "_blank",
            "noopener,noreferrer",
          );
          return;
        }
        await KlimbStoreKit.manageSubscriptions();
        await refreshSubscriptionStatus();
      },
      dismissUnlockCelebration() {
        setUnlockCelebration(null);
        setPurchaseState("idle");
        setError(null);
      },
      trackEvent,
    }),
    [
      access,
      celebrateVerifiedUnlock,
      entitlement,
      error,
      annualProduct,
      monthlyProduct,
      products,
      purchaseState,
      refreshEntitlements,
      refreshSubscriptionStatus,
      subscriptionRenewal,
      trackEvent,
      unlockCelebration,
      userId,
      verifyWithRetries,
    ],
  );

  return (
    <EntitlementContext.Provider value={value}>
      {children}
    </EntitlementContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEntitlements() {
  const value = useContext(EntitlementContext);
  if (!value) {
    throw new Error("useEntitlements must be used inside EntitlementProvider");
  }
  return value;
}
