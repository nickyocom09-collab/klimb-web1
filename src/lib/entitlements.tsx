import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
  type StoreKitTransaction,
} from "./storeKit";

type PurchaseState =
  | "idle"
  | "loading"
  | "purchasing"
  | "verifying"
  | "restoring"
  | "success"
  | "pending"
  | "canceled"
  | "error";

type EntitlementContextValue = {
  entitlement: EntitlementRecord | null;
  hasProAccess: boolean;
  hasLifetimeAccess: boolean;
  isTrialActive: boolean;
  subscriptionStatus: EntitlementStatus;
  product: StoreKitProduct | null;
  purchaseState: PurchaseState;
  error: string | null;
  canUseFeature: (feature: EntitlementFeature) => boolean;
  refreshEntitlements: () => Promise<void>;
  purchaseMonthly: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  manageSubscription: () => Promise<void>;
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

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [entitlement, setEntitlement] = useState<EntitlementRecord | null>(null);
  const [product, setProduct] = useState<StoreKitProduct | null>(null);
  const [purchaseState, setPurchaseState] = useState<PurchaseState>("idle");
  const [error, setError] = useState<string | null>(null);

  const acceptEntitlement = useCallback((incoming: EntitlementRecord) => {
    setEntitlement((current) => {
      if (!shouldReplaceCachedEntitlement({ current, incoming })) return current;
      writeCache(incoming);
      return incoming;
    });
  }, []);

  const refreshEntitlements = useCallback(async () => {
    if (!userId) {
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
      if (cached) setEntitlement(cached);
      return;
    }
    if (data) acceptEntitlement(data as EntitlementRecord);
    else setEntitlement(null);
  }, [acceptEntitlement, userId]);

  const verifyWithBackend = useCallback(
    async (transaction: StoreKitTransaction) => {
      setPurchaseState("verifying");
      const { data, error: verifyError } = await supabase.functions.invoke(
        "verify-app-store-transaction",
        { body: { signedTransaction: transaction.signedTransaction } },
      );
      if (verifyError) throw verifyError;
      const verified = data?.entitlement as EntitlementRecord | undefined;
      if (!verified) throw new Error("The entitlement server returned no result.");
      acceptEntitlement(verified);
      await KlimbStoreKit.finishTransaction({
        transactionId: transaction.transactionId,
      });
      return verified;
    },
    [acceptEntitlement],
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
      setEntitlement(null);
      return;
    }
    const cached = readCache(userId);
    // Never carry one account's cached access across an account switch.
    setEntitlement(cached);
    void refreshEntitlements();
  }, [refreshEntitlements, userId]);

  useEffect(() => {
    if (!canUseStoreKit()) return;
    setPurchaseState("loading");
    KlimbStoreKit.loadProducts({
      productIds: [STOREKIT_CONFIG.monthlyProductId],
    })
      .then(({ products }) => {
        setProduct(
          products.find(
            (candidate) =>
              candidate.id === STOREKIT_CONFIG.monthlyProductId,
          ) ?? null,
        );
        setPurchaseState("idle");
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Apple pricing is temporarily unavailable.",
        );
        setPurchaseState("error");
      });
  }, []);

  useEffect(() => {
    if (!userId || !canUseStoreKit()) return;
    let updateHandle: { remove: () => Promise<void> } | null = null;
    let failureHandle: { remove: () => Promise<void> } | null = null;
    void KlimbStoreKit.addListener("transactionUpdated", (transaction) => {
      void verifyWithBackend(transaction)
        .then(() => {
          setPurchaseState("success");
          void refreshEntitlements();
        })
        .catch((verificationError: unknown) => {
          setError(
            verificationError instanceof Error
              ? verificationError.message
              : "Apple verification failed.",
          );
          setPurchaseState("error");
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
  }, [refreshEntitlements, userId, verifyWithBackend]);

  useEffect(() => {
    if (!userId || !canUseStoreKit()) return;

    // Reconcile verified StoreKit state on every signed-in app launch. This
    // covers renewals and purchases made on another device even when the user
    // never opens the pricing screen. Lifetime access remains authoritative on
    // the backend and cannot be downgraded by subscription reconciliation.
    void KlimbStoreKit.currentEntitlements()
      .then(async ({ transactions }) => {
        for (const transaction of transactions) {
          await verifyWithBackend(transaction);
        }
        if (transactions.length > 0) await refreshEntitlements();
        setPurchaseState("idle");
      })
      .catch((syncError: unknown) => {
        console.warn("StoreKit entitlement sync deferred", syncError);
        // Keep the last server-verified cache during temporary Apple or network
        // failures. A failed refresh must never remove valid access.
      });
  }, [refreshEntitlements, userId, verifyWithBackend]);

  const access = accessFromEntitlement(entitlement);

  const value = useMemo<EntitlementContextValue>(
    () => ({
      entitlement,
      ...access,
      product,
      purchaseState,
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
      async purchaseMonthly() {
        if (!userId || access.hasLifetimeAccess) return;
        if (!canUseStoreKit()) {
          setError("Subscriptions are available in the Klimb iOS app.");
          setPurchaseState("error");
          return;
        }
        setError(null);
        setPurchaseState("purchasing");
        try {
          const result = await KlimbStoreKit.purchase({
            productId: STOREKIT_CONFIG.monthlyProductId,
            appAccountToken: userId,
          });
          if (result.state === "canceled") {
            setPurchaseState("canceled");
            await trackEvent("purchase_canceled");
            return;
          }
          if (result.state === "pending") {
            setPurchaseState("pending");
            await trackEvent("purchase_pending");
            return;
          }
          const verified = await verifyWithBackend(result);
          setPurchaseState("success");
          await trackEvent(
            verified.entitlement_status === "trial"
              ? "trial_started"
              : "subscription_purchased",
          );
          await refreshEntitlements();
        } catch (purchaseError) {
          setError(
            purchaseError instanceof Error
              ? purchaseError.message
              : "The purchase could not be completed.",
          );
          setPurchaseState("error");
          await trackEvent("purchase_failed");
        }
      },
      async restorePurchases() {
        if (!userId || !canUseStoreKit()) return;
        setError(null);
        setPurchaseState("restoring");
        try {
          const { transactions } = await KlimbStoreKit.restorePurchases();
          for (const transaction of transactions) {
            await verifyWithBackend(transaction);
          }
          await refreshEntitlements();
          setPurchaseState("success");
          await trackEvent("purchase_restored", {
            transaction_count: transactions.length,
          });
        } catch (restoreError) {
          setError(
            restoreError instanceof Error
              ? restoreError.message
              : "Purchases could not be restored.",
          );
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
      },
      trackEvent,
    }),
    [
      access,
      entitlement,
      error,
      product,
      purchaseState,
      refreshEntitlements,
      trackEvent,
      userId,
      verifyWithBackend,
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
