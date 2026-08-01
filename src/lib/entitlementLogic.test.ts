import { describe, expect, it } from "vitest";
import {
  accessFromEntitlement,
  canAccessEntitlementAdmin,
  entitlementAfterRefresh,
  isFounderEligible,
  isNewTransaction,
  shouldReplaceCachedEntitlement,
  type EntitlementRecord,
} from "./entitlementLogic";

const NOW = Date.parse("2026-07-29T12:00:00Z");

function record(
  patch: Partial<EntitlementRecord> = {},
): EntitlementRecord {
  return {
    user_id: "11111111-1111-4111-8111-111111111111",
    plan: "free",
    entitlement_type: "free",
    entitlement_status: "inactive",
    is_lifetime_pro: false,
    founder_granted_at: null,
    manual_granted_at: null,
    subscription_product_id: null,
    original_transaction_id: null,
    subscription_started_at: null,
    trial_ends_at: null,
    current_period_ends_at: null,
    expiration_date: null,
    last_verified_at: "2026-07-29T11:00:00Z",
    environment: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-29T11:00:00Z",
    ...patch,
  };
}

describe("Klimb entitlement policy", () => {
  it("1. grants founders who join while access is active", () => {
    expect(
      isFounderEligible({
        enabled: true,
        cutoffAt: "2026-08-31T23:59:59Z",
        accountCreatedAt: "2026-07-29T12:00:00Z",
      }),
    ).toBe(true);
  });

  it("2. keeps a stored founder entitlement when founder mode is disabled", () => {
    const founder = record({
      plan: "lifetime_pro",
      entitlement_type: "founder",
      entitlement_status: "active",
      is_lifetime_pro: true,
    });
    expect(accessFromEntitlement(founder, NOW).hasLifetimeAccess).toBe(true);
    expect(
      isFounderEligible({
        enabled: false,
        cutoffAt: "2026-08-31T23:59:59Z",
        accountCreatedAt: "2026-07-29T12:00:00Z",
      }),
    ).toBe(false);
  });

  it("3. leaves accounts created after the cutoff on Free", () => {
    expect(
      isFounderEligible({
        enabled: true,
        cutoffAt: "2026-07-01T00:00:00Z",
        accountCreatedAt: "2026-07-02T00:00:00Z",
      }),
    ).toBe(false);
    expect(accessFromEntitlement(record(), NOW).hasProAccess).toBe(false);
  });

  it("4. represents an eligible started trial", () => {
    const trial = record({
      plan: "pro_monthly",
      entitlement_type: "trial",
      entitlement_status: "trial",
      trial_ends_at: "2026-08-05T12:00:00Z",
      expiration_date: "2026-08-05T12:00:00Z",
    });
    expect(accessFromEntitlement(trial, NOW).isTrialActive).toBe(true);
  });

  it("5. gives an active trial Pro access", () => {
    const trial = record({
      plan: "pro_monthly",
      entitlement_type: "trial",
      entitlement_status: "trial",
      trial_ends_at: "2026-08-05T12:00:00Z",
      expiration_date: "2026-08-05T12:00:00Z",
    });
    expect(accessFromEntitlement(trial, NOW).hasProAccess).toBe(true);
  });

  it("6. returns an expired trial to Free", () => {
    const trial = record({
      plan: "pro_monthly",
      entitlement_type: "trial",
      entitlement_status: "trial",
      trial_ends_at: "2026-07-20T12:00:00Z",
      expiration_date: "2026-07-20T12:00:00Z",
    });
    expect(accessFromEntitlement(trial, NOW).hasProAccess).toBe(false);
  });

  it("7. gives an active monthly subscriber Pro access", () => {
    const subscriber = record({
      plan: "pro_monthly",
      entitlement_type: "subscription",
      entitlement_status: "active",
      expiration_date: "2026-08-29T12:00:00Z",
    });
    expect(accessFromEntitlement(subscriber, NOW).hasProAccess).toBe(true);
  });

  it("8. removes subscription access after expiration", () => {
    const subscriber = record({
      plan: "pro_monthly",
      entitlement_type: "subscription",
      entitlement_status: "active",
      expiration_date: "2026-07-28T12:00:00Z",
    });
    expect(accessFromEntitlement(subscriber, NOW).hasProAccess).toBe(false);
  });

  it("9. accepts a newer restored entitlement from another device", () => {
    const cached = record({ updated_at: "2026-07-20T00:00:00Z" });
    const restored = record({
      plan: "pro_monthly",
      entitlement_type: "subscription",
      entitlement_status: "active",
      expiration_date: "2026-08-29T12:00:00Z",
      updated_at: "2026-07-29T12:00:00Z",
    });
    expect(
      shouldReplaceCachedEntitlement({ current: cached, incoming: restored }),
    ).toBe(true);
  });

  it("10. identifies duplicate transaction processing", () => {
    expect(isNewTransaction(new Set(["2000000000001"]), "2000000000001")).toBe(
      false,
    );
  });

  it("11. Lifetime Pro overrides an expired subscription", () => {
    const lifetime = record({
      plan: "lifetime_pro",
      entitlement_type: "founder",
      entitlement_status: "expired",
      is_lifetime_pro: true,
      expiration_date: "2026-01-01T00:00:00Z",
    });
    expect(accessFromEntitlement(lifetime, NOW)).toMatchObject({
      hasProAccess: true,
      hasLifetimeAccess: true,
    });
  });

  it("12. unverified client data alone leaves access Free", () => {
    expect(accessFromEntitlement(null, NOW).hasProAccess).toBe(false);
  });

  it("13. network failure retains the valid cached entitlement", () => {
    const cached = record({
      plan: "lifetime_pro",
      entitlement_type: "founder",
      entitlement_status: "active",
      is_lifetime_pro: true,
    });
    expect(
      entitlementAfterRefresh({
        cached,
        server: null,
        networkFailed: true,
      }),
    ).toBe(cached);
  });

  it("14. denies entitlement admin controls to normal users", () => {
    expect(
      canAccessEntitlementAdmin(
        ["22222222-2222-4222-8222-222222222222"],
        "11111111-1111-4111-8111-111111111111",
      ),
    ).toBe(false);
  });

  it("15. keeps access during Apple's grace period", () => {
    const grace = record({
      plan: "pro_monthly",
      entitlement_type: "subscription",
      entitlement_status: "grace_period",
      expiration_date: "2026-08-03T12:00:00Z",
    });
    expect(accessFromEntitlement(grace, NOW).hasProAccess).toBe(true);
  });

  it("16. does not grant access during billing retry without grace", () => {
    const retry = record({
      plan: "pro_monthly",
      entitlement_type: "subscription",
      entitlement_status: "billing_retry",
      expiration_date: "2026-07-28T12:00:00Z",
    });
    expect(accessFromEntitlement(retry, NOW).hasProAccess).toBe(false);
  });

  it("17. removes access immediately after an Apple refund or revocation", () => {
    const refunded = record({
      plan: "free",
      entitlement_type: "subscription",
      entitlement_status: "revoked",
      expiration_date: "2026-08-29T12:00:00Z",
    });
    expect(accessFromEntitlement(refunded, NOW).hasProAccess).toBe(false);
  });

  it("18. treats the founder cutoff timestamp as inclusive", () => {
    expect(
      isFounderEligible({
        enabled: true,
        cutoffAt: "2026-08-31T23:59:59Z",
        accountCreatedAt: "2026-08-31T23:59:59Z",
      }),
    ).toBe(true);
  });

  it("19. rejects accounts created one second after the founder cutoff", () => {
    expect(
      isFounderEligible({
        enabled: true,
        cutoffAt: "2026-08-31T23:59:59Z",
        accountCreatedAt: "2026-09-01T00:00:00Z",
      }),
    ).toBe(false);
  });
});
