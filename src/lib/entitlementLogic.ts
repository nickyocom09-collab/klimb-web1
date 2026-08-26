export type EntitlementStatus =
  | "inactive"
  | "active"
  | "trial"
  | "grace_period"
  | "billing_retry"
  | "expired"
  | "revoked";

export type EntitlementRecord = {
  user_id: string;
  plan: "free" | "pro_monthly" | "pro_annual" | "lifetime_pro";
  entitlement_type:
    | "free"
    | "founder"
    | "manual_lifetime"
    | "subscription"
    | "trial";
  entitlement_status: EntitlementStatus;
  is_lifetime_pro: boolean;
  founder_granted_at: string | null;
  manual_granted_at: string | null;
  subscription_product_id: string | null;
  original_transaction_id: string | null;
  subscription_started_at: string | null;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  expiration_date: string | null;
  last_verified_at: string | null;
  environment: "Sandbox" | "Production" | "Xcode" | null;
  created_at: string;
  updated_at: string;
};

export type AccessSnapshot = {
  hasProAccess: boolean;
  hasLifetimeAccess: boolean;
  isTrialActive: boolean;
  subscriptionStatus: EntitlementStatus;
};

const SUBSCRIPTION_ACCESS = new Set<EntitlementStatus>([
  "active",
  "trial",
  "grace_period",
]);

export function accessFromEntitlement(
  record: EntitlementRecord | null,
  now = Date.now(),
): AccessSnapshot {
  if (!record) {
    return {
      hasProAccess: false,
      hasLifetimeAccess: false,
      isTrialActive: false,
      subscriptionStatus: "inactive",
    };
  }

  if (record.is_lifetime_pro) {
    return {
      hasProAccess: true,
      hasLifetimeAccess: true,
      isTrialActive: false,
      subscriptionStatus: "active",
    };
  }

  const expiration = record.expiration_date
    ? new Date(record.expiration_date).getTime()
    : null;
  const trialEnd = record.trial_ends_at
    ? new Date(record.trial_ends_at).getTime()
    : null;
  const isNotPastExpiration = expiration === null || expiration > now;
  const isTrialActive =
    record.entitlement_status === "trial" &&
    trialEnd !== null &&
    trialEnd > now;
  const hasSubscriptionAccess =
    SUBSCRIPTION_ACCESS.has(record.entitlement_status) &&
    isNotPastExpiration;

  return {
    hasProAccess: hasSubscriptionAccess,
    hasLifetimeAccess: false,
    isTrialActive,
    subscriptionStatus:
      hasSubscriptionAccess || record.entitlement_status !== "active"
        ? record.entitlement_status
        : "expired",
  };
}

export function shouldReplaceCachedEntitlement({
  current,
  incoming,
}: {
  current: EntitlementRecord | null;
  incoming: EntitlementRecord;
}) {
  if (!current) return true;
  if (current.is_lifetime_pro && !incoming.is_lifetime_pro) return false;
  return (
    new Date(incoming.updated_at).getTime() >=
    new Date(current.updated_at).getTime()
  );
}

export function isFounderEligible({
  enabled,
  cutoffAt,
  accountCreatedAt,
}: {
  enabled: boolean;
  cutoffAt: string;
  accountCreatedAt: string;
}) {
  return (
    enabled &&
    new Date(accountCreatedAt).getTime() <= new Date(cutoffAt).getTime()
  );
}

export function entitlementAfterRefresh({
  cached,
  server,
  networkFailed,
}: {
  cached: EntitlementRecord | null;
  server: EntitlementRecord | null;
  networkFailed: boolean;
}) {
  if (networkFailed) return cached;
  if (!server) return null;
  return shouldReplaceCachedEntitlement({ current: cached, incoming: server })
    ? server
    : cached;
}

export function canAccessEntitlementAdmin(adminUserIds: string[], userId: string) {
  return adminUserIds.includes(userId);
}

export function isNewTransaction(
  processedTransactionIds: ReadonlySet<string>,
  transactionId: string,
) {
  return !processedTransactionIds.has(transactionId);
}
