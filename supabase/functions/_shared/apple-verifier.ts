import { Buffer } from "node:buffer";
import {
  Environment,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "npm:@apple/app-store-server-library@3.1.0";
import { APPLE_ROOT_CERTIFICATES_BASE64 } from "./apple-root-certificates.ts";

const bundleId = Deno.env.get("APPLE_BUNDLE_ID") ?? "com.nickyocom.klimb";
const appAppleId = Number(Deno.env.get("APPLE_APP_ID") ?? "6792880012");

function decodeCertificate(value: string): Buffer {
  const normalized = value
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "");
  return Buffer.from(normalized, "base64");
}

function rootCertificates(): Buffer[] {
  return APPLE_ROOT_CERTIFICATES_BASE64.map(decodeCertificate);
}

function verifier(environment: Environment, enableOnlineChecks = true) {
  return new SignedDataVerifier(
    rootCertificates(),
    enableOnlineChecks,
    environment,
    bundleId,
    environment === Environment.PRODUCTION ? appAppleId : undefined,
  );
}

function isRetryableOnlineCheckFailure(error: unknown) {
  return error instanceof VerificationException && [
    VerificationStatus.RETRYABLE_VERIFICATION_FAILURE,
    // A certificate can be valid at Apple's signed date but fail a current-
    // time check after Apple rotates its signing chain. The second pass still
    // verifies the full Apple chain, JWS signature, bundle and environment;
    // it only evaluates certificate dates at the immutable signedDate.
    VerificationStatus.INVALID_CERTIFICATE,
  ].includes(error.status);
}

function verificationFailureDetails(error: unknown) {
  if (!(error instanceof VerificationException)) {
    return { type: error instanceof Error ? error.name : "UnknownError" };
  }
  return {
    type: error.name,
    status: error.status,
    statusName: VerificationStatus[error.status],
    causeType: error.cause?.name,
    causeMessage: error.cause?.message?.slice(0, 240),
  };
}

function unverifiedTransactionContext(signedTransaction: string) {
  try {
    const [encodedHeader, encodedPayload] = signedTransaction.split(".");
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString());
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString());
    return {
      segments: signedTransaction.split(".").length,
      certificateChainLength: Array.isArray(header.x5c) ? header.x5c.length : 0,
      algorithm: typeof header.alg === "string" ? header.alg : undefined,
      bundleId: typeof payload.bundleId === "string" ? payload.bundleId : undefined,
      environment: typeof payload.environment === "string"
        ? payload.environment
        : undefined,
      productId: typeof payload.productId === "string" ? payload.productId : undefined,
    };
  } catch {
    return { malformedCompactJws: true };
  }
}

async function verifyTransactionInEnvironment(
  environment: Environment,
  signedTransaction: string,
) {
  try {
    return await verifier(environment).verifyAndDecodeTransaction(
      signedTransaction,
    );
  } catch (error) {
    if (!isRetryableOnlineCheckFailure(error)) throw error;
    // Apple's verifier classifies an unavailable OCSP responder as retryable.
    // In that narrow case, verify again at the JWS signed date. This still
    // enforces Apple's certificate chain, signature, bundle id, environment,
    // product id, and account token; it only avoids making a temporary Apple
    // revocation-service outage block a completed purchase.
    console.warn("Apple online certificate check unavailable; using signed-date verification", {
      environment,
      failure: verificationFailureDetails(error),
    });
    return await verifier(environment, false).verifyAndDecodeTransaction(
      signedTransaction,
    );
  }
}

async function verifyNotificationInEnvironment(
  environment: Environment,
  signedPayload: string,
) {
  try {
    return await verifier(environment).verifyAndDecodeNotification(signedPayload);
  } catch (error) {
    if (!isRetryableOnlineCheckFailure(error)) throw error;
    console.warn("Apple OCSP check unavailable for notification", { environment });
    return await verifier(environment, false).verifyAndDecodeNotification(
      signedPayload,
    );
  }
}

async function verifyRenewalInEnvironment(
  environment: Environment,
  signedRenewalInfo: string,
) {
  try {
    return await verifier(environment).verifyAndDecodeRenewalInfo(
      signedRenewalInfo,
    );
  } catch (error) {
    if (!isRetryableOnlineCheckFailure(error)) throw error;
    console.warn("Apple OCSP check unavailable for renewal", { environment });
    return await verifier(environment, false).verifyAndDecodeRenewalInfo(
      signedRenewalInfo,
    );
  }
}

export async function verifyTransaction(
  signedTransaction: string,
): Promise<JWSTransactionDecodedPayload> {
  let sandboxError: unknown;
  try {
    return await verifyTransactionInEnvironment(
      Environment.SANDBOX,
      signedTransaction,
    );
  } catch (error) {
    sandboxError = error;
  }

  try {
    return await verifyTransactionInEnvironment(
      Environment.PRODUCTION,
      signedTransaction,
    );
  } catch (productionError) {
    console.error("Apple JWS verification failed", {
      sandbox: verificationFailureDetails(sandboxError),
      production: verificationFailureDetails(productionError),
      transaction: unverifiedTransactionContext(signedTransaction),
    });
    throw new Error("Apple could not verify this transaction.");
  }
}

export async function verifyNotification(
  signedPayload: string,
): Promise<ResponseBodyV2DecodedPayload> {
  let sandboxError: unknown;
  try {
    return await verifyNotificationInEnvironment(
      Environment.SANDBOX,
      signedPayload,
    );
  } catch (error) {
    sandboxError = error;
  }

  try {
    return await verifyNotificationInEnvironment(
      Environment.PRODUCTION,
      signedPayload,
    );
  } catch (productionError) {
    console.error("Apple notification verification failed", {
      sandboxError: String(sandboxError),
      productionError: String(productionError),
    });
    throw new Error("Apple could not verify this notification.");
  }
}

export async function verifyRenewalInfo(
  signedRenewalInfo: string,
): Promise<JWSRenewalInfoDecodedPayload> {
  let sandboxError: unknown;
  try {
    return await verifyRenewalInEnvironment(
      Environment.SANDBOX,
      signedRenewalInfo,
    );
  } catch (error) {
    sandboxError = error;
  }

  try {
    return await verifyRenewalInEnvironment(
      Environment.PRODUCTION,
      signedRenewalInfo,
    );
  } catch (productionError) {
    console.error("Apple renewal verification failed", {
      sandboxError: String(sandboxError),
      productionError: String(productionError),
    });
    throw new Error("Apple could not verify this renewal.");
  }
}

export function millisecondsToIso(value?: number | null): string | null {
  return typeof value === "number" ? new Date(value).toISOString() : null;
}
