import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyTransaction } from "../_shared/apple-verifier.ts";
import {
  serviceClient,
  syncVerifiedTransaction,
} from "../_shared/entitlement-sync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (!authorization) throw new Error("Sign in before restoring a purchase.");

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

    const body = (await request.json()) as { signedTransaction?: string };
    if (!body.signedTransaction) {
      throw new Error("A signed Apple transaction is required.");
    }

    const transaction = await verifyTransaction(body.signedTransaction);
    const entitlement = await syncVerifiedTransaction({
      transaction,
      signedTransaction: body.signedTransaction,
      expectedUserId: authData.user.id,
      client: serviceClient,
    });

    return Response.json(
      { entitlement, transactionId: transaction.transactionId },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Verification failed." },
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
