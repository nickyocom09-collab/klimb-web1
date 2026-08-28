/** Apple and UUID libraries may serialize the same UUID with different case. */
export function normalizeAppleAccountToken(value: string) {
  return value.trim().toLowerCase();
}

export function appleAccountTokensMatch(left: string, right: string) {
  return normalizeAppleAccountToken(left) === normalizeAppleAccountToken(right);
}

export type AppleSubscriptionOwnershipErrorCode =
  | "account_mismatch"
  | "missing_account_binding";

export class AppleSubscriptionOwnershipError extends Error {
  readonly code: AppleSubscriptionOwnershipErrorCode;

  constructor(code: AppleSubscriptionOwnershipErrorCode) {
    super(code);
    this.name = "AppleSubscriptionOwnershipError";
    this.code = code;
  }
}

/**
 * Choose the Klimb account that may own an Apple subscription chain.
 *
 * New purchases carry Apple's signed appAccountToken. Older StoreKit
 * transactions may not, so an authenticated restore may establish a claim
 * exactly once. A persisted claim always wins against later attempts to attach
 * the same original transaction to another Klimb account.
 */
export function decideAppleSubscriptionOwner({
  signedAccountToken,
  expectedUserId,
  claimedUserId,
}: {
  signedAccountToken?: string | null;
  expectedUserId?: string | null;
  claimedUserId?: string | null;
}) {
  const signed = signedAccountToken
    ? normalizeAppleAccountToken(signedAccountToken)
    : null;
  const expected = expectedUserId
    ? normalizeAppleAccountToken(expectedUserId)
    : null;
  const claimed = claimedUserId
    ? normalizeAppleAccountToken(claimedUserId)
    : null;

  if (signed && expected && signed !== expected) {
    throw new AppleSubscriptionOwnershipError("account_mismatch");
  }

  const candidate = signed ?? expected ?? claimed;
  if (!candidate) {
    throw new AppleSubscriptionOwnershipError("missing_account_binding");
  }
  if (claimed && claimed !== candidate) {
    throw new AppleSubscriptionOwnershipError("account_mismatch");
  }
  return candidate;
}
