import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyTransaction } from "../_shared/apple-verifier.ts";
import {
  serviceClient,
  syncVerifiedTransaction,
} from "../_shared/entitlement-sync.ts";
import { corsHeadersFor, preflightResponse } from "../_shared/cors.ts";
import {
  readJsonBody,
  RequestError,
  safeErrorType,
} from "../_shared/request.ts";

Deno.serve(async (request) => {
  const corsHeaders = corsHeadersFor(request);
  if (request.method === "OPTIONS") {
    return preflightResponse(request);
  }
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed." },
      { status: 405, headers: corsHeaders },
    );
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new RequestError("Sign in before restoring a purchase.", 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) throw new RequestError("Your session has expired.", 401);

    const body = await readJsonBody<{ signedTransaction?: string }>(request);
    if (!body.signedTransaction) {
      throw new RequestError("A signed Apple transaction is required.");
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
    console.error("Transaction verification failed", { type: safeErrorType(error) });
    return Response.json(
      {
        error: error instanceof RequestError
          ? error.message
          : "Apple could not verify that purchase.",
      },
      {
        status: error instanceof RequestError ? error.status : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
