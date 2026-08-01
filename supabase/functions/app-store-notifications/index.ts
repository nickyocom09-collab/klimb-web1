import {
  verifyNotification,
  verifyRenewalInfo,
  verifyTransaction,
} from "../_shared/apple-verifier.ts";
import {
  serviceClient,
  syncVerifiedTransaction,
} from "../_shared/entitlement-sync.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed.", { status: 405 });
  }

  try {
    const body = (await request.json()) as { signedPayload?: string };
    if (!body.signedPayload) throw new Error("Missing signedPayload.");

    const notification = await verifyNotification(body.signedPayload);
    const signedTransaction =
      notification.data?.signedTransactionInfo ?? null;
    if (signedTransaction) {
      const transaction = await verifyTransaction(signedTransaction);
      const userId = transaction.appAccountToken;
      const { data: previous } = userId
        ? await serviceClient
            .from("user_entitlements")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle()
        : { data: null };
      let entitlement = await syncVerifiedTransaction({
        transaction,
        signedTransaction,
      });

      // Apple may continue Pro access during billing retry or a configured
      // grace period even when the transaction's nominal expiry has passed.
      // Server Notification V2 is the authority for these transitional states.
      const notificationType = notification.notificationType ?? "";
      const subtype = notification.subtype ?? "";
      const signedRenewalInfo =
        notification.data?.signedRenewalInfo ?? null;
      const renewalInfo = signedRenewalInfo
        ? await verifyRenewalInfo(signedRenewalInfo)
        : null;
      const graceExpiresAt =
        typeof renewalInfo?.gracePeriodExpiresDate === "number"
          ? new Date(renewalInfo.gracePeriodExpiresDate).toISOString()
          : null;
      const graceStatus =
        notificationType === "DID_FAIL_TO_RENEW" &&
        subtype === "GRACE_PERIOD" &&
        graceExpiresAt
          ? "grace_period"
          : notificationType === "DID_FAIL_TO_RENEW"
            ? "billing_retry"
            : null;
      if (graceStatus && userId && !entitlement.is_lifetime_pro) {
        const { data: graceEntitlement, error: graceError } =
          await serviceClient
            .from("user_entitlements")
            .update({
              plan: "pro_monthly",
              entitlement_type: "subscription",
              entitlement_status: graceStatus,
              current_period_ends_at:
                graceStatus === "grace_period"
                  ? graceExpiresAt
                  : entitlement.current_period_ends_at,
              expiration_date:
                graceStatus === "grace_period"
                  ? graceExpiresAt
                  : entitlement.expiration_date,
              last_verified_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .select("*")
            .single();
        if (graceError) throw graceError;
        entitlement = graceEntitlement;
      }

      if (
        userId &&
        previous?.entitlement_status === "trial" &&
        entitlement.entitlement_status === "active"
      ) {
        await serviceClient.from("entitlement_analytics_events").insert({
          user_id: userId,
          event_name: "trial_converted",
          properties: { source: "app_store_server_notification_v2" },
        });
      }
      if (
        userId &&
        !entitlement.is_lifetime_pro &&
        ["EXPIRED", "GRACE_PERIOD_EXPIRED", "REFUND", "REVOKE"].includes(
          notificationType,
        ) &&
        previous?.entitlement_status !== "expired" &&
        previous?.entitlement_status !== "revoked"
      ) {
        await serviceClient.from("entitlement_analytics_events").insert({
          user_id: userId,
          event_name: "subscription_expired",
          properties: { source: "app_store_server_notification_v2" },
        });
      }
    }

    // Apple treats any 2xx response as successfully processed. Repeated
    // notifications are safe because transaction_id is the idempotency key.
    return Response.json({ accepted: true });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid notification." },
      { status: 400 },
    );
  }
});
