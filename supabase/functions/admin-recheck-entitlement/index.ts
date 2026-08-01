import { createClient } from "npm:@supabase/supabase-js@2";
import {
  AppStoreServerAPIClient,
  Environment,
} from "npm:@apple/app-store-server-library@2.0.0";
import { verifyTransaction } from "../_shared/apple-verifier.ts";
import {
  serviceClient,
  syncVerifiedTransaction,
} from "../_shared/entitlement-sync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function requiredSecret(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value.replaceAll("\\n", "\n");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed." },
      { status: 405, headers: corsHeaders },
    );
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Administrator sign-in is required.");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) throw new Error("Your session has expired.");

    const { data: administrator } = await serviceClient
      .from("entitlement_admins")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (!administrator) throw new Error("Administrator access is required.");

    const body = (await request.json()) as { userId?: string };
    if (!body.userId) throw new Error("A target user is required.");

    const { data: current, error: readError } = await serviceClient
      .from("user_entitlements")
      .select("*")
      .eq("user_id", body.userId)
      .single();
    if (readError) throw readError;
    if (current.is_lifetime_pro) {
      return Response.json(
        { entitlement: current, rechecked: false, reason: "lifetime_pro" },
        { headers: corsHeaders },
      );
    }
    if (!current.original_transaction_id) {
      throw new Error("This user has no Apple subscription to recheck.");
    }
    if (current.environment === "Xcode") {
      throw new Error(
        "Local StoreKit transactions cannot be queried from Apple's server.",
      );
    }

    const environment =
      current.environment === "Sandbox"
        ? Environment.SANDBOX
        : Environment.PRODUCTION;
    const client = new AppStoreServerAPIClient(
      requiredSecret("APPLE_IAP_PRIVATE_KEY"),
      requiredSecret("APPLE_IAP_KEY_ID"),
      requiredSecret("APPLE_IAP_ISSUER_ID"),
      Deno.env.get("APPLE_BUNDLE_ID") ?? "com.nickyocom.klimb",
      environment,
    );
    const response = await client.getTransactionInfo(
      current.original_transaction_id,
    );
    if (!response.signedTransactionInfo) {
      throw new Error("Apple returned no signed transaction.");
    }

    const transaction = await verifyTransaction(
      response.signedTransactionInfo,
    );
    const entitlement = await syncVerifiedTransaction({
      transaction,
      signedTransaction: response.signedTransactionInfo,
      expectedUserId: body.userId,
    });

    await serviceClient.from("entitlement_audit_log").insert({
      target_user_id: body.userId,
      actor_user_id: authData.user.id,
      action: "admin_subscription_rechecked",
      previous_value: current,
      new_value: entitlement,
      reason: "Administrator requested a fresh App Store Server API check.",
    });

    return Response.json(
      { entitlement, rechecked: true },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The entitlement could not be rechecked.",
      },
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
