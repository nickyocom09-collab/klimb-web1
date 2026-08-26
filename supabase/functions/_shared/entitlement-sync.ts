import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { JWSTransactionDecodedPayload } from "npm:@apple/app-store-server-library@2.0.0";
import { millisecondsToIso } from "./apple-verifier.ts";
import {
  appleAccountTokensMatch,
  normalizeAppleAccountToken,
} from "./apple-account-token.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const configuredMonthlyProductId =
  Deno.env.get("APPLE_MONTHLY_PRODUCT_ID") ??
  "com.nickyocom.klimb.pro.monthly";
const configuredAnnualProductId =
  Deno.env.get("APPLE_ANNUAL_PRODUCT_ID") ??
  "com.nickyocom.klimb.pro.annual";
const configuredProductIds = new Set([
  configuredMonthlyProductId,
  configuredAnnualProductId,
]);

export function planForProductId(productId?: string | null) {
  return productId === configuredAnnualProductId
    ? "pro_annual" as const
    : "pro_monthly" as const;
}

export const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function statusFor(
  transaction: JWSTransactionDecodedPayload,
  now = Date.now(),
): "active" | "trial" | "expired" | "revoked" {
  if (transaction.revocationDate) return "revoked";
  if (!transaction.expiresDate || transaction.expiresDate <= now) {
    return "expired";
  }
  // `offerType === 1` means any introductory offer, including paid upfront or
  // pay-as-you-go offers. Only Apple's explicit FREE_TRIAL payment mode should
  // be represented as a trial in Klimb.
  return transaction.offerDiscountType === "FREE_TRIAL" ? "trial" : "active";
}

export async function syncVerifiedTransaction({
  transaction,
  signedTransaction,
  expectedUserId,
  client = serviceClient,
}: {
  transaction: JWSTransactionDecodedPayload;
  signedTransaction: string;
  expectedUserId?: string;
  client?: SupabaseClient;
}) {
  if (
    !transaction.transactionId ||
    !transaction.originalTransactionId ||
    !transaction.productId ||
    !transaction.appAccountToken
  ) {
    throw new Error("The verified transaction is missing required fields.");
  }
  if (!configuredProductIds.has(transaction.productId)) {
    throw new Error("This transaction is for an unknown Klimb product.");
  }
  const userId = normalizeAppleAccountToken(transaction.appAccountToken);
  if (
    expectedUserId &&
    !appleAccountTokensMatch(transaction.appAccountToken, expectedUserId)
  ) {
    throw new Error("This purchase belongs to a different Klimb account.");
  }

  const environment = transaction.environment ?? "Sandbox";
  const entitlementStatus = statusFor(transaction);
  const expiresAt = millisecondsToIso(transaction.expiresDate);
  const purchasedAt = millisecondsToIso(transaction.purchaseDate);
  const isActive =
    entitlementStatus === "active" || entitlementStatus === "trial";

  const { error: transactionError } = await client
    .from("entitlement_transactions")
    .upsert(
      {
        transaction_id: transaction.transactionId,
        original_transaction_id: transaction.originalTransactionId,
        user_id: userId,
        product_id: transaction.productId,
        environment,
        purchase_date: purchasedAt,
        expires_date: expiresAt,
        revocation_date: millisecondsToIso(transaction.revocationDate),
        offer_type: transaction.offerType ?? null,
        signed_payload_sha256: await sha256(signedTransaction),
        verified_at: new Date().toISOString(),
      },
      { onConflict: "transaction_id" },
    );
  if (transactionError) throw transactionError;

  const { data: existing, error: readError } = await client
    .from("user_entitlements")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;

  // A subscription can never overwrite permanent Lifetime Pro.
  if (!existing?.is_lifetime_pro) {
    const { error: entitlementError } = await client
      .from("user_entitlements")
      .upsert(
        {
          user_id: userId,
          plan: isActive ? planForProductId(transaction.productId) : "free",
          entitlement_type:
            entitlementStatus === "trial" ? "trial" : "subscription",
          entitlement_status: entitlementStatus,
          is_lifetime_pro: false,
          subscription_product_id: transaction.productId,
          original_transaction_id: transaction.originalTransactionId,
          subscription_started_at:
            existing?.subscription_started_at ?? purchasedAt,
          trial_ends_at: entitlementStatus === "trial" ? expiresAt : null,
          current_period_ends_at: expiresAt,
          expiration_date: expiresAt,
          last_verified_at: new Date().toISOString(),
          environment,
        },
        { onConflict: "user_id" },
      );
    if (entitlementError) throw entitlementError;
  }

  const { data: result, error: resultError } = await client
    .from("user_entitlements")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (resultError) throw resultError;
  return result;
}
